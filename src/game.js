// Pure game logic. All functions take a game state object and either mutate it
// for a valid move or throw a GameError without touching it.

import { CARDS, cardById, isSimilar, describeCard } from './cards.js';

export const HAND_SIZE = 5;
export const MAX_GUESSES = 3;
export const PILES = ['similar', 'notSimilar'];
export const SEATS = ['A', 'B'];

export class GameError extends Error {}

export function otherSeat(seat) {
  return seat === 'A' ? 'B' : 'A';
}

function shuffle(list, rng) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function newPlayer(name, token) {
  return {
    name,
    token,
    hidden: null,
    hand: [],
    // Personal clue piles: clues the OPPONENT gave about THIS player's hidden card.
    piles: { similar: [], notSimilar: [] },
    guessesLeft: MAX_GUESSES,
    guessedThisTurn: false,
    guesses: [],
  };
}

export function createGame({ code, name, token, now = Date.now() }) {
  return {
    code,
    createdAt: now,
    updatedAt: now,
    status: 'waiting', // waiting | playing | finished
    players: { A: newPlayer(name, token), B: null },
    deck: [],
    turn: null,
    turnNumber: 0,
    result: null, // { winner: 'A' | 'B' | null, reason }
    log: [],
    version: 0,
  };
}

function touch(game) {
  game.version += 1;
  game.updatedAt = Date.now();
}

function addLog(game, text) {
  game.log.push({ n: game.log.length + 1, text });
  if (game.log.length > 100) game.log.shift();
}

export function joinGame(game, { name, token, rng = Math.random }) {
  if (game.players.B) throw new GameError('This game already has two players.');
  game.players.B = newPlayer(name, token);
  const ids = shuffle(CARDS.map((c) => c.id), rng);
  for (const seat of SEATS) {
    const p = game.players[seat];
    p.hidden = ids.pop();
    p.hand = ids.splice(-HAND_SIZE, HAND_SIZE);
  }
  game.deck = ids;
  game.turn = rng() < 0.5 ? 'A' : 'B';
  game.turnNumber = 1;
  game.status = 'playing';
  addLog(game, `${game.players.B.name} joined. ${game.players[game.turn].name} goes first.`);
  touch(game);
}

export function seatForToken(game, token) {
  if (!token) return null;
  return SEATS.find((s) => game.players[s] && game.players[s].token === token) || null;
}

function requireTurn(game, seat) {
  if (game.status !== 'playing') throw new GameError('The game is not in progress.');
  if (!SEATS.includes(seat) || !game.players[seat]) throw new GameError('Unknown player.');
  if (game.turn !== seat) throw new GameError("It's not your turn.");
}

function endTurn(game) {
  const current = game.players[game.turn];
  current.guessedThisTurn = false;
  game.turn = otherSeat(game.turn);
  game.turnNumber += 1;
  const a = game.players.A;
  const b = game.players.B;
  if (game.deck.length === 0 && a.hand.length === 0 && b.hand.length === 0) {
    game.status = 'finished';
    game.result = { winner: null, reason: 'Both hands are empty. The game is a draw.' };
    addLog(game, game.result.reason);
  }
}

/**
 * The current player gives a clue about the opponent's hidden card by placing
 * one of their hand cards in the opponent's "similar" or "notSimilar" pile.
 * The server checks the choice against the recipient's real hidden card; a
 * wrong choice is rejected and changes nothing.
 */
export function playClue(game, seat, cardId, pile) {
  requireTurn(game, seat);
  if (!PILES.includes(pile)) throw new GameError('Choose the Similar or Not similar pile.');
  const giver = game.players[seat];
  const idx = giver.hand.indexOf(cardId);
  if (idx === -1) throw new GameError('That card is not in your hand.');

  const recipientSeat = otherSeat(seat);
  const recipient = game.players[recipientSeat];
  const card = cardById(cardId);
  const correctPile = isSimilar(card, cardById(recipient.hidden)) ? 'similar' : 'notSimilar';
  if (pile !== correctPile) {
    throw new GameError(
      pile === 'similar'
        ? `Not quite: that card shares nothing with ${recipient.name}'s hidden card. It belongs in Not similar.`
        : `Not quite: that card shares an attribute with ${recipient.name}'s hidden card. It belongs in Similar.`,
    );
  }

  giver.hand.splice(idx, 1);
  recipient.piles[pile].push({ cardId, from: seat, turn: game.turnNumber });
  if (game.deck.length > 0) giver.hand.push(game.deck.pop());
  addLog(
    game,
    `${giver.name} put ${describeCard(card)} in ${recipient.name}'s ${pile === 'similar' ? 'Similar' : 'Not similar'} pile.`,
  );
  endTurn(game);
  touch(game);
  return { recipient: recipientSeat, pile };
}

