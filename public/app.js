import { ANIMALS, ACCESSORIES, LOCATIONS, CARDS } from '/shared/cards.js';
import { animalArt, accessoryArt, locationArt } from '/art.js';
import { esc, cardHTML, cardName, PILE_LABEL } from '/ui.js';
import { arenaHTML, captureRects, animateChanges, bounceBack } from '/arena.js';

const $app = document.getElementById('app');
const $modal = document.getElementById('modal');
const $toast = document.getElementById('toast');
const $conn = document.getElementById('conn');

const params = new URLSearchParams(location.search);
let roomCode = (params.get('room') || '').toUpperCase() || null;
let joiningViaLink = params.has('join');

let ws = null;
let view = null;
let selectedCard = null;
let lobbyError = '';
let pending = null; // request waiting for the socket to open
let retryDelay = 500;
let modalState = null;
let lastPlay = null; // { cardId, pile } of the clue we just sent, for the wrong-pile bounce

// ---------- storage (tolerant of private mode) ----------
const store = {
  get(k) { try { return sessionStorage.getItem(k) ?? localStorage.getItem(k); } catch { return null; } },
  getSession(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  getLocal(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); localStorage.setItem(k, v); } catch {} },
  del(k) { try { sessionStorage.removeItem(k); localStorage.removeItem(k); } catch {} },
};
const tokenKey = (code) => `mc:token:${code}`;
const savedName = () => store.get('mc:name') || '';

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
    store.set('mc:last', msg.code);
    joiningViaLink = false;
    history.replaceState(null, '', `?room=${msg.code}`);
  } else if (msg.type === 'state') {
    const prev = view;
    view = msg.state;
    if (selectedCard !== null && !(view.yourTurn && view.you.hand.some((c) => c.id === selectedCard))) selectedCard = null;
    render(prev);
    if (prev && prev.status !== 'finished' && view.status === 'finished') {
      setTimeout(() => openModal({ kind: 'result' }), 900);
    } else if (modalState) renderModal();
  } else if (msg.type === 'error') {
    if (msg.request === 'resume' || (msg.request === 'join' && !view)) {
      if (msg.request === 'resume') store.del(tokenKey(roomCode));
      lobbyError = msg.message;
      leaveRoom();
    } else {
      if (msg.request === 'play' && lastPlay) bounceBack($app, lastPlay.cardId, lastPlay.pile);
      toast(msg.message);
    }
    lastPlay = null;
  }
}

// ---------- leaving: confirm before the phone's Back button exits ----------
let trapArmed = false;
let leavingViaBack = false;

function armTrap() {
  if (trapArmed || !roomCode || !view) return;
  history.pushState({ trap: true }, '', location.href);
  trapArmed = true;
}

window.addEventListener('popstate', () => {
  if (leavingViaBack) { leavingViaBack = false; leaveRoom(); return; }
  if (!trapArmed) return;
  trapArmed = false;
  if (!roomCode || !view) return;
  // Back closes an open panel first; otherwise ask before leaving.
  if (modalState && modalState.kind !== 'leave') closeModal();
  else openModal({ kind: 'leave' });
  armTrap();
});

// Browsers ignore history entries added without a user gesture, so (re)arm on touch.
document.addEventListener('pointerdown', armTrap, true);

window.addEventListener('beforeunload', (e) => {
  if (view && view.status === 'playing' && !leavingViaBack) { e.preventDefault(); e.returnValue = ''; }
});

function leaveGame() {
  closeModal();
  if (trapArmed) { trapArmed = false; leavingViaBack = true; history.back(); } else leaveRoom();
}

function leaveRoom() {
  view = null;
  roomCode = null;
  joiningViaLink = false;
  selectedCard = null;
  closeModal();
  history.replaceState(null, '', location.pathname);
  render();
}

// ---------- rendering ----------
function render(prev = null) {
  document.body.classList.toggle('in-game', !!view && view.status !== 'waiting');
  if (!view) return renderLobby();
  if (view.status === 'waiting') return renderWaiting();
  renderGame(prev);
}

