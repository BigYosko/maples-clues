import { ANIMALS, ACCESSORIES, LOCATIONS, CARDS } from '/shared/cards.js';
import { cardArt, cardBackArt, animalArt, accessoryArt, locationArt } from '/art.js';

const $app = document.getElementById('app');
const $modal = document.getElementById('modal');
const $toast = document.getElementById('toast');
const $conn = document.getElementById('conn');

const PILE_LABEL = {
  similar: { en: 'Similar', he: 'דומה' },
  notSimilar: { en: 'Not similar', he: 'לא דומה' },
};

const params = new URLSearchParams(location.search);
let roomCode = (params.get('room') || '').toUpperCase() || null;
let joiningViaLink = params.has('join');

let ws = null;
let view = null;
let selectedCard = null;
let lobbyError = '';
let pending = null; // request waiting for the socket to open
let retryDelay = 500;
let seenPileCounts = null; // to highlight cards that just arrived
let freshCards = new Set();
let modalState = null;

// ---------- storage (tolerant of private mode) ----------
const store = {
  get(k) { try { return sessionStorage.getItem(k) ?? localStorage.getItem(k); } catch { return null; } },
  getSession(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); localStorage.setItem(k, v); } catch {} },
  del(k) { try { sessionStorage.removeItem(k); localStorage.removeItem(k); } catch {} },
};
const tokenKey = (code) => `mc:token:${code}`;
const savedName = () => store.get('mc:name') || '';

// ---------- helpers ----------
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const keysOf = (c) => ({ animal: ANIMALS[c.animal].key, accessory: ACCESSORIES[c.accessory].key, location: LOCATIONS[c.location].key });
const artCache = new Map();
function art(card) {
  if (!artCache.has(card.id)) artCache.set(card.id, cardArt(card, keysOf(card)));
  return artCache.get(card.id);
}
const cardName = (c) => `${ANIMALS[c.animal].name}, ${ACCESSORIES[c.accessory].name}, ${LOCATIONS[c.location].name}`;

function cardHTML(card, { size = 'md', extra = '', attrs = '' } = {}) {
  return `<div class="card ${size} ${extra}" ${attrs} aria-label="${esc(cardName(card))}">
    <div class="art">${art(card)}</div>
    <div class="lbl"><b>${ANIMALS[card.animal].name}</b><span>${ACCESSORIES[card.accessory].name}</span><span>${LOCATIONS[card.location].name}</span></div>
  </div>`;
}
function backHTML(size = 'md', label = 'Your hidden card') {
  return `<div class="card back ${size}"><div class="art">${cardBackArt()}</div><div class="lbl"><b>?</b><span>${label}</span></div></div>`;
}

function toast(msg, kind = 'err') {
  $toast.textContent = msg;
  $toast.className = `toast ${kind}`;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => $toast.classList.add('hidden'), kind === 'err' ? 4500 : 2500);
}

// ---------- networking ----------
function send(msg) {
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  else { pending = msg; connect(); }
}

function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);
  ws.onopen = () => {
    retryDelay = 500;
    $conn.classList.add('hidden');
    if (pending) { const m = pending; pending = null; ws.send(JSON.stringify(m)); }
    else if (roomCode && store.get(tokenKey(roomCode)) && view) {
      ws.send(JSON.stringify({ type: 'resume', code: roomCode, token: store.get(tokenKey(roomCode)) }));
    }
  };
  ws.onmessage = (e) => onMessage(JSON.parse(e.data));
  ws.onclose = () => {
    ws = null;
    if (roomCode && view) {
      $conn.classList.remove('hidden');
      setTimeout(connect, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 8000);
    }
  };
}

function onMessage(msg) {
  if (msg.type === 'joined') {
    roomCode = msg.code;
    store.set(tokenKey(msg.code), msg.token);
    joiningViaLink = false;
    history.replaceState(null, '', `?room=${msg.code}`);
  } else if (msg.type === 'state') {
    trackFresh(msg.state);
    const wasMyTurn = view && view.yourTurn;
    view = msg.state;
    if (selectedCard !== null && !view.you.hand.some((c) => c.id === selectedCard)) selectedCard = null;
    if (!wasMyTurn && view.yourTurn && view.status === 'playing') toast('Your turn!', 'ok');
    render();
    if (modalState) renderModal();
  } else if (msg.type === 'error') {
    if (msg.request === 'resume' || (msg.request === 'join' && !view)) {
      if (msg.request === 'resume') store.del(tokenKey(roomCode));
      lobbyError = msg.message;
      leaveRoom();
    } else {
      toast(msg.message);
    }
  }
}

