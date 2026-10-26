// Hand-drawn SVG card art. Each card = location background + animal + accessory.
// Scene coordinates are a 100x100 box.

const INK = '#2b2118';
const line = `stroke="${INK}" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round"`;

// ---------- Locations ----------

const LOCATIONS = {
  beach: () => `
    <rect width="100" height="100" fill="#bfe6ff"/>
    <circle cx="82" cy="16" r="8" fill="#ffd54a"/>
    <rect y="52" width="100" height="18" fill="#4fb3e8"/>
    <path d="M0 56 q8 -3 16 0 t16 0 t16 0 t16 0 t16 0 t20 0" fill="none" stroke="#e3f6ff" stroke-width="1.2"/>
    <rect y="68" width="100" height="32" fill="#f3d99b"/>
    <path d="M6 84 l6 -2 M88 90 l5 -1" stroke="#d9b56a" stroke-width="1.2"/>
    <path d="M10 70 q-2 -18 6 -26" fill="none" stroke="#8a5a2b" stroke-width="2"/>
    <path d="M16 44 q-10 -2 -14 6 M16 44 q8 -6 14 -2 M16 44 q-4 -8 -12 -8 M16 44 q4 -8 12 -6" fill="none" stroke="#3a9a4a" stroke-width="2.2"/>`,
  forest: () => `
    <rect width="100" height="100" fill="#d8efd0"/>
    <rect y="74" width="100" height="26" fill="#6aa84f"/>
    ${[[10, 30, 0.9], [88, 26, 1], [24, 40, 0.7], [76, 40, 0.75]].map(([x, y, s]) => `
      <g transform="translate(${x} ${y}) scale(${s})">
        <rect x="-3" y="34" width="6" height="14" fill="#7a4e2a"/>
        <polygon points="0,-6 -16,22 16,22" fill="#2f7d3a"/>
        <polygon points="0,6 -18,38 18,38" fill="#28703a"/>
      </g>`).join('')}
    <circle cx="70" cy="86" r="2" fill="#e05555"/><circle cx="20" cy="90" r="2" fill="#e05555"/>`,
  kitchen: () => `
    <rect width="100" height="100" fill="#fff4dc"/>
    ${Array.from({ length: 5 }, (_, r) => Array.from({ length: 10 }, (_, c) =>
      `<rect x="${c * 10}" y="${r * 10}" width="10" height="10" fill="none" stroke="#f0dfb8" stroke-width="0.6"/>`).join('')).join('')}
    <rect x="62" y="8" width="30" height="24" rx="2" fill="#bfe6ff" stroke="#c49a6c" stroke-width="2"/>
    <line x1="77" y1="8" x2="77" y2="32" stroke="#c49a6c" stroke-width="1.5"/>
    <rect y="50" width="100" height="8" fill="#b9825a"/>
    <rect y="58" width="100" height="42" fill="#e9c9a0"/>
    ${Array.from({ length: 5 }, (_, i) => `<rect x="${i * 20}" y="80" width="10" height="10" fill="#d9b48a"/><rect x="${i * 20 + 10}" y="90" width="10" height="10" fill="#d9b48a"/>`).join('')}
    <g transform="translate(14 30)"><circle r="8" fill="#555"/><rect x="7" y="-1.5" width="10" height="3" fill="#555"/></g>
    <path d="M10 50 q0 -6 4 -6 h4 q4 0 4 6 z" fill="#d04a3a"/>`,
  park: () => `
    <rect width="100" height="100" fill="#cdeafe"/>
    <g fill="#fff"><circle cx="20" cy="16" r="6"/><circle cx="28" cy="14" r="8"/><circle cx="36" cy="17" r="5"/></g>
    <rect y="66" width="100" height="34" fill="#8fd16a"/>
    <rect x="80" y="40" width="5" height="30" fill="#7a4e2a"/>
    <circle cx="82" cy="34" r="16" fill="#4caf50"/>
    <g fill="#a86a3c">
      <rect x="4" y="66" width="22" height="3"/><rect x="4" y="60" width="22" height="3"/>
      <rect x="6" y="66" width="2" height="9"/><rect x="22" y="66" width="2" height="9"/>
    </g>
    <path d="M0 90 q50 -10 100 0 v10 h-100 z" fill="#e8d6a6"/>`,
  library: () => `
    <rect width="100" height="100" fill="#8a5a3b"/>
    ${[6, 30].map((y) => `
      <rect x="0" y="${y + 20}" width="100" height="3" fill="#5c3a22"/>
      ${Array.from({ length: 14 }, (_, i) => {
        const colors = ['#c0392b', '#2e86c1', '#27ae60', '#f1c40f', '#8e44ad', '#e67e22', '#16a085'];
        const h = 14 + ((i * 7 + y) % 6);
        return `<rect x="${2 + i * 7}" y="${y + 20 - h}" width="6" height="${h}" fill="${colors[(i + y) % colors.length]}"/>`;
      }).join('')}`).join('')}
    <rect y="62" width="100" height="38" fill="#b07a4f"/>
    ${Array.from({ length: 6 }, (_, i) => `<line x1="${i * 20}" y1="62" x2="${i * 20 - 8}" y2="100" stroke="#9a6640" stroke-width="1"/>`).join('')}
    <rect x="6" y="80" width="18" height="3" fill="#7a2e2e"/>`,
  mountain: () => `
    <rect width="100" height="100" fill="#d6ecff"/>
    <polygon points="-10,72 28,14 66,72" fill="#8a96a8"/>
    <polygon points="28,14 19,28 25,26 31,30 37,27" fill="#fff"/>
    <polygon points="40,72 76,22 112,72" fill="#7a8698"/>
    <polygon points="76,22 68,34 74,32 80,36 84,33" fill="#fff"/>
    <rect y="70" width="100" height="30" fill="#9cc58a"/>
    <path d="M0 78 q25 -6 50 0 t50 0 v22 h-100z" fill="#86b374"/>`,
  garden: () => `
    <rect width="100" height="100" fill="#e2f4ff"/>
    ${Array.from({ length: 11 }, (_, i) => `<path d="M${i * 10 + 1} 66 v-20 l4 -4 l4 4 v20 z" fill="#fffaf0" stroke="#d8ccb4" stroke-width="0.6"/>`).join('')}
    <rect y="52" width="100" height="3" fill="#fffaf0" stroke="#d8ccb4" stroke-width="0.4"/>
    <rect y="66" width="100" height="34" fill="#7cc35a"/>
    ${[[8, 80, '#e84d6f'], [20, 92, '#f5b82e'], [86, 82, '#9b59b6'], [74, 94, '#e84d6f'], [94, 72, '#f5b82e']].map(([x, y, c]) => `
      <line x1="${x}" y1="${y}" x2="${x}" y2="${y + 8}" stroke="#2f7d3a" stroke-width="1.2"/>
      <g fill="${c}"><circle cx="${x - 2.5}" cy="${y}" r="2.2"/><circle cx="${x + 2.5}" cy="${y}" r="2.2"/><circle cx="${x}" cy="${y - 2.5}" r="2.2"/><circle cx="${x}" cy="${y + 2.5}" r="2.2"/></g>
      <circle cx="${x}" cy="${y}" r="1.6" fill="#fff3b0"/>`).join('')}`,
};

