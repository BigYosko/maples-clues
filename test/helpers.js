import { CARDS, isSimilar } from '../src/cards.js';
import { createGame, joinGame } from '../src/game.js';

/** A started game where A goes first and both hidden cards are known. */
export function startedGame({ hiddenA = 0, hiddenB = 48 } = {}) {
  const game = createGame({ code: 'TEST1', name: 'Alice', token: 'tok-a' });
  let i = 0;
  joinGame(game, { name: 'Bob', token: 'tok-b', rng: () => ((i++ * 0.37) % 1) });
  rig(game, { hiddenA, hiddenB });
  return game;
}

/**
 * Deals fixed hands: each hand holds both similar and not-similar cards for
 * the opponent's hidden card, so every routing case is testable.
 */
export function rig(game, { hiddenA, hiddenB }) {
  const rest = CARDS.map((c) => c.id).filter((id) => id !== hiddenA && id !== hiddenB);
  const pick = (target, similar, n, used) => {
    const out = rest.filter((id) => !used.has(id) && isSimilar(CARDS[id], CARDS[target]) === similar).slice(0, n);
    out.forEach((id) => used.add(id));
    return out;
  };
  const used = new Set();
  game.players.A.hidden = hiddenA;
  game.players.B.hidden = hiddenB;
  // A gives clues about B's hidden card and vice versa.
  game.players.A.hand = [...pick(hiddenB, true, 3, used), ...pick(hiddenB, false, 2, used)];
  game.players.B.hand = [...pick(hiddenA, true, 3, used), ...pick(hiddenA, false, 2, used)];
  game.deck = rest.filter((id) => !used.has(id));
  game.turn = 'A';
  game.turnNumber = 1;
  return game;
}

export const similarIn = (game, seat, target) => game.players[seat].hand.find((id) => isSimilar(CARDS[id], CARDS[target]));
export const notSimilarIn = (game, seat, target) => game.players[seat].hand.find((id) => !isSimilar(CARDS[id], CARDS[target]));

/** The first card in hand together with the pile it legally belongs in. */
export function validPlay(game, seat) {
  const target = game.players[seat === 'A' ? 'B' : 'A'].hidden;
  const id = game.players[seat].hand[0];
  return [id, isSimilar(CARDS[id], CARDS[target]) ? 'similar' : 'notSimilar'];
}
