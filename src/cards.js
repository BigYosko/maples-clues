// Card definitions shared by the server and the browser (served at /shared/cards.js).

export const ANIMALS = [
  { key: 'maple', name: 'Maple', full: 'Maple the British brown cat' },
  { key: 'dog', name: 'Dog', full: 'Dog' },
  { key: 'rabbit', name: 'Rabbit', full: 'Rabbit' },
  { key: 'owl', name: 'Owl', full: 'Owl' },
  { key: 'fox', name: 'Fox', full: 'Fox' },
  { key: 'turtle', name: 'Turtle', full: 'Turtle' },
  { key: 'elephant', name: 'Elephant', full: 'Elephant' },
];

export const ACCESSORIES = [
  { key: 'hat', name: 'Top hat' },
  { key: 'glasses', name: 'Glasses' },
  { key: 'scarf', name: 'Scarf' },
  { key: 'bowtie', name: 'Bow tie' },
  { key: 'backpack', name: 'Backpack' },
  { key: 'crown', name: 'Crown' },
  { key: 'umbrella', name: 'Umbrella' },
];

export const LOCATIONS = [
  { key: 'beach', name: 'Beach' },
  { key: 'forest', name: 'Forest' },
  { key: 'kitchen', name: 'Kitchen' },
  { key: 'park', name: 'Park' },
  { key: 'library', name: 'Library' },
  { key: 'mountain', name: 'Mountain' },
  { key: 'garden', name: 'Garden' },
];

const N = ANIMALS.length; // 7

// 49 cards forming a Latin square: location = (animal + accessory) mod 7.
// Each animal, accessory and location appears exactly 7 times, and any two
// different cards share at most one attribute.
export const CARDS = Array.from({ length: N * N }, (_, id) => {
  const animal = Math.floor(id / N);
  const accessory = id % N;
  return { id, animal, accessory, location: (animal + accessory) % N };
});

export function cardById(id) {
  return CARDS[id];
}

export function sharedAttributes(a, b) {
  const shared = [];
  if (a.animal === b.animal) shared.push('animal');
  if (a.accessory === b.accessory) shared.push('accessory');
  if (a.location === b.location) shared.push('location');
  return shared;
}

// "Similar" (דומה) = shares at least one attribute with the hidden card.
export function isSimilar(a, b) {
  return sharedAttributes(a, b).length > 0;
}

export function describeCard(card) {
  return `${ANIMALS[card.animal].name} · ${ACCESSORIES[card.accessory].name} · ${LOCATIONS[card.location].name}`;
}
