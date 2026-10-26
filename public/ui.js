// Small shared rendering helpers for cards.

import { ANIMALS, ACCESSORIES, LOCATIONS } from '/shared/cards.js';
import { cardArt, cardBackArt } from '/art.js';

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const PILE_LABEL = {
  similar: { en: 'Similar', he: 'דומה' },
  notSimilar: { en: 'Not similar', he: 'לא דומה' },
};

const keysOf = (c) => ({ animal: ANIMALS[c.animal].key, accessory: ACCESSORIES[c.accessory].key, location: LOCATIONS[c.location].key });
const artCache = new Map();
export function art(card) {
  if (!artCache.has(card.id)) artCache.set(card.id, cardArt(card, keysOf(card)));
  return artCache.get(card.id);
}

export const cardName = (c) => `${ANIMALS[c.animal].name}, ${ACCESSORIES[c.accessory].name}, ${LOCATIONS[c.location].name}`;

/** A card face. `bare` hides the text label (art only). */
export function cardHTML(card, { size = 'md', extra = '', attrs = '', bare = false } = {}) {
  return `<div class="card ${size} ${bare ? 'bare' : ''} ${extra}" ${attrs} aria-label="${esc(cardName(card))}">
    <div class="art">${art(card)}</div>
    ${bare ? '' : `<div class="lbl"><b>${ANIMALS[card.animal].name}</b><span>${ACCESSORIES[card.accessory].name}</span><span>${LOCATIONS[card.location].name}</span></div>`}
  </div>`;
}

export function backHTML(size = 'md', { label = '', extra = '', attrs = '' } = {}) {
  return `<div class="card back ${size} ${label ? '' : 'bare'} ${extra}" ${attrs}>
    <div class="art">${cardBackArt()}</div>
    ${label ? `<div class="lbl"><b>?</b><span>${label}</span></div>` : ''}
  </div>`;
}

export const backArt = () => cardBackArt();