// ---------- Animals ----------
// Each animal has a drawing plus anchor points where accessories attach:
// top (head top), eyes (center + spacing), neck, back (for a backpack), paw (holds an umbrella).

const eye = (x, y, r = 1.6) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${INK}"/><circle cx="${x + r * 0.35}" cy="${y - r * 0.35}" r="${r * 0.35}" fill="#fff"/>`;

const ANIMALS = {
  maple: {
    // British Shorthair: round chubby face, short ears, dense brown coat, copper eyes.
    draw: () => `
      <path d="M68 82 q16 -2 14 -18 q-1 -6 -5 -4 q2 10 -10 14" fill="#7b4a26" ${line}/>
      <ellipse cx="50" cy="74" rx="21" ry="16" fill="#8b5a2b" ${line}/>
      <ellipse cx="50" cy="78" rx="10" ry="9" fill="#a8743f"/>
      <path d="M35 40 l1 -12 l10 7 z M65 40 l-1 -12 l-10 7 z" fill="#7b4a26" ${line}/>
      <path d="M37.5 37 l0.8 -6 l5 4 z M62.5 37 l-0.8 -6 l-5 4 z" fill="#d9967a"/>
      <ellipse cx="50" cy="48" rx="18" ry="15" fill="#8b5a2b" ${line}/>
      <path d="M44 36 l2 4 M50 35 v4 M56 36 l-2 4" stroke="#6b3e1c" stroke-width="1.2"/>
      <ellipse cx="50" cy="54" rx="8" ry="5.5" fill="#b07d4a"/>
      <circle cx="43.5" cy="47" r="3.4" fill="#e3912a"/><circle cx="56.5" cy="47" r="3.4" fill="#e3912a"/>
      <ellipse cx="43.5" cy="47" rx="1.2" ry="2.6" fill="${INK}"/><ellipse cx="56.5" cy="47" rx="1.2" ry="2.6" fill="${INK}"/>
      <path d="M48.5 52 h3 l-1.5 1.8 z" fill="#d97a8a"/>
      <path d="M50 53.8 q-1.5 2 -3.2 1.2 M50 53.8 q1.5 2 3.2 1.2" fill="none" stroke="${INK}" stroke-width="0.8"/>
      <path d="M41 53 l-9 -1 M41 55 l-9 2 M59 53 l9 -1 M59 55 l9 2" stroke="#f3e6d4" stroke-width="0.6"/>
      <ellipse cx="42" cy="88" rx="5" ry="3" fill="#7b4a26" ${line}/><ellipse cx="58" cy="88" rx="5" ry="3" fill="#7b4a26" ${line}/>`,
    top: [50, 33], eyes: [50, 47, 13], neck: [50, 62, 16], back: [26, 70], paw: [70, 72],
  },
  dog: {
    draw: () => `
      <path d="M69 72 q10 -4 10 -14" fill="none" stroke="#c98c45" stroke-width="3.5" stroke-linecap="round"/>
      <ellipse cx="50" cy="75" rx="20" ry="14" fill="#e0a95f" ${line}/>
      <ellipse cx="50" cy="78" rx="9" ry="8" fill="#f4dcb4"/>
      <circle cx="50" cy="48" r="14" fill="#e0a95f" ${line}/>
      <ellipse cx="36" cy="50" rx="5" ry="10" fill="#9a6230" ${line} transform="rotate(12 36 50)"/>
      <ellipse cx="64" cy="50" rx="5" ry="10" fill="#9a6230" ${line} transform="rotate(-12 64 50)"/>
      <ellipse cx="50" cy="55" rx="7.5" ry="5.5" fill="#f4dcb4" ${line}/>
      <ellipse cx="50" cy="52.5" rx="2.6" ry="1.8" fill="${INK}"/>
      <path d="M50 54.5 v2 q-2 2 -4 0 M50 56.5 q2 2 4 0" fill="none" stroke="${INK}" stroke-width="0.8"/>
      ${eye(45, 45)}${eye(55, 45)}
      <ellipse cx="42" cy="88" rx="5" ry="3" fill="#c98c45" ${line}/><ellipse cx="58" cy="88" rx="5" ry="3" fill="#c98c45" ${line}/>`,
    top: [50, 35], eyes: [50, 45, 10], neck: [50, 62, 14], back: [27, 72], paw: [70, 74],
  },
  rabbit: {
    draw: () => `
      <circle cx="69" cy="80" r="5" fill="#fff" ${line}/>
      <ellipse cx="50" cy="77" rx="17" ry="13" fill="#f2f2f2" ${line}/>
      <ellipse cx="44" cy="32" rx="4.5" ry="14" fill="#f2f2f2" ${line} transform="rotate(-8 44 32)"/>
      <ellipse cx="56" cy="32" rx="4.5" ry="14" fill="#f2f2f2" ${line} transform="rotate(8 56 32)"/>
      <ellipse cx="44" cy="32" rx="2" ry="10" fill="#f6b6c4" transform="rotate(-8 44 32)"/>
      <ellipse cx="56" cy="32" rx="2" ry="10" fill="#f6b6c4" transform="rotate(8 56 32)"/>
      <circle cx="50" cy="53" r="12" fill="#f2f2f2" ${line}/>
      ${eye(45.5, 51)}${eye(54.5, 51)}
      <path d="M48.8 55.5 h2.4 l-1.2 1.4 z" fill="#e88aa0"/>
      <path d="M50 57 v1.5 M48 59 h4" stroke="${INK}" stroke-width="0.6"/>
      <circle cx="44" cy="56" r="1.8" fill="#f9c8d2"/><circle cx="56" cy="56" r="1.8" fill="#f9c8d2"/>
      <ellipse cx="43" cy="89" rx="5" ry="2.6" fill="#fff" ${line}/><ellipse cx="57" cy="89" rx="5" ry="2.6" fill="#fff" ${line}/>`,
    top: [50, 42], eyes: [50, 51, 9], neck: [50, 65, 12], back: [30, 74], paw: [67, 76],
  },
  owl: {
    draw: () => `
      <ellipse cx="50" cy="64" rx="19" ry="25" fill="#8d6e63" ${line}/>
      <ellipse cx="50" cy="72" rx="12" ry="15" fill="#d7c3a8"/>
      <path d="M44 66 q2 2 4 0 M52 66 q2 2 4 0 M46 72 q2 2 4 0 M50 78 q2 2 4 0 M44 78 q2 2 4 0" fill="none" stroke="#a88a6c" stroke-width="0.8"/>
      <path d="M33 44 l2 -10 l7 7 z M67 44 l-2 -10 l-7 7 z" fill="#6d4c41" ${line}/>
      <path d="M31 64 q-4 10 4 18 M69 64 q4 10 -4 18" fill="#6d4c41" ${line}/>
      <circle cx="43" cy="51" r="7" fill="#fff" ${line}/><circle cx="57" cy="51" r="7" fill="#fff" ${line}/>
      <circle cx="43" cy="51" r="3.5" fill="#f5a623"/><circle cx="57" cy="51" r="3.5" fill="#f5a623"/>
      <circle cx="43" cy="51" r="1.8" fill="${INK}"/><circle cx="57" cy="51" r="1.8" fill="${INK}"/>
      <path d="M48 57 l2 5 l2 -5 z" fill="#f5a623" ${line}/>
      <path d="M43 89 v-3 M45 89 v-3 M47 89 v-3 M53 89 v-3 M55 89 v-3 M57 89 v-3" stroke="#f5a623" stroke-width="1.6"/>`,
    top: [50, 40], eyes: [50, 51, 14], neck: [50, 62, 17], back: [31, 68], paw: [70, 70],
  },
  fox: {
    draw: () => `
      <path d="M66 82 q24 -2 20 -24 q-6 6 -14 6 q-6 8 -6 18 z" fill="#e8772e" ${line}/>
      <path d="M86 58 q-6 6 -14 6 l4 -6 q6 -1 10 0 z" fill="#fff"/>
      <ellipse cx="50" cy="76" rx="18" ry="13" fill="#e8772e" ${line}/>
      <ellipse cx="50" cy="79" rx="8" ry="8" fill="#fff4e8"/>
      <path d="M36 36 l3 -12 l9 9 z M64 36 l-3 -12 l-9 9 z" fill="#e8772e" ${line}/>
      <path d="M38.5 33 l1.6 -6 l4.5 4.5 z M61.5 33 l-1.6 -6 l-4.5 4.5 z" fill="#3b2a20"/>
      <path d="M34 42 q0 -10 16 -10 q16 0 16 10 q0 6 -16 20 q-16 -14 -16 -20 z" fill="#e8772e" ${line}/>
      <path d="M36 46 q6 2 14 16 q8 -14 14 -16 q-2 4 -14 16 q-12 -12 -14 -16 z" fill="#fff4e8"/>
      ${eye(45, 45)}${eye(55, 45)}
      <ellipse cx="50" cy="58.5" rx="2" ry="1.5" fill="${INK}"/>
      <ellipse cx="43" cy="88" rx="4.5" ry="2.6" fill="#3b2a20"/><ellipse cx="57" cy="88" rx="4.5" ry="2.6" fill="#3b2a20"/>`,
    top: [50, 33], eyes: [50, 45, 10], neck: [50, 64, 13], back: [29, 72], paw: [68, 74],
  },
  turtle: {
    draw: () => `
      <ellipse cx="34" cy="86" rx="5" ry="4" fill="#8bc34a" ${line}/><ellipse cx="62" cy="86" rx="5" ry="4" fill="#8bc34a" ${line}/>
      <path d="M78 74 q2 -10 -4 -14" fill="none" stroke="#8bc34a" stroke-width="8" stroke-linecap="round"/>
      <circle cx="74" cy="56" r="8" fill="#8bc34a" ${line}/>
      ${eye(76, 54, 1.4)}
      <path d="M77 59 q2 1 3 -1" fill="none" stroke="${INK}" stroke-width="0.8"/>
      <path d="M22 82 q0 -28 26 -28 q26 0 26 28 z" fill="#4e8a3a" ${line}/>
      <path d="M48 56 v26 M30 68 q18 6 36 0 M36 58 l4 10 M60 58 l-4 10" fill="none" stroke="#2f5e22" stroke-width="1.2"/>
      <rect x="20" y="80" width="56" height="5" rx="2.5" fill="#c8b06a" ${line}/>
      <path d="M22 82 l-6 2" stroke="#8bc34a" stroke-width="4" stroke-linecap="round"/>`,
    top: [74, 48.5], eyes: [74.5, 54, 7], neck: [77, 65, 9], back: [44, 66], paw: [64, 78],
  },
  elephant: {
    draw: () => `
      <ellipse cx="54" cy="72" rx="23" ry="15" fill="#9ea7b0" ${line}/>
      <rect x="36" y="78" width="8" height="12" rx="3" fill="#9ea7b0" ${line}/>
      <rect x="62" y="78" width="8" height="12" rx="3" fill="#9ea7b0" ${line}/>
      <path d="M77 68 q6 2 5 8" fill="none" stroke="#7d8790" stroke-width="1.5"/>
      <ellipse cx="62" cy="54" rx="11" ry="13" fill="#b3bcc4" ${line}/>
      <ellipse cx="62" cy="54" rx="7" ry="9" fill="#d3a8b0"/>
      <circle cx="45" cy="50" r="15" fill="#9ea7b0" ${line}/>
      <path d="M38 56 q-2 14 -10 22 q-3 3 -5 0 q8 -10 7 -22 z" fill="#9ea7b0" ${line}/>
      <path d="M33 66 l3 1 M31 71 l3 1" stroke="#7d8790" stroke-width="0.8"/>
      ${eye(41, 47)}${eye(51, 47)}
      <path d="M36 58 q-4 4 -6 2" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/>`,
    top: [45, 36], eyes: [46, 47, 10], neck: [52, 64, 14], back: [64, 64], paw: [26, 78],
  },
};