function trackFresh(state) {
  const piles = state.you.piles;
  const counts = { similar: piles.similar.length, notSimilar: piles.notSimilar.length };
  freshCards = new Set();
  if (seenPileCounts && view && view.code === state.code) {
    for (const p of ['similar', 'notSimilar']) {
      piles[p].slice(seenPileCounts[p]).forEach((e) => freshCards.add(e.cardId));
    }
    if (freshCards.size) toast(`${state.opponent.name} gave you a new clue.`, 'ok');
  }
  seenPileCounts = counts;
}

function leaveRoom() {
  view = null;
  roomCode = null;
  joiningViaLink = false;
  seenPileCounts = null;
  selectedCard = null;
  closeModal();
  history.replaceState(null, '', location.pathname);
  render();
}

// ---------- rendering ----------
function render() {
  if (!view) return renderLobby();
  if (view.status === 'waiting') return renderWaiting();
  renderGame();
}

function renderLobby() {
  const linkJoin = roomCode && joiningViaLink;
  $app.innerHTML = `
    <section class="lobby">
      <div class="hero">${cardHTML(CARDS[5], { size: 'lg' })}</div>
      <h1>Maple's Clues</h1>
      <p class="sub">Give your opponent clues about their hidden card. Work out yours before they work out theirs.</p>
      ${lobbyError ? `<p class="error">${esc(lobbyError)}</p>` : ''}
      <label class="field">Your name<input id="name" maxlength="20" autocomplete="nickname" value="${esc(savedName())}" placeholder="e.g. Rotem"></label>
      ${linkJoin ? `
        <button class="btn primary" id="joinLink">Join game ${esc(roomCode)}</button>
        <button class="btn link" id="toLobby">Start a different game</button>
      ` : `
        <button class="btn primary" id="create">Create a new game</button>
        <div class="or"><span>or join a friend</span></div>
        <div class="row"><input id="code" maxlength="5" placeholder="CODE" autocapitalize="characters" value="${esc(roomCode || '')}"><button class="btn" id="join">Join</button></div>
      `}
      <button class="btn" data-guide>Guide: all animals, accessories &amp; locations</button>
      <details class="rules"><summary>How to play</summary>${rulesHTML()}</details>
    </section>`;
  const name = () => {
    const n = document.getElementById('name').value.trim();
    store.set('mc:name', n);
    return n;
  };
  const on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
  on('create', () => { lobbyError = ''; send({ type: 'create', name: name() }); });
  on('join', () => {
    const code = document.getElementById('code').value.trim().toUpperCase();
    if (!code) return toast('Enter the game code.');
    lobbyError = '';
    roomCode = code;
    send({ type: 'join', code, name: name(), token: store.get(tokenKey(code)) });
  });
  on('joinLink', () => { lobbyError = ''; send({ type: 'join', code: roomCode, name: name(), token: store.getSession(tokenKey(roomCode)) }); });
  on('toLobby', () => { joiningViaLink = false; roomCode = null; history.replaceState(null, '', location.pathname); render(); });
}

function rulesHTML() {
  return `<ul>
    <li>49 cards. Each has an <b>animal</b>, an <b>accessory</b> and a <b>location</b>. Every animal, accessory and location appears on exactly 7 cards.</li>
    <li>You hold 5 cards. Your <b>hidden card</b> is face down: you can't see it, but your opponent can, and you can see theirs.</li>
    <li>On your turn, play a card from your hand into your opponent's <b>Similar (דומה)</b> pile if it shares at least one attribute with their hidden card, or into their <b>Not similar (לא דומה)</b> pile if it shares none. A wrong choice is rejected, so you can try again. Then draw a card.</li>
    <li>The cards your opponent plays build up <b>your own</b> two clue piles. Use them to work out your hidden card.</li>
    <li>You have <b>3 guesses</b> per game, at most one per turn, made before you play your clue. Guess right to win. Use up all 3 wrong and you lose.</li>
    <li>When the deck runs out, keep playing from your hand. If both hands empty with no winner, it's a draw.</li>
  </ul>`;
}

