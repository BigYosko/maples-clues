import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { CARDS, ANIMALS, ACCESSORIES, LOCATIONS, isSimilar } from '../src/cards.js';
import {
  createGame, joinGame, playClue, makeGuess, passTurn, viewFor, GameError, HAND_SIZE,
} from '../src/game.js';
import { startedGame, similarIn, notSimilarIn, validPlay } from './helpers.js';

const snapshot = (game) => JSON.parse(JSON.stringify(game));

describe('deck', () => {
  test('49 unique cards, every attribute value appears exactly 7 times', () => {
    assert.equal(CARDS.length, 49);
    assert.equal(new Set(CARDS.map((c) => `${c.animal}-${c.accessory}-${c.location}`)).size, 49);
    for (const attr of ['animal', 'accessory', 'location']) {
      for (let v = 0; v < 7; v++) assert.equal(CARDS.filter((c) => c[attr] === v).length, 7);
    }
    assert.equal(ANIMALS.length, 7);
    assert.equal(ACCESSORIES.length, 7);
    assert.equal(LOCATIONS.length, 7);
  });

  test('Maple the British brown cat is one of the animals', () => {
    assert.ok(ANIMALS.some((a) => a.name === 'Maple' && /British brown cat/.test(a.full)));
  });

  test('similar means at least one shared attribute', () => {
    const base = { animal: 0, accessory: 0, location: 0 };
    assert.equal(isSimilar(base, { animal: 0, accessory: 1, location: 1 }), true);
    assert.equal(isSimilar(base, { animal: 1, accessory: 0, location: 1 }), true);
    assert.equal(isSimilar(base, { animal: 1, accessory: 1, location: 0 }), true);
    assert.equal(isSimilar(base, { animal: 1, accessory: 1, location: 1 }), false);
  });
});

describe('setup', () => {
  test('each player gets 1 hidden card and 5 hand cards; the rest form the deck', () => {
    const game = createGame({ code: 'X', name: 'A', token: 'a' });
    joinGame(game, { name: 'B', token: 'b' });
    const all = [game.players.A.hidden, game.players.B.hidden, ...game.players.A.hand, ...game.players.B.hand, ...game.deck];
    assert.equal(game.players.A.hand.length, HAND_SIZE);
    assert.equal(game.players.B.hand.length, HAND_SIZE);
    assert.equal(game.deck.length, 37);
    assert.equal(new Set(all).size, 49);
    assert.equal(game.status, 'playing');
  });

  test('a third player cannot join', () => {
    const game = startedGame();
    assert.throws(() => joinGame(game, { name: 'C', token: 'c' }), GameError);
  });
});

describe('personal clue piles', () => {
  // Required test 1
  test('each player has two distinct personal clue piles', () => {
    const game = startedGame();
    const { A, B } = game.players;
    for (const p of [A, B]) {
      assert.deepEqual(Object.keys(p.piles).sort(), ['notSimilar', 'similar']);
      assert.notEqual(p.piles.similar, p.piles.notSimilar);
    }
    // Four separate arrays, none shared between players.
    const arrays = [A.piles.similar, A.piles.notSimilar, B.piles.similar, B.piles.notSimilar];
    assert.equal(new Set(arrays).size, 4);
  });

  // Required test 2
  test("a clue about Player A's hidden card is added only to Player A's piles", () => {
    const game = startedGame();
    playClue(game, 'A', notSimilarIn(game, 'A', 48), 'notSimilar'); // A's turn: clue for B
    const before = snapshot(game.players.B.piles);
    const card = similarIn(game, 'B', game.players.A.hidden);
    playClue(game, 'B', card, 'similar'); // B gives a clue about A's hidden card
    assert.deepEqual(game.players.A.piles.similar.map((e) => e.cardId), [card]);
    assert.equal(game.players.A.piles.notSimilar.length, 0);
    assert.deepEqual(game.players.B.piles, before, "B's piles must not change");
  });

  // Required test 3
  test("a clue about Player B's hidden card is added only to Player B's piles", () => {
    const game = startedGame();
    const card = similarIn(game, 'A', game.players.B.hidden);
    playClue(game, 'A', card, 'similar');
    assert.deepEqual(game.players.B.piles.similar.map((e) => e.cardId), [card]);
    assert.equal(game.players.B.piles.notSimilar.length, 0);
    assert.equal(game.players.A.piles.similar.length + game.players.A.piles.notSimilar.length, 0);
  });

  // Required test 4
  test('similar and not-similar cards are routed to the correct pile of the correct recipient', () => {
    const game = startedGame();
    const { A, B } = game.players;
    const moves = [];
    for (let i = 0; i < 4; i++) {
      for (const seat of ['A', 'B']) {
        const giver = game.players[seat];
        const recipient = seat === 'A' ? B : A;
        const wantSimilar = i % 2 === 0;
        const card = (wantSimilar ? similarIn : notSimilarIn)(game, seat, recipient.hidden)
          ?? giver.hand[0];
        const pile = isSimilar(CARDS[card], CARDS[recipient.hidden]) ? 'similar' : 'notSimilar';
        const result = playClue(game, seat, card, pile);
        assert.equal(result.recipient, seat === 'A' ? 'B' : 'A');
        moves.push({ recipient: result.recipient, pile, card });
      }
    }
    for (const seat of ['A', 'B']) {
      const p = game.players[seat];
      for (const pile of ['similar', 'notSimilar']) {
        const expected = moves.filter((m) => m.recipient === seat && m.pile === pile).map((m) => m.card);
        assert.deepEqual(p.piles[pile].map((e) => e.cardId), expected, `${seat}.${pile} keeps play order`);
        for (const e of p.piles[pile]) {
          assert.equal(isSimilar(CARDS[e.cardId], CARDS[p.hidden]), pile === 'similar');
          assert.notEqual(e.from, seat, 'pile entries come from the opponent');
        }
      }
    }
  });

  // Required test 5
  test('invalid moves never enter either player\'s history', () => {
    const game = startedGame();
    const before = snapshot(game);
    const sim = similarIn(game, 'A', 48);
    const notSim = notSimilarIn(game, 'A', 48);
    const invalid = [
      () => playClue(game, 'A', sim, 'notSimilar'), // wrong pile
      () => playClue(game, 'A', notSim, 'similar'), // wrong pile
      () => playClue(game, 'B', game.players.B.hand[0], 'similar'), // not B's turn
      () => playClue(game, 'A', game.players.B.hand[0], 'similar'), // card not in hand
      () => playClue(game, 'A', game.players.B.hidden, 'similar'), // opponent's hidden card
      () => playClue(game, 'A', sim, 'bogus'), // unknown pile
      () => passTurn(game, 'A'), // can't pass with cards in hand
    ];
    for (const move of invalid) assert.throws(move, GameError);
    assert.deepEqual(snapshot(game), before, 'state is untouched by rejected moves');
  });

  // Required test 7
  test("one player's clue history cannot overwrite or contaminate the other's", () => {
    const game = startedGame();
    playClue(game, 'A', similarIn(game, 'A', 48), 'similar');
    playClue(game, 'B', notSimilarIn(game, 'B', 0), 'notSimilar');
    playClue(game, 'A', notSimilarIn(game, 'A', 48), 'notSimilar');
    playClue(game, 'B', similarIn(game, 'B', 0), 'similar');
    const aIds = [...game.players.A.piles.similar, ...game.players.A.piles.notSimilar].map((e) => e.cardId);
    const bIds = [...game.players.B.piles.similar, ...game.players.B.piles.notSimilar].map((e) => e.cardId);
    assert.equal(aIds.length, 2);
    assert.equal(bIds.length, 2);
    assert.equal(aIds.filter((id) => bIds.includes(id)).length, 0, 'no card appears in both histories');
    assert.ok(game.players.A.piles.similar.every((e) => e.from === 'B'));
    assert.ok(game.players.B.piles.similar.every((e) => e.from === 'A'));

    // Each view shows its own piles as "you" and never swaps them.
    const va = viewFor(game, 'A');
    const vb = viewFor(game, 'B');
    assert.deepEqual(va.you.piles.similar.map((e) => e.cardId), game.players.A.piles.similar.map((e) => e.cardId));
    assert.deepEqual(vb.you.piles.similar.map((e) => e.cardId), game.players.B.piles.similar.map((e) => e.cardId));
    assert.deepEqual(va.opponent.piles, vb.you.piles);
    assert.deepEqual(vb.opponent.piles, va.you.piles);
  });
});

