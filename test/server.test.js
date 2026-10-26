import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import WebSocket from 'ws';
import { startServer } from '../src/server.js';
import { CARDS, isSimilar } from '../src/cards.js';
import { rig } from './helpers.js';

/** A WebSocket client that queues incoming messages so tests can await them. */
async function client(port) {
  const ws = new WebSocket(`ws://localhost:${port}`);
  const queue = [];
  const waiters = [];
  ws.on('message', (raw) => {
    const msg = JSON.parse(raw);
    const i = waiters.findIndex((w) => w.match(msg));
    if (i >= 0) waiters.splice(i, 1)[0].resolve(msg);
    else queue.push(msg);
  });
  await new Promise((res, rej) => { ws.once('open', res); ws.once('error', rej); });
  return {
    ws,
    send: (msg) => ws.send(JSON.stringify(msg)),
    next(type) {
      const match = (m) => m.type === type;
      const i = queue.findIndex(match);
      if (i >= 0) return Promise.resolve(queue.splice(i, 1)[0]);
      return new Promise((resolve, reject) => {
        const w = { match, resolve };
        waiters.push(w);
        setTimeout(() => reject(new Error(`timed out waiting for ${type}`)), 3000);
      });
    },
    drain() { queue.length = 0; },
    close: () => new Promise((res) => { ws.once('close', res); ws.close(); }),
  };
}

async function setupGame(srv) {
  const alice = await client(srv.port);
  alice.send({ type: 'create', name: 'Alice' });
  const aJoined = await alice.next('joined');
  await alice.next('state');
  const bob = await client(srv.port);
  bob.send({ type: 'join', code: aJoined.code, name: 'Bob' });
  const bJoined = await bob.next('joined');
  await bob.next('state');
  await alice.next('state');
  // Fix hidden cards and hands so the test knows which piles are correct.
  rig(srv.store.get(aJoined.code), { hiddenA: 0, hiddenB: 48 });
  return { alice, bob, code: aJoined.code, aToken: aJoined.token, bToken: bJoined.token };
}

const playFor = (srv, code, seat, wantSimilar) => {
  const game = srv.store.get(code);
  const target = game.players[seat === 'A' ? 'B' : 'A'].hidden;
  const cardId = game.players[seat].hand.find((id) => isSimilar(CARDS[id], CARDS[target]) === wantSimilar);
  return { type: 'play', cardId, pile: wantSimilar ? 'similar' : 'notSimilar' };
};
const ids = (pile) => pile.map((e) => e.cardId);

