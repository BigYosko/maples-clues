// Keeps games in memory and mirrors them to a JSON file so refreshes,
// reconnects and server restarts don't lose any state.

import fs from 'node:fs';
import path from 'node:path';

const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export class GameStore {
  constructor(file) {
    this.file = file;
    this.games = new Map();
    this.load();
  }

  load() {
    if (!this.file || !fs.existsSync(this.file)) return;
    try {
      const data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      const cutoff = Date.now() - MAX_AGE_MS;
      for (const game of data.games || []) {
        if (game.updatedAt >= cutoff) this.games.set(game.code, game);
      }
    } catch (err) {
      console.error(`Could not read ${this.file}: ${err.message}`);
    }
  }

  save() {
    if (!this.file) return;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify({ games: [...this.games.values()] }));
    fs.renameSync(tmp, this.file);
  }

  get(code) {
    return this.games.get(String(code || '').toUpperCase()) || null;
  }

  add(game) {
    this.games.set(game.code, game);
    this.save();
  }

  has(code) {
    return this.games.has(code);
  }
}