describe('turns, drawing and visibility', () => {
  test('a valid clue draws a replacement card and passes the turn', () => {
    const game = startedGame();
    const deck = game.deck.length;
    playClue(game, 'A', similarIn(game, 'A', 48), 'similar');
    assert.equal(game.players.A.hand.length, HAND_SIZE);
    assert.equal(game.deck.length, deck - 1);
    assert.equal(game.turn, 'B');
  });

  test("a player's view hides their own hidden card but shows the opponent's", () => {
    const game = startedGame();
    const v = viewFor(game, 'A');
    assert.equal(v.you.hidden, null);
    assert.equal(v.opponent.hidden.id, 48);
    assert.equal(v.opponent.hand, undefined, "opponent's hand stays private");
    assert.equal(v.opponent.handCount, HAND_SIZE);
  });
});

describe('guessing', () => {
  test('a correct guess wins', () => {
    const game = startedGame();
    makeGuess(game, 'A', 0);
    assert.equal(game.status, 'finished');
    assert.equal(game.result.winner, 'A');
    assert.equal(viewFor(game, 'A').you.hidden.id, 0, 'revealed after the game');
  });

  test('one guess per turn, and a wrong guess still requires a clue', () => {
    const game = startedGame();
    makeGuess(game, 'A', 1);
    assert.equal(game.players.A.guessesLeft, 2);
    assert.equal(game.turn, 'A', 'still A\'s turn');
    assert.throws(() => makeGuess(game, 'A', 2), /already guessed/);
    playClue(game, 'A', similarIn(game, 'A', 48), 'similar');
    assert.equal(game.turn, 'B');
  });

  test('cannot guess on the opponent\'s turn', () => {
    const game = startedGame();
    assert.throws(() => makeGuess(game, 'B', 48), /not your turn/);
  });

  test('three wrong guesses lose the game', () => {
    const game = startedGame();
    for (let i = 1; i <= 3; i++) {
      makeGuess(game, 'A', i);
      if (i < 3) {
        playClue(game, 'A', ...validPlay(game, 'A'));
        playClue(game, 'B', ...validPlay(game, 'B'));
      }
    }
    assert.equal(game.status, 'finished');
    assert.equal(game.result.winner, 'B');
  });
});

describe('end of deck', () => {
  test('when both hands run out the game is a draw', () => {
    const game = startedGame();
    let guard = 0;
    while (game.status === 'playing' && guard++ < 200) {
      const seat = game.turn;
      if (game.players[seat].hand.length === 0) passTurn(game, seat);
      else playClue(game, seat, ...validPlay(game, seat));
    }
    assert.equal(game.status, 'finished');
    assert.equal(game.result.winner, null);
    const total = ['A', 'B'].reduce((n, s) => n + game.players[s].piles.similar.length + game.players[s].piles.notSimilar.length, 0);
    assert.equal(total, 47, 'every non-hidden card ended up in exactly one clue pile');
  });
});