describe('server', () => {
  let dir;
  let srv;
  before(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'maple-'));
    srv = await startServer({ port: 0, dataFile: path.join(dir, 'games.json') });
  });
  after(async () => {
    await srv.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('clues are routed to the recipient and pushed to both players in real time', async () => {
    const { alice, bob, code } = await setupGame(srv);
    const play = playFor(srv, code, 'A', true);
    alice.send(play);
    const [aState, bState] = await Promise.all([alice.next('state'), bob.next('state')]);
    // Bob (the recipient) sees it in HIS piles immediately, during his own turn's start.
    assert.deepEqual(ids(bState.state.you.piles.similar), [play.cardId]);
    assert.equal(bState.state.you.piles.notSimilar.length, 0);
    // Alice's own piles are untouched; she sees it only as a clue she gave.
    assert.equal(aState.state.you.piles.similar.length + aState.state.you.piles.notSimilar.length, 0);
    assert.deepEqual(ids(aState.state.opponent.piles.similar), [play.cardId]);
    // A player is never told their own hidden card.
    assert.equal(bState.state.you.hidden, null);
    assert.equal(aState.state.you.hidden, null);
    await Promise.all([alice.close(), bob.close()]);
  });

  test('an invalid move is rejected over the wire and enters no history', async () => {
    const { alice, bob, code } = await setupGame(srv);
    const before = JSON.stringify(srv.store.get(code).players);
    const wrong = playFor(srv, code, 'A', true);
    alice.send({ ...wrong, pile: 'notSimilar' });
    const err = await alice.next('error');
    assert.match(err.message, /Similar/);
    bob.send(playFor(srv, code, 'B', true)); // not Bob's turn
    await bob.next('error');
    // A client cannot act as the other seat by naming it in the message.
    bob.send({ ...playFor(srv, code, 'B', true), seat: 'A' });
    await bob.next('error');
    assert.equal(JSON.stringify(srv.store.get(code).players), before);
    await Promise.all([alice.close(), bob.close()]);
  });

  // Required test 6
  test("each player's history survives refresh, reconnection and a server restart", async () => {
    const { alice, bob, code, aToken, bToken } = await setupGame(srv);
    const moves = [
      [alice, 'A', true], [bob, 'B', false], [alice, 'A', false], [bob, 'B', true],
    ];
    for (const [c, seat, sim] of moves) {
      c.send(playFor(srv, code, seat, sim));
      await Promise.all([alice.next('state'), bob.next('state')]);
    }
    const game = srv.store.get(code);
    const expectA = JSON.stringify(game.players.A.piles);
    const expectB = JSON.stringify(game.players.B.piles);
    await Promise.all([alice.close(), bob.close()]);

    // "Refresh": brand new connections resume with the stored token.
    const a2 = await client(srv.port);
    a2.send({ type: 'resume', code, token: aToken });
    assert.equal((await a2.next('joined')).seat, 'A');
    const aView = (await a2.next('state')).state;
    const b2 = await client(srv.port);
    b2.send({ type: 'resume', code, token: bToken });
    assert.equal((await b2.next('joined')).seat, 'B');
    const bView = (await b2.next('state')).state;
    const strip = (piles) => JSON.stringify({
      similar: piles.similar.map(({ cardId, from, turn }) => ({ cardId, from, turn })),
      notSimilar: piles.notSimilar.map(({ cardId, from, turn }) => ({ cardId, from, turn })),
    });
    assert.equal(strip(aView.you.piles), expectA);
    assert.equal(strip(bView.you.piles), expectB);
    await Promise.all([a2.close(), b2.close()]);

    // Server restart: a new process loads everything from the data file.
    const port = srv.port;
    await srv.close();
    srv = await startServer({ port, dataFile: path.join(dir, 'games.json') });
    const a3 = await client(srv.port);
    a3.send({ type: 'resume', code, token: aToken });
    await a3.next('joined');
    assert.equal(strip((await a3.next('state')).state.you.piles), expectA);
    const b3 = await client(srv.port);
    b3.send({ type: 'resume', code, token: bToken });
    await b3.next('joined');
    assert.equal(strip((await b3.next('state')).state.you.piles), expectB);

    // And the game continues correctly after the restart.
    a3.drain();
    const next = playFor(srv, code, 'A', true);
    a3.send(next);
    const bAfter = (await b3.next('state')).state;
    assert.equal(bAfter.you.piles.similar.at(-1).cardId, next.cardId);
    await Promise.all([a3.close(), b3.close()]);
  });

  test('a wrong token cannot resume or read another player\'s history', async () => {
    const { alice, bob, code } = await setupGame(srv);
    const c = await client(srv.port);
    c.send({ type: 'resume', code, token: 'not-a-real-token' });
    assert.match((await c.next('error')).message, /not a player/);
    c.send({ type: 'join', code, name: 'Eve' });
    assert.match((await c.next('error')).message, /two players/);
    await Promise.all([alice.close(), bob.close(), c.close()]);
  });

  test('serves the app and health check', async () => {
    for (const [p, type] of [['/', 'text/html'], ['/app.js', 'javascript'], ['/shared/cards.js', 'javascript'], ['/healthz', 'text/plain']]) {
      const res = await fetch(`http://localhost:${srv.port}${p}`);
      assert.equal(res.status, 200, p);
      assert.match(res.headers.get('content-type'), new RegExp(type));
    }
    const bad = await fetch(`http://localhost:${srv.port}/..%2fpackage.json`);
    assert.notEqual(bad.status, 200);
  });
});