function shareLink() {
  return `${location.origin}${location.pathname}?room=${view.code}&join=1`;
}

function renderWaiting() {
  $app.innerHTML = `
    <section class="lobby">
      <h1>Game ${esc(view.code)}</h1>
      <p class="sub">Send this link to your opponent. The game starts when they join.</p>
      <div class="codebox">${esc(view.code)}</div>
      <button class="btn primary" id="share">Share invite link</button>
      <p class="muted small">${esc(shareLink())}</p>
      <div class="spinner"></div>
      <button class="btn" data-guide>Guide: all animals, accessories &amp; locations</button>
      <button class="btn link" id="leave">Leave</button>
    </section>`;
  document.getElementById('share').onclick = async () => {
    const url = shareLink();
    if (navigator.share) {
      try { await navigator.share({ title: "Maple's Clues", text: 'Play with me!', url }); return; } catch {}
    }
    try { await navigator.clipboard.writeText(url); toast('Link copied!', 'ok'); } catch { prompt('Copy this link:', url); }
  };
  document.getElementById('leave').onclick = () => leaveRoom();
}

function pileHTML(piles, which, owner) {
  const entries = piles[which];
  const label = PILE_LABEL[which];
  return `<button class="pile ${which}" data-pile="${which}" data-owner="${owner}">
    <div class="pile-head"><span class="pile-name">${label.en} <span class="he" lang="he" dir="rtl">${label.he}</span></span><span class="count">${entries.length}</span></div>
    <div class="pile-cards">
      ${entries.length ? entries.map((e) => cardHTML(e.card, { size: 'sm', extra: owner === 'you' && freshCards.has(e.cardId) ? 'fresh' : '' })).join('') : '<span class="empty">No cards yet</span>'}
    </div>
  </button>`;
}