// ---------- Accessories ----------

const ACCESSORIES = {
  hat: (a) => {
    const [x, y] = a.top;
    return `<g transform="translate(${x} ${y})">
      <ellipse cx="0" cy="0" rx="12" ry="2.6" fill="#222" ${line}/>
      <rect x="-7.5" y="-15" width="15" height="15" rx="1" fill="#222" ${line}/>
      <rect x="-7.5" y="-4.5" width="15" height="3" fill="#c0392b"/>
    </g>`;
  },
  crown: (a) => {
    const [x, y] = a.top;
    return `<g transform="translate(${x} ${y})">
      <path d="M-10 1 l0 -11 l5 5 l5 -9 l5 9 l5 -5 l0 11 z" fill="#f4c430" ${line}/>
      <circle cx="0" cy="-3" r="1.6" fill="#e74c3c"/><circle cx="-6" cy="-2" r="1.2" fill="#3498db"/><circle cx="6" cy="-2" r="1.2" fill="#2ecc71"/>
    </g>`;
  },
  glasses: (a) => {
    const [x, y, gap] = a.eyes;
    const r = Math.min(4.6, gap / 2 - 0.3);
    return `<g transform="translate(${x} ${y})" fill="rgba(180,220,255,0.35)" stroke="#1d1d1d" stroke-width="1.4">
      <circle cx="${-gap / 2}" cy="0" r="${r}"/><circle cx="${gap / 2}" cy="0" r="${r}"/>
      <path d="M${-gap / 2 + r} -0.5 q${gap / 2 - r} -2 ${gap - 2 * r} 0" fill="none"/>
    </g>`;
  },
  scarf: (a) => {
    const [x, y, w] = a.neck;
    return `<g transform="translate(${x} ${y})">
      <rect x="${-w / 2 - 1}" y="-3" width="${w + 2}" height="6" rx="3" fill="#d63a3a" ${line}/>
      <path d="M${w / 4} 2 l2 11 l5 -1 l-2 -10 z" fill="#d63a3a" ${line}/>
      <path d="M${w / 4 + 2.4} 13.6 l-0.4 2.4 M${w / 4 + 4.4} 13.2 l0 2.4 M${w / 4 + 6.4} 12.8 l0.4 2.4" stroke="#d63a3a" stroke-width="1"/>
      <path d="M${-w / 2 + 2} -3 v6 M${-w / 4} -3 v6 M0 -3 v6 M${w / 4} -3 v6" stroke="#f3f3f3" stroke-width="1"/>
    </g>`;
  },
  bowtie: (a) => {
    const [x, y] = a.neck;
    return `<g transform="translate(${x} ${y})">
      <path d="M0 0 l-8 -5 v10 z M0 0 l8 -5 v10 z" fill="#7b3fb5" ${line}/>
      <circle r="2.2" fill="#9b59d6" ${line}/>
    </g>`;
  },
  backpack: (a) => {
    const [x, y] = a.back;
    return `<g transform="translate(${x} ${y})">
      <rect x="-8" y="-10" width="16" height="20" rx="4" fill="#2e86de" ${line}/>
      <rect x="-5.5" y="0" width="11" height="7" rx="2" fill="#54a0ff" ${line}/>
      <path d="M-4 -10 q4 -6 8 0" fill="none" stroke="${INK}" stroke-width="1.4"/>
    </g>`;
  },
  umbrella: (a) => {
    const [x, y] = a.paw;
    const canopy = 26 - y; // canopy sits at y=26 in scene coordinates
    return `<g transform="translate(${x} ${y})">
      <line x1="0" y1="2" x2="0" y2="${canopy}" stroke="#444" stroke-width="1.6"/>
      <path d="M0 2 q0 4 3 4 q3 0 3 -3" fill="none" stroke="#444" stroke-width="1.6"/>
      <g transform="translate(0 ${canopy})">
        <path d="M-16 0 q16 -18 32 0 q-4 -3 -8 0 q-4 -3 -8 0 q-4 -3 -8 0 q-4 -3 -8 0 z" fill="#e84393" ${line}/>
        <path d="M0 -9 v-3" stroke="#444" stroke-width="1.6"/>
      </g>
    </g>`;
  },
};

