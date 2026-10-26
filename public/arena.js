// The shared duel field. Both players see the same arena, mirrored so each
// player's own side is at the bottom. Elements tagged with data-anim are
// tracked between renders so cards can fly from where they were to where they land.

import { esc, cardHTML, backHTML, backArt, PILE_LABEL } from '/ui.js';

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function pips(left) {
  return `<span class="pips" aria-label="${left} guesses left">${[0, 1, 2].map((i) => `<i class="${i < left ? 'on' : ''}"></i>`).join('')}</span>`;
}

function fieldPile(piles, which, side, { target = false } = {}) {
  const entries = piles[which];
  const top = entries[entries.length - 1];
  const layers = Math.min(entries.length - 1, 3);
  const label = PILE_LABEL[which];
  return `<button class="fpile ${which} ${target ? 'target' : ''}" data-pile="${which}" data-side="${side}" data-anim="pile-${side}-${which}"
      aria-label="${label.en} pile, ${entries.length} cards">
    <div class="stack">
      ${Array.from({ length: layers }, (_, i) => `<div class="layer" style="--i:${layers - i}"></div>`).join('')}
      ${top ? cardHTML(top.card, { size: 'fcard', bare: true, attrs: `data-anim="top-${side}-${which}"` }) : '<div class="slot"></div>'}
      <span class="badge">${entries.length}</span>
    </div>
    <div class="plabel">${label.en}<span lang="he" dir="rtl">${label.he}</span></div>
  </button>`;
}

function lastAction(v) {
  const last = v.log[v.log.length - 1];
  return last ? esc(last.text) : '';
}

export function arenaHTML(v, { selected }) {
  const opp = v.opponent;
  const me = v.you;
  const finished = v.status === 'finished';
  const choosing = v.yourTurn && selected !== null;

  let banner;
  if (finished) {
    banner = v.result.winner === null ? 'Draw' : v.result.winner === me.seat ? 'You won!' : `${esc(opp.name)} won`;
  } else banner = v.yourTurn ? 'Your turn' : `${esc(opp.name)}'s turn`;

  let hint = '';
  if (!finished) {
    if (!v.yourTurn) hint = `Waiting for ${esc(opp.name)}…`;
    else if (me.hand.length === 0) hint = 'No cards left. Guess or pass.';
    else if (choosing) hint = `Tap ${esc(opp.name)}'s <b>Similar</b> or <b>Not similar</b> pile`;
    else if (me.guessedThisTurn) hint = 'Wrong guess. Now play a clue card.';
    else hint = `Pick a card to give ${esc(opp.name)} a clue`;
  }

  return `
  <div class="arena ${v.yourTurn ? 'my-turn' : ''} ${choosing ? 'choosing' : ''}">
    <section class="side opp-side">
      <div class="opp-hand" data-anim="opphand">
        ${Array.from({ length: opp.handCount }, (_, i) => backHTML('mini', { extra: 'ohc', attrs: `style="--k:${i - (opp.handCount - 1) / 2}"` })).join('')}
      </div>
      <div class="who"><b>${esc(opp.name)}</b>${pips(opp.guessesLeft)}</div>
      <div class="zone">
        ${fieldPile(opp.piles, 'similar', 'opp', { target: choosing })}
        <button class="hidden-slot opp-hidden" data-show-card="${opp.hidden.id}" aria-label="${esc(opp.name)}'s hidden card">
          ${cardHTML(opp.hidden, { size: 'fcard', extra: 'target-card' })}
        </button>
        ${fieldPile(opp.piles, 'notSimilar', 'opp', { target: choosing })}
      </div>
    </section>

    <section class="midline">
      <div class="deck" data-anim="deck" aria-label="${v.deckCount} cards in deck">
        ${v.deckCount > 0 ? `<div class="deck-stack">${backHTML('mini')}</div>` : '<div class="slot mini"></div>'}
        <span>${v.deckCount}</span>
      </div>
      <div class="banner ${finished ? 'done' : v.yourTurn ? 'mine' : ''}">${banner}</div>
      <button class="last" id="openLog">${lastAction(v)}</button>
    </section>

    <section class="side my-side">
      <div class="zone">
        ${fieldPile(me.piles, 'similar', 'me')}
        <div class="hidden-slot my-hidden">
          ${finished ? cardHTML(me.hidden, { size: 'fcard', bare: true, extra: 'revealed' }) : backHTML('fcard', { attrs: 'data-anim="my-hidden"' })}
          ${!finished ? `<button class="mini-btn guess" id="guess" ${v.yourTurn && !me.guessedThisTurn && me.guessesLeft > 0 ? '' : 'disabled'}>Guess</button>` : ''}
          ${!finished && v.yourTurn && me.hand.length === 0 ? '<button class="mini-btn" id="pass">Pass</button>' : ''}
          ${finished ? '<button class="mini-btn guess" id="newGame">New game</button>' : ''}
        </div>
        ${fieldPile(me.piles, 'notSimilar', 'me')}
      </div>
      <div class="who"><b>${esc(me.name)} (you)</b>${pips(me.guessesLeft)}</div>
    </section>

    <section class="hand-area">
      <div class="hint">${hint}</div>
      <div class="hand" style="--n:${me.hand.length}">
        ${me.hand.map((c, i) => cardHTML(c, {
          size: 'hand',
          extra: `pick ${selected === c.id ? 'selected' : ''}`,
          attrs: `data-card="${c.id}" data-anim="hand-${c.id}" role="button" tabindex="0" style="--k:${i - (me.hand.length - 1) / 2}"`,
        })).join('')}
      </div>
    </section>
  </div>`;
}

// ---------- animation ----------