function renderGame() {
  const v = view;
  const opp = v.opponent;
  const finished = v.status === 'finished';
  const statusText = finished
    ? (v.result.winner === null ? 'Draw' : v.result.winner === v.you.seat ? 'You won!' : `${esc(opp.name)} won`)
    : v.yourTurn ? 'Your turn' : `${esc(opp.name)}'s turn`;
  const handEmpty = v.you.hand.length === 0;
  const canGuess = v.yourTurn && !v.you.guessedThisTurn && v.you.guessesLeft > 0;

  let actionHint = '';
  if (!finished) {
    if (!v.yourTurn) actionHint = `Waiting for ${esc(opp.name)} to play a clue…`;
    else if (handEmpty) actionHint = 'You have no cards left. Guess or pass.';
    else if (selectedCard === null) actionHint = v.you.guessedThisTurn
      ? 'Wrong guess. Now play a clue card to finish your turn.'
      : `Tap a card to give ${esc(opp.name)} a clue, or guess your hidden card first.`;
    else actionHint = `Is it similar to ${esc(opp.name)}'s hidden card?`;
  }

  $app.innerHTML = `
    <header class="top">
      <div class="top-meta"><b>${esc(v.code)}</b><span class="muted">Deck ${v.deckCount}</span></div>
      <div class="status ${finished ? 'done' : v.yourTurn ? 'mine' : ''}">${statusText}</div>
      <button class="btn guide-btn" data-guide>Guide</button>
    </header>

    ${finished ? `
      <section class="panel result">
        <h2>${statusText}</h2>
        <p>${esc(v.result.reason)}</p>
        <div class="reveal">
          <div>${cardHTML(v.you.hidden, { size: 'md' })}<div class="cap">Your hidden card</div></div>
          <div>${cardHTML(opp.hidden, { size: 'md' })}<div class="cap">${esc(opp.name)}'s hidden card</div></div>
        </div>
        <button class="btn primary" id="newGame">New game</button>
      </section>` : ''}

    <section class="panel opp">
      <div class="opp-card">${cardHTML(opp.hidden, { size: 'md', extra: 'target' })}</div>
      <div class="opp-info">
        <h2>${esc(opp.name)}'s hidden card</h2>
        <p class="muted">${esc(opp.name)} can't see it. You give them clues about it.</p>
        <p class="small">${opp.handCount} cards in hand · ${opp.guessesLeft} guess${opp.guessesLeft === 1 ? '' : 'es'} left</p>
      </div>
    </section>

    <section class="panel">
      <h2>Your clue piles</h2>
      <p class="muted small">Cards ${esc(opp.name)} played about <b>your</b> hidden card. Tap a pile to look closer.</p>
      <div class="piles">
        ${pileHTML(v.you.piles, 'similar', 'you')}
        ${pileHTML(v.you.piles, 'notSimilar', 'you')}
      </div>
    </section>

    <section class="panel me">
      <div class="me-row">
        <div class="mine-hidden">${backHTML('md')}</div>
        <div class="me-info">
          <h2>${esc(v.you.name)} (you)</h2>
          <p class="small">${v.you.guessesLeft} of 3 guesses left${v.you.guessedThisTurn && !finished ? ' · guessed this turn' : ''}</p>
          ${v.you.guesses.length ? `<p class="small muted">Wrong guesses: ${v.you.guesses.filter((g) => !g.correct).map((g) => esc(cardName(g.card))).join('; ')}</p>` : ''}
          ${!finished ? `<button class="btn guess" id="guess" ${canGuess ? '' : 'disabled'}>Guess my card</button>` : ''}
          ${!finished && v.yourTurn && handEmpty ? '<button class="btn" id="pass">Pass</button>' : ''}
        </div>
      </div>
    </section>

    ${!finished ? `
    <section class="panel hand-panel ${v.yourTurn ? 'active' : ''}">
      <h2>Your hand</h2>
      <p class="hint">${actionHint}</p>
      <div class="hand">
        ${v.you.hand.map((c) => cardHTML(c, { size: 'md', extra: `pick ${selectedCard === c.id ? 'selected' : ''}`, attrs: `data-card="${c.id}" role="button" tabindex="0"` })).join('') || '<span class="empty">No cards</span>'}
      </div>
      ${v.yourTurn && selectedCard !== null ? `
        <div class="play-actions">
          <button class="btn sim" data-play="similar">Similar <span lang="he">דומה</span></button>
          <button class="btn notsim" data-play="notSimilar">Not similar <span lang="he">לא דומה</span></button>
        </div>
        <p class="muted small center">Goes into ${esc(opp.name)}'s pile</p>` : ''}
    </section>` : ''}

    <details class="panel">
      <summary>Clues you gave ${esc(opp.name)} (${opp.piles.similar.length + opp.piles.notSimilar.length})</summary>
      <p class="muted small">These are ${esc(opp.name)}'s piles, about their hidden card. They're shown here for reference only.</p>
      <div class="piles">
        ${pileHTML(opp.piles, 'similar', 'opp')}
        ${pileHTML(opp.piles, 'notSimilar', 'opp')}
      </div>
    </details>

    <details class="panel">
      <summary>Game log</summary>
      <ol class="log">${v.log.slice().reverse().map((l) => `<li>${esc(l.text)}</li>`).join('')}</ol>
    </details>

    <details class="panel"><summary>How to play</summary>${rulesHTML()}</details>
  `;

  $app.querySelectorAll('[data-card]').forEach((el) => {
    el.onclick = () => {
      const id = Number(el.dataset.card);
      if (!v.yourTurn) return showCard(CARDS[id]);
      selectedCard = selectedCard === id ? null : id;
      render();
    };
  });
  $app.querySelectorAll('[data-play]').forEach((el) => {
    el.onclick = () => send({ type: 'play', cardId: selectedCard, pile: el.dataset.play });
  });
  $app.querySelectorAll('.pile').forEach((el) => {
    el.onclick = () => openModal({ kind: 'pile', owner: el.dataset.owner, pile: el.dataset.pile });
  });
  const on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
  on('guess', () => openModal({ kind: 'guess', animal: null, accessory: null }));
  on('pass', () => send({ type: 'pass' }));
  on('newGame', () => { store.del(tokenKey(view.code)); leaveRoom(); });
}