// Accessories drawn behind the animal (so the animal overlaps them).
const BEHIND = new Set(['backpack']);

export function cardArt(card, keys) {
  const animal = ANIMALS[keys.animal];
  const acc = ACCESSORIES[keys.accessory](animal);
  const behind = BEHIND.has(keys.accessory) && keys.animal !== 'turtle' && keys.animal !== 'elephant';
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
    <g>
      ${LOCATIONS[keys.location]()}
      ${behind ? acc : ''}
      ${animal.draw()}
      ${behind ? '' : acc}
    </g>
  </svg>`;
}

export function cardBackArt() {
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect width="100" height="100" fill="#3d2c5e"/>
    <g fill="none" stroke="#6c56a0" stroke-width="1">
      ${Array.from({ length: 9 }, (_, i) => `<circle cx="50" cy="50" r="${6 + i * 6}"/>`).join('')}
    </g>
    <circle cx="50" cy="50" r="16" fill="#f4c430"/>
    <text x="50" y="58" text-anchor="middle" font-size="24" font-weight="800" fill="#3d2c5e" font-family="system-ui, sans-serif">?</text>
  </svg>`;
}

// ---------- Guide pictures (one attribute on its own) ----------

const svg = (viewBox, body) => `<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;

export function animalArt(key) {
  return svg('15 15 75 82', `<rect x="0" y="0" width="100" height="100" fill="#f3ede3"/>${ANIMALS[key].draw()}`);
}

// Each accessory is drawn at a neutral anchor and cropped around it.
const SOLO = { top: [50, 58], eyes: [50, 50, 16], neck: [50, 50, 26], back: [50, 52], paw: [50, 72] };
const SOLO_VIEW = {
  hat: '32 36 36 28', crown: '36 40 28 22', glasses: '36 40 28 20', scarf: '33 42 36 30',
  bowtie: '38 40 24 20', backpack: '38 36 24 28', umbrella: '30 6 40 76',
};

export function accessoryArt(key) {
  const [x, y, w, h] = SOLO_VIEW[key].split(' ').map(Number);
  return svg(SOLO_VIEW[key], `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#f3ede3"/>${ACCESSORIES[key](SOLO)}`);
}

export function locationArt(key) {
  return svg('0 0 100 100', LOCATIONS[key]());
}