/**
 * Guess your own hidden card. One guess per turn, three per game. A wrong guess
 * still requires playing a clue card (if you have one) to finish the turn.
 */
export function makeGuess(game, seat, cardId) {
  requireTurn(game, seat);
  const p = game.players[seat];
  if (p.guessedThisTurn) throw new GameError('You already guessed this turn. Play a clue card to finish your turn.');
  if (p.guessesLeft <= 0) throw new GameError('You have no guesses left.');
  const card = cardById(cardId);
  if (!card) throw new GameError('Unknown card.');

  p.guessesLeft -= 1;
  p.guessedThisTurn = true;
  const correct = cardId === p.hidden;
  p.guesses.push({ cardId, correct, turn: game.turnNumber });

  if (correct) {
    game.status = 'finished';
    game.result = { winner: seat, reason: `${p.name} guessed their hidden card!` };
    addLog(game, `${p.name} guessed ${describeCard(card)}. Correct! ${p.name} wins.`);
  } else if (p.guessesLeft === 0) {
    const opp = otherSeat(seat);
    game.status = 'finished';
    game.result = { winner: opp, reason: `${p.name} used all ${MAX_GUESSES} guesses.` };
    addLog(game, `${p.name} guessed ${describeCard(card)}. Wrong, and that was the last guess. ${game.players[opp].name} wins.`);
  } else {
    addLog(game, `${p.name} guessed ${describeCard(card)}. Wrong. ${p.guessesLeft} guess${p.guessesLeft === 1 ? '' : 'es'} left.`);
    if (p.hand.length === 0) endTurn(game);
  }
  touch(game);
  return { correct };
}

/** Only allowed when you have no cards left to give as clues. */
export function passTurn(game, seat) {
  requireTurn(game, seat);
  const p = game.players[seat];
  if (p.hand.length > 0) throw new GameError('You must play a clue card.');
  addLog(game, `${p.name} has no cards and passes.`);
  endTurn(game);
  touch(game);
}

const pileView = (piles) => ({
  similar: piles.similar.map((e) => ({ ...e, card: cardById(e.cardId) })),
  notSimilar: piles.notSimilar.map((e) => ({ ...e, card: cardById(e.cardId) })),
});

/** What one seat is allowed to see. Never includes the viewer's own hidden card while playing. */
export function viewFor(game, seat) {
  const me = game.players[seat];
  const oppSeat = otherSeat(seat);
  const opp = game.players[oppSeat];
  const finished = game.status === 'finished';
  return {
    code: game.code,
    version: game.version,
    status: game.status,
    turn: game.turn,
    turnNumber: game.turnNumber,
    yourTurn: game.status === 'playing' && game.turn === seat,
    deckCount: game.deck.length,
    result: game.result,
    log: game.log.slice(-30),
    you: {
      seat,
      name: me.name,
      hand: me.hand.map(cardById),
      hidden: finished ? cardById(me.hidden) : null,
      piles: pileView(me.piles),
      guessesLeft: me.guessesLeft,
      guessedThisTurn: me.guessedThisTurn,
      guesses: me.guesses.map((g) => ({ ...g, card: cardById(g.cardId) })),
    },
    opponent: opp
      ? {
          seat: oppSeat,
          name: opp.name,
          // You can see the opponent's hidden card: that's the card you give clues about.
          hidden: opp.hidden === null ? null : cardById(opp.hidden),
          handCount: opp.hand.length,
          piles: pileView(opp.piles),
          guessesLeft: opp.guessesLeft,
          guesses: opp.guesses.map((g) => ({ ...g, card: cardById(g.cardId) })),
        }
      : null,
  };
}