function renderLobby() {
  const linkJoin = roomCode && joiningViaLink;
  const last = store.getLocal('mc:last');
  const canResume = !linkJoin && last && store.getLocal(tokenKey(last));
  $app.innerHTML = `
    <section class="lobby">
      <div class="hero">${cardHTML(CARDS[5], { size: 'lg' })}</div>
      <h1>Maple's Clues</h1>
      <p class="sub">Give your opponent clues about their hidden card. Work out yours before they work out theirs.</p>
      ${lobbyError ? `<p class="error">${esc(lobbyError)}</p>` : ''}
      ${canResume ? `<button class="btn primary" id="resume">Return to game ${esc(last)}</button>` : ''}
      <label class="field">Your name<input id="name" maxlength="20" autocomplete="nickname" value="${esc(savedName())}" placeholder="e.g. Rotem"></label>
      ${linkJoin ? `
        <button class="btn primary" id="joinLink">Join game ${esc(roomCode)}</button>
        <button class="btn link" id="toLobby">Start a different game</button>
      ` : `
        <button class="btn ${canResume ? '' : 'primary'}" id="create">Create a new game</button>
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
  on('resume', () => { lobbyError = ''; roomCode = last; send({ type: 'resume', code: last, token: store.getLocal(tokenKey(last)) }); });
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
    <li>On your turn, tap a card in your hand, then tap your opponent's <b>Similar (דומה)</b> pile if it shares at least one attribute with their hidden card, or their <b>Not similar (לא דומה)</b> pile if it shares none. A wrong choice bounces back, so you can try again. Then you draw a card.</li>
    <li>The cards your opponent plays land in <b>your own</b> two piles at the bottom. Tap a pile to see all its cards and work out your hidden card.</li>
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
  document.getElementById('leave').onclick = () => leaveGame();
}

function renderGame(prev) {
  const v = view;
  const before = prev ? captureRects($app) : null;
  $app.innerHTML = `
    <header class="top">
      <button class="icon-btn" id="menu" aria-label="Menu">☰</button>
      <div class="code">Game <b>${esc(v.code)}</b></div>
      <button class="btn guide-btn" data-guide>Guide</button>
    </header>
    ${arenaHTML(v, { selected: selectedCard })}`;
  animateChanges(prev, v, before, $app);

  $app.querySelectorAll('[data-card]').forEach((el) => {
    el.onclick = () => {
      const id = Number(el.dataset.card);
      if (!v.yourTurn) return openModal({ kind: 'card', card: CARDS[id] });
      selectedCard = selectedCard === id ? null : id;
      render();
    };
  });
  $app.querySelectorAll('.fpile').forEach((el) => {
    el.onclick = () => {
      const { side, pile } = el.dataset;
      if (side === 'opp' && v.yourTurn && selectedCard !== null) {
        lastPlay = { cardId: selectedCard, pile };
        send({ type: 'play', cardId: selectedCard, pile });
      } else {
        openModal({ kind: 'pile', side, pile });
      }
    };
  });
  $app.querySelectorAll('[data-show-card]').forEach((el) => {
    el.onclick = () => openModal({ kind: 'card', card: CARDS[Number(el.dataset.showCard)] });
  });
  const on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
  on('guess', () => openModal({ kind: 'guess', animal: null, accessory: null }));
  on('pass', () => send({ type: 'pass' }));
  on('newGame', newGame);
  on('menu', () => openModal({ kind: 'menu' }));
  on('openLog', () => openModal({ kind: 'log' }));
}

function newGame() {
  store.del(tokenKey(view.code));
  store.del('mc:last');
  leaveGame();
}