export function captureRects(root) {
  const rects = {};
  root.querySelectorAll('[data-anim]').forEach((el) => { rects[el.dataset.anim] = el.getBoundingClientRect(); });
  return rects;
}

function ghostFrom(toEl, flip) {
  const ghost = document.createElement('div');
  ghost.className = 'ghost';
  const face = toEl.cloneNode(true);
  face.removeAttribute('data-anim');
  face.classList.remove('selected');
  face.style.cssText = 'width:100%;height:100%;margin:0;transform:none';
  if (flip) {
    ghost.innerHTML = '<div class="flipper"><div class="face front"></div><div class="face back-face"></div></div>';
    ghost.querySelector('.front').appendChild(face);
    ghost.querySelector('.back-face').innerHTML = `<div class="card back bare" style="width:100%;height:100%"><div class="art">${backArt()}</div></div>`;
  } else {
    ghost.appendChild(face);
  }
  return ghost;
}

/** Fly a copy of `toEl` from rect `from` to where `toEl` now sits. */
function fly(from, toEl, { flip = false, delay = 0, duration = 600 } = {}) {
  if (!from || !toEl) return;
  const to = toEl.getBoundingClientRect();
  if (!to.width) return;
  const ghost = ghostFrom(toEl, flip);
  Object.assign(ghost.style, { left: `${to.left}px`, top: `${to.top}px`, width: `${to.width}px`, height: `${to.height}px` });
  document.body.appendChild(ghost);
  toEl.style.visibility = 'hidden';
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  const s = from.width / to.width;
  const move = ghost.animate([
    { transform: `translate(${dx}px, ${dy}px) scale(${s}) rotate(-6deg)` },
    { transform: `translate(${dx * 0.25}px, ${dy * 0.25 - 30}px) scale(1.25) rotate(4deg)`, offset: 0.65 },
    { transform: 'none' },
  ], { duration, delay, easing: 'cubic-bezier(.25,.8,.3,1)', fill: 'backwards' });
  if (flip) {
    ghost.querySelector('.flipper').animate(
      [{ transform: 'rotateY(180deg)' }, { transform: 'rotateY(180deg)', offset: 0.3 }, { transform: 'rotateY(0deg)' }],
      { duration, delay, easing: 'ease-in-out', fill: 'backwards' },
    );
  }
  move.finished.then(() => {
    ghost.remove();
    toEl.style.visibility = '';
    toEl.animate([{ transform: 'scale(1.12)' }, { transform: 'none' }], { duration: 250, easing: 'ease-out' });
  });
}

/** Slide elements that only moved (e.g. remaining hand cards closing the gap). */
function slide(from, el) {
  if (!from || !el) return;
  const to = el.getBoundingClientRect();
  const dx = from.left - to.left;
  const dy = from.top - to.top;
  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
  el.animate([{ translate: `${dx}px ${dy}px` }, { translate: '0 0' }], { duration: 350, easing: 'ease-out' });
}

export function animateChanges(prev, next, before, root) {
  if (!prev || !before || !prev.opponent || prev.code !== next.code || reduceMotion()) return;
  const q = (key) => root.querySelector(`[data-anim="${key}"]`);
  const sides = [['me', 'you'], ['opp', 'opponent']];
  let played = false;
  let oppPlayed = false;

  for (const [side, owner] of sides) {
    for (const pile of ['similar', 'notSimilar']) {
      const added = next[owner].piles[pile].slice(prev[owner].piles[pile].length);
      for (const e of added) {
        const target = q(`top-${side}-${pile}`);
        if (e.from === next.you.seat) {
          played = true;
          fly(before[`hand-${e.cardId}`], target);
        } else {
          oppPlayed = true;
          fly(before.opphand, target, { flip: true, duration: 750 });
        }
      }
    }
  }

  const prevHand = new Set(prev.you.hand.map((c) => c.id));
  for (const c of next.you.hand) {
    const el = q(`hand-${c.id}`);
    if (prevHand.has(c.id)) slide(before[`hand-${c.id}`], el);
    else fly(before.deck, el, { flip: true, delay: played ? 450 : 0, duration: 650 });
  }

  if (oppPlayed && next.deckCount < prev.deckCount) {
    const backs = root.querySelectorAll('.opp-hand .ohc');
    fly(before.deck, backs[backs.length - 1], { delay: 600, duration: 500 });
  }
}

/** A wrong pile: the card flies toward the pile, shakes and returns to the hand. */
export function bounceBack(root, cardId, pile) {
  const card = root.querySelector(`[data-anim="hand-${cardId}"]`);
  const target = root.querySelector(`[data-anim="pile-opp-${pile}"]`);
  if (!card || !target) return;
  target.classList.add('deny');
  setTimeout(() => target.classList.remove('deny'), 900);
  if (reduceMotion()) return;
  const a = card.getBoundingClientRect();
  const b = target.getBoundingClientRect();
  const dx = (b.left + b.width / 2 - (a.left + a.width / 2)) * 0.8;
  const dy = (b.top + b.height / 2 - (a.top + a.height / 2)) * 0.8;
  const at = (x, r) => `translate(${dx + x}px, ${dy}px) scale(.85) rotate(${r}deg)`;
  card.animate([
    { transform: 'translateY(-14px)' },
    { transform: at(0, 0), offset: 0.3 },
    { transform: at(-7, -6), offset: 0.4 },
    { transform: at(7, 6), offset: 0.5 },
    { transform: at(-5, -4), offset: 0.6 },
    { transform: at(0, 0), offset: 0.68 },
    { transform: 'translateY(-14px)' },
  ], { duration: 1100, easing: 'ease-in-out' });
}