// ---------- modal ----------
function openModal(state) { modalState = state; renderModal(); }
function closeModal() { modalState = null; $modal.classList.add('hidden'); $modal.innerHTML = ''; }
$modal.addEventListener('click', (e) => { if (e.target === $modal || e.target.closest('[data-close]')) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
$app.addEventListener('click', (e) => { if (e.target.closest('[data-guide]')) openModal({ kind: 'guide', tab: 'animals' }); });

function showCard(card) { openModal({ kind: 'card', card }); }

function renderModal() {
  if (!modalState || (!view && !['guide', 'card'].includes(modalState.kind))) return closeModal();
  const m = modalState;
  let body = '';
  if (m.kind === 'card') {
    body = `${m.back ? '<button class="btn link back-link" id="modalBack">‹ Back to guide</button>' : ''}<div class="center">${cardHTML(m.card, { size: 'xl' })}</div>`;
  } else if (m.kind === 'pile') {
    const mine = m.owner === 'you';
    const piles = mine ? view.you.piles : view.opponent.piles;
    const entries = piles[m.pile];
    const label = PILE_LABEL[m.pile];
    body = `
      <h2 class="${m.pile}-text">${label.en} <span lang="he">${label.he}</span></h2>
      <p class="muted small">${mine
        ? `${m.pile === 'similar' ? 'Each of these cards shares <b>at least one</b> attribute with your hidden card.' : 'None of these cards shares <b>any</b> attribute with your hidden card.'}`
        : `Clues you gave about ${esc(view.opponent.name)}'s hidden card.`} In the order they were played.</p>
      <div class="pile-list">
        ${entries.length ? entries.map((e, i) => `<div class="pile-entry">${cardHTML(e.card, { size: 'md', extra: mine && freshCards.has(e.cardId) ? 'fresh' : '' })}<div class="cap">#${i + 1} · turn ${e.turn}</div></div>`).join('') : '<p class="empty">No cards yet.</p>'}
      </div>`;
  } else if (m.kind === 'guess') {
    body = guessHTML(m);
  } else if (m.kind === 'guide') {
    body = guideHTML(m);
  }
  $modal.innerHTML = `<div class="sheet"><button class="close" data-close aria-label="Close">✕</button>${body}</div>`;
  $modal.classList.remove('hidden');

  $modal.querySelectorAll('[data-tab]').forEach((el) => { el.onclick = () => { m.tab = el.dataset.tab; renderModal(); }; });
  $modal.querySelectorAll('[data-show]').forEach((el) => { el.onclick = () => openModal({ kind: 'card', card: CARDS[Number(el.dataset.show)], back: m }); });
  const back = document.getElementById('modalBack');
  if (back) back.onclick = () => openModal(m.back);

  if (m.kind === 'guess') {
    $modal.querySelectorAll('[data-animal]').forEach((el) => { el.onclick = () => { m.animal = Number(el.dataset.animal); renderModal(); }; });
    $modal.querySelectorAll('[data-acc]').forEach((el) => { el.onclick = () => { m.accessory = Number(el.dataset.acc); renderModal(); }; });
    const confirm = document.getElementById('confirmGuess');
    if (confirm) confirm.onclick = () => {
      const card = CARDS.find((c) => c.animal === m.animal && c.accessory === m.accessory);
      send({ type: 'guess', cardId: card.id });
      closeModal();
    };
  }
}

const GUIDE_TABS = [
  ['animals', 'Animals'], ['accessories', 'Accessories'], ['locations', 'Locations'], ['cards', 'All 49 cards'],
];

function guideHTML(m) {
  const items = (list, artFn, note) => `<div class="guide-grid">${list.map((x) => `
    <div class="guide-item"><div class="guide-art">${artFn(x.key)}</div><b>${esc(x.name)}</b>${note(x)}</div>`).join('')}</div>`;
  let content;
  if (m.tab === 'animals') {
    content = items(ANIMALS, animalArt, (a) => (a.full !== a.name ? `<span class="small muted">${esc(a.full)}</span>` : ''));
  } else if (m.tab === 'accessories') {
    content = items(ACCESSORIES, accessoryArt, () => '');
  } else if (m.tab === 'locations') {
    content = items(LOCATIONS, locationArt, () => '');
  } else {
    content = `<p class="small muted">Rows are animals. Each card is one animal + one accessory + one location. Tap a card to enlarge it.</p>
      ${ANIMALS.map((a, ai) => `<h3>${esc(a.name)}</h3><div class="guide-cards">${CARDS.filter((c) => c.animal === ai)
        .map((c) => `<div data-show="${c.id}" role="button" tabindex="0">${cardHTML(c, { size: 'md' })}</div>`).join('')}</div>`).join('')}`;
  }
  return `
    <h2>Guide</h2>
    <p class="muted small">7 animals × 7 accessories × 7 locations. Each one appears on exactly 7 of the 49 cards.</p>
    <div class="tabs" role="tablist">${GUIDE_TABS.map(([k, label]) => `<button role="tab" aria-selected="${m.tab === k}" class="tab ${m.tab === k ? 'on' : ''}" data-tab="${k}">${label}</button>`).join('')}</div>
    ${content}`;
}

function visibleElsewhere(cardId) {
  const v = view;
  return v.you.hand.some((c) => c.id === cardId)
    || v.opponent.hidden?.id === cardId
    || ['similar', 'notSimilar'].some((p) => v.you.piles[p].some((e) => e.cardId === cardId) || v.opponent.piles[p].some((e) => e.cardId === cardId))
    || v.you.guesses.some((g) => g.cardId === cardId);
}

function guessHTML(m) {
  const card = m.animal !== null && m.accessory !== null ? CARDS.find((c) => c.animal === m.animal && c.accessory === m.accessory) : null;
  const seen = card && visibleElsewhere(card.id);
  return `
    <h2>Guess your hidden card</h2>
    <p class="muted small">${view.you.guessesLeft} of 3 guesses left. One guess per turn. A wrong guess still needs a clue card afterwards.</p>
    <h3>Animal</h3>
    <div class="chips">${ANIMALS.map((a, i) => `<button class="chip ${m.animal === i ? 'on' : ''}" data-animal="${i}">${a.name}</button>`).join('')}</div>
    <h3>Accessory</h3>
    <div class="chips">${ACCESSORIES.map((a, i) => `<button class="chip ${m.accessory === i ? 'on' : ''}" data-acc="${i}">${a.name}</button>`).join('')}</div>
    <h3>Location</h3>
    <p class="small muted">${card ? `With this animal and accessory, the location is always <b>${LOCATIONS[card.location].name}</b>, since only one card matches.` : 'Pick an animal and an accessory. Exactly one card in the deck has both.'}</p>
    ${card ? `
      <div class="center">${cardHTML(card, { size: 'lg' })}</div>
      ${seen ? '<p class="warn">You can already see this card somewhere else (your hand, a pile, a past guess or your opponent\'s hidden card), so it can\'t be your hidden card.</p>' : ''}
      <button class="btn primary wide" id="confirmGuess">Guess: ${esc(cardName(card))}</button>` : ''}
  `;
}

// Phones (iOS Safari especially) silently drop sockets while the app is in the
// background. When the page comes back, reconnect or re-sync the latest state.
function resync() {
  if (document.visibilityState !== 'visible' || !roomCode || !view) return;
  const token = store.get(tokenKey(roomCode));
  if (!token) return;
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'resume', code: roomCode, token }));
  else { retryDelay = 500; connect(); }
}
document.addEventListener('visibilitychange', resync);
window.addEventListener('pageshow', resync);
window.addEventListener('online', resync);

// ---------- boot ----------
function boot() {
  if (roomCode) {
    const token = joiningViaLink ? store.getSession(tokenKey(roomCode)) : store.get(tokenKey(roomCode));
    if (token) {
      $app.innerHTML = '<div class="spinner"></div>';
      view = null;
      send({ type: 'resume', code: roomCode, token });
      return;
    }
  }
  render();
}
boot();
