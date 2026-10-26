import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { GameStore } from './store.js';
import {
  GameError, createGame, joinGame, seatForToken, playClue, makeGuess, passTurn, viewFor,
} from './game.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const STATIC = {
  '/shared/cards.js': path.join(ROOT, 'src', 'cards.js'),
};
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
};
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function newCode(store) {
  for (;;) {
    let code = '';
    for (let i = 0; i < 5; i++) code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
    if (!store.has(code)) return code;
  }
}

function cleanName(name) {
  const n = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 20);
  return n || 'Player';
}

function serveStatic(req, res) {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/healthz') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    return res.end('ok');
  }
  let file = STATIC[url.pathname];
  if (!file) {
    let rel;
    try {
      rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
    } catch {
      rel = '';
    }
    file = path.join(PUBLIC_DIR, rel);
    if (!rel || !file.startsWith(PUBLIC_DIR + path.sep)) {
      res.writeHead(403);
      return res.end();
    }
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      return res.end('Not found');
    }
    res.writeHead(200, {
      'content-type': MIME[path.extname(file)] || 'application/octet-stream',
      'cache-control': 'no-cache',
    });
    res.end(data);
  });
}

export function startServer({ port = 0, dataFile = null, rng = Math.random } = {}) {
  const store = new GameStore(dataFile);
  const server = http.createServer(serveStatic);
  const wss = new WebSocketServer({ server, maxPayload: 4096 });
  const rooms = new Map(); // code -> Set<ws>

  const send = (ws, msg) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  };

  function broadcast(game) {
    for (const ws of rooms.get(game.code) || []) {
      send(ws, { type: 'state', state: viewFor(game, ws.seat) });
    }
  }

  function attach(ws, game, seat) {
    if (ws.code && rooms.has(ws.code)) rooms.get(ws.code).delete(ws);
    ws.code = game.code;
    ws.seat = seat;
    if (!rooms.has(game.code)) rooms.set(game.code, new Set());
    rooms.get(game.code).add(ws);
    send(ws, { type: 'joined', code: game.code, seat, token: game.players[seat].token });
  }

  function handle(ws, msg) {
    switch (msg.type) {
      case 'create': {
        const game = createGame({ code: newCode(store), name: cleanName(msg.name), token: crypto.randomUUID() });
        store.add(game);
        attach(ws, game, 'A');
        return broadcast(game);
      }
      case 'join': {
        const game = store.get(msg.code);
        if (!game) throw new GameError('No game with that code.');
        // A device that already holds a seat in this game just resumes it.
        const existing = seatForToken(game, msg.token);
        if (existing) {
          attach(ws, game, existing);
          return broadcast(game);
        }
        joinGame(game, { name: cleanName(msg.name), token: crypto.randomUUID(), rng });
        store.save();
        attach(ws, game, 'B');
        return broadcast(game);
      }
      case 'resume': {
        const game = store.get(msg.code);
        if (!game) throw new GameError('That game no longer exists.');
        const seat = seatForToken(game, msg.token);
        if (!seat) throw new GameError('This device is not a player in that game.');
        attach(ws, game, seat);
        return broadcast(game);
      }
      case 'play':
      case 'guess':
      case 'pass': {
        const game = ws.code && store.get(ws.code);
        if (!game) throw new GameError('You are not in a game.');
        // The acting seat always comes from the connection, never from the message.
        if (msg.type === 'play') playClue(game, ws.seat, Number(msg.cardId), msg.pile);
        else if (msg.type === 'guess') makeGuess(game, ws.seat, Number(msg.cardId));
        else passTurn(game, ws.seat);
        store.save();
        return broadcast(game);
      }
      default:
        throw new GameError('Unknown request.');
    }
  }

  wss.on('connection', (ws) => {
    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        return send(ws, { type: 'error', message: 'Bad message.' });
      }
      try {
        handle(ws, msg);
      } catch (err) {
        if (!(err instanceof GameError)) console.error(err);
        send(ws, {
          type: 'error',
          request: msg.type,
          message: err instanceof GameError ? err.message : 'Something went wrong.',
        });
      }
    });
    ws.on('close', () => {
      if (ws.code && rooms.has(ws.code)) rooms.get(ws.code).delete(ws);
    });
  });

  // Keep idle connections alive through proxies (Render closes idle sockets).
  const ping = setInterval(() => {
    for (const ws of wss.clients) ws.ping();
  }, 25000);

  return new Promise((resolve) => {
    server.listen(port, () => {
      const actualPort = server.address().port;
      resolve({
        port: actualPort,
        store,
        close: () =>
          new Promise((done) => {
            clearInterval(ping);
            for (const ws of wss.clients) ws.terminate();
            wss.close();
            server.close(() => done());
          }),
      });
    });
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 3000;
  const dataFile = process.env.DATA_FILE || path.join(ROOT, 'data', 'games.json');
  startServer({ port, dataFile }).then(({ port: p }) => {
    console.log(`Maple's Clues running on http://localhost:${p}`);
  });
}