// ---------- modal ----------
function openModal(state) { modalState = state; renderModal(); }
function closeModal() { modalState = null; $modal.classList.add('hidden'); $modal.innerHTML = ''; }
$modal.addEventListener('click', (e) => { if (e.target === $modal || e.target.closest('[data-close]')) closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
$app.addEventListener('click', (e) => { if (e.target.closest('[data-guide]')) openModal({ kind: 'guide', tab: 'animals' }); });

function renderModal() {
  if (!modalState || (!view && !['guide', 'card'].includes(modalState.kind))) return closeModal();
  const m = modalState;
  let body = '';
  if (m.kind === 'card') {
    body = `${m.back ? '<button class="btn link back-link" id="modalBack">‹ Back to guide</button>' : ''}<div class="center">${cardHTML(m.card, { size: 'xl' })}</div>`;
  } else if (m.kind === 'pile') {
    body = pileHTML(m);
  } else if (m.kind === 'guess') {
    body = guessHTML(m);
  } else if (m.kind === 'guide') {
    body = guideHTML(m);
  } else if (m.kind === 'leave') {
    body = `
      <h2>Leave the game?</h2>
      <p>Your game stays open. You can come back with the same link, or from the start screen.</p>
      <div class="two"><button class="btn primary" data-close>Stay</button><button class="btn" id="confirmLeave">Leave</button></div>`;
  } else if (m.kind === 'menu') {
    body = `
      <h2>Menu</h2>
      <div class="menu-list">
        <button class="btn" id="mLog">Game log</button>
        <button class="btn" id="mRules">How to play</button>
        <button class="btn" id="mLeave">Leave game</button>
      </div>`;
  } else if (m.kind === 'rules') {
    body = `<h2>How to play</h2>${rulesHTML()}`;
  } else if (m.kind === 'log') {
    body = `<h2>Game log</h2><ol class="log">${view.log.slice().reverse().map((l) => `<li>${esc(l.text)}</li>`).join('')}</ol>`;
  } else if (m.kind === 'result') {
    body = resultHTML();
  }
  $modal.innerHTML = `<div class="sheet"><button class="close" data-close aria-label="Close">✕</button>${body}</div>`;
  $modal.classList.remove('hidden');

  const on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = fn; };
  $modal.querySelectorAll('[data-tab]').forEach((el) => { el.onclick = () => { m.tab = el.dataset.tab; renderModal(); }; });
  $modal.querySelectorAll('[data-show]').forEach((el) => { el.onclick = () => openModal({ kind: 'card', card: CARDS[Number(el.dataset.show)], back: m }); });
  on('modalBack', () => openModal(m.back));
  on('confirmLeave', leaveGame);
  on('mLog', () => openModal({ kind: 'log' }));
  on('mRules', () => openModal({ kind: 'rules' }));
  on('mLeave', () => openModal({ kind: 'leave' }));
  on('resultNew', newGame);

  if (m.kind === 'guess') {
    $modal.querySelectorAll('[data-animal]').forEach((el) => { el.onclick = () => { m.animal = Number(el.dataset.animal); renderModal(); }; });
    $modal.querySelectorAll('[data-acc]').forEach((el) => { el.onclick = () => { m.accessory = Number(el.dataset.acc); renderModal(); }; });
    on('confirmGuess', () => {
      const card = CARDS.find((c) => c.animal === m.animal && c.accessory === m.accessory);
      send({ type: 'guess', cardId: card.id });
      closeModal();
    });
  }
}

function pileHTML(m) {
  const mine = m.side === 'me';
  const owner = mine ? view.you : view.opponent;
  const entries = owner.piles[m.pile];
  const label = PILE_LABEL[m.pile];
  const explain = mine
    ? (m.pile === 'similar'
      ? 'Each of these cards shares <b>at least one</b> attribute with <b>your</b> hidden card.'
      : 'None of these cards shares <b>any</b> attribute with <b>your</b> hidden card.')
    : `${esc(view.opponent.name)}'s pile: clues you gave about <b>their</b> hidden card.`;
  return `
    <h2 class="${m.pile}-text">${mine ? 'Your' : `${esc(view.opponent.name)}'s`} ${label.en} <span lang="he">${label.he}</span></h2>
    <p class="muted small">${explain} In the order they were played.</p>
    <div class="pile-list">
      ${entries.length ? entries.map((e, i) => `<div class="pile-entry">${cardHTML(e.card, { size: 'md' })}<div class="cap">#${i + 1} · turn ${e.turn}</div></div>`).join('') : '<p class="empty">No cards yet.</p>'}
    </div>`;
}

function resultHTML() {
  const v = view;
  const title = v.result.winner === null ? "It's a draw" : v.result.winner === v.you.seat ? 'You won! 🎉' : `${esc(v.opponent.name)} won`;
  return `
    <div class="center result">
      <h2>${title}</h2>
      <p>${esc(v.result.reason)}</p>
      <div class="reveal">
        <div>${cardHTML(v.you.hidden, { size: 'md' })}<div class="cap">Your hidden card</div></div>
        <div>${cardHTML(v.opponent.hidden, { size: 'md' })}<div class="cap">${esc(v.opponent.name)}'s hidden card</div></div>
      </div>
      <div class="two"><button class="btn" data-close>See the board</button><button class="btn primary" id="resultNew">New game</button></div>
    </div>`;
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
