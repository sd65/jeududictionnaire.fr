/* Jeu du Dictionnaire — client P2P (Trystero, stratégie Nostr par défaut)
 *
 * Architecture hôte-autoritaire : le créateur de la salle détient l'état.
 * Un seul canal "g" :
 *   invité → hôte : { k: 'hello' | 'pick' | 'def' | 'vote' }
 *   hôte → tous   : { k: 'view' | 'spectate' }   (vue filtrée par phase)
 * Les textes des faux restent anonymes jusqu'au dévoilement (REVEAL).
 */
let joinRoom, selfId;
try {
  ({ joinRoom, selfId } = await import('https://esm.run/trystero@0.26'));
} catch {
  ({ joinRoom, selfId } = await import('https://esm.sh/trystero@0.26'));
}

const APP = document.getElementById('app');
const APP_ID = 'fr.jeududictionnaire.proto';
const CFG = { pickSec: 120, draftSec: 300, voteSec: 120 };

/* ------------------------------------------------------------------ pack */
let PACK = null;
try {
  const r = await fetch('/data/wordlist.json');
  if (r.ok) PACK = (await r.json()).words;
} catch { /* saisie manuelle uniquement */ }

const randomPick = (n, exclude = new Set()) => {
  if (!PACK) return [];
  const out = [];
  for (let i = 0; i < 200 && out.length < n; i++) {
    const x = PACK[Math.floor(Math.random() * PACK.length)];
    if (!exclude.has(x.w)) out.push(x);
  }
  return out;
};
/* historique local des mots joués : mémorisé par téléphone, exclu pour tous */
const HIST_KEY = 'jdd.hist';
const localHist = () => {
  try { return new Set(JSON.parse(localStorage.getItem(HIST_KEY) || '[]')); }
  catch { return new Set(); }
};
const rememberWord = (w) => {
  const lw = String(w || '').trim().toLowerCase();
  if (!lw) return;
  let arr;
  try { arr = JSON.parse(localStorage.getItem(HIST_KEY) || '[]'); } catch { arr = []; }
  if (!arr.includes(lw)) {
    arr.push(lw);
    while (arr.length > 3000) arr.shift();
    try { localStorage.setItem(HIST_KEY, JSON.stringify(arr)); } catch { }
  }
};

/* ------------------------------------------------------------------ utils */
const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const h = (html) => { APP.innerHTML = html; };
const localName = () => sessionStorage.getItem('jdd.tab.name')
  ?? localStorage.getItem('jdd.name')
  ?? '';
/** identité par onglet (sessionStorage) + graine pour le prochain onglet (localStorage) */
const setName = (n) => {
  n = (n || '').trim();
  sessionStorage.setItem('jdd.tab.name', n);
  if (n) localStorage.setItem('jdd.name', n);
};
const fmtTimer = (dl) => {
  if (!dl) return '—:—';
  const s = Math.max(0, Math.round((dl - Date.now()) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
setInterval(() => {
  document.querySelectorAll('[data-timer]').forEach((el) => {
    el.textContent = fmtTimer(Number(el.dataset.timer));
  });
}, 1000);
/* maintien de la lumière (best effort) */
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && NET) navigator.wakeLock?.request?.('screen').catch(() => { });
});

/* ------------------------------------------------------------------ réseau */
let NET = null;
let ABOUT_OPEN = false;   // écran « À propos & licences » ouvert (déconnexion visuelle seulement)
let waitingIv = null;   // rafraîchit l'écran d'attente invité (+ failover au bout de qq s)
let roomCode = (new URLSearchParams(location.search).get('room') || '')
  .toUpperCase().replace(/[^A-Z0-9]/g, '');
/* pseudo passable en URL pour les tests multi-onglets : ?name=Claire */
const urlName = (new URLSearchParams(location.search).get('name') || '').slice(0, 18);

let S = null;   // état autoritaire (hôte seulement)
let V = null;   // vue affichée (hôte : son propre état ; invité : dernière vue reçue)

const setupRoom = async (code, isHost) => {
  roomCode = code;
  history.replaceState(null, '', `${location.pathname}?room=${code}`); // lien partageable dans la barre d'adresse
  const room = joinRoom({ appId: APP_ID, password: code.toLowerCase() }, code);
  const send = room.makeAction('g');
  NET = { send, room, isHost, code };
  send.onMessage = (m, from) => {
    const peerId = from?.peerId ?? from;
    if (isHost) hostOnMsg(m, peerId);
    else guestOnMsg(m, peerId);
  };
  room.onPeerJoin = (id) => { if (isHost) hostOnPeer(id); };
  room.onPeerLeave = (id) => { if (isHost) hostOnPeerLeft(id); };
  navigator.wakeLock?.request?.('screen').catch(() => { });
};

const hello = () => {
  const name = localName() || `Joueur-${selfId.slice(0, 4)}`;
  NET?.send.send({ k: 'hello', name, pid: localPid(), tn: tabNonce() });
};

/* ------------------------------------------------------------------ hôte */
const mkPlayer = (id, name = '') => ({ id, name, score: 0, pid: '', tn: '', connected: true });

/* identité persistante du téléphone (localStorage) : permet de reprendre sa
 * place après un rafraîchissement — le selfId Trystero est régénéré à chaque
 * chargement. Le nonce par onglet évite que deux onglets du même téléphone
 * (tests) fusionnent en un seul joueur. */
const PID_KEY = 'jdd.pid';
const localPid = () => {
  let pid;
  try { pid = localStorage.getItem(PID_KEY); } catch { }
  if (!pid) {
    pid = Math.random().toString(36).slice(2, 14) + Math.random().toString(36).slice(2, 14);
    try { localStorage.setItem(PID_KEY, pid); } catch { }
  }
  return pid;
};
const tabNonce = () => {
  let n;
  try { n = sessionStorage.getItem('jdd.tn'); } catch { }
  if (!n) {
    n = Math.random().toString(36).slice(2, 10);
    try { sessionStorage.setItem('jdd.tn', n); } catch { }
  }
  return n;
};

const buildState = () => {
  const hostPlayer = mkPlayer(selfId, localName());
  hostPlayer.pid = localPid();
  hostPlayer.tn = tabNonce();
  S = {
    phase: 'LOBBY', round: 0, rounds: 0, deadline: 0,
    players: new Map([[selfId, hostPlayer]]),
    used: new Set(),
    hideText: false,          // mode oral strict : vote par numéros uniquement (option lobby)
    chooserId: null, cursor: -1,
    word: '', pos: '', realDef: '',
    fakes: new Map(), options: null, byIds: null, realIdx: -1,
    votes: new Map(), deltas: [],
  };
};

const livePlayers = () => [...S.players.values()].filter((p) => p.connected !== false);
const expectedWriters = () => livePlayers().filter((p) => p.id !== S.chooserId);

let T = {};
const setTimer = (key, ms, fn) => { clearTimer(key); T[key] = setTimeout(fn, ms); };
const clearTimer = (key) => { if (T[key]) { clearTimeout(T[key]); delete T[key]; } };
const clearAllTimers = () => { Object.values(T).forEach(clearTimeout); T = {}; };
const nowPlus = (sec) => Date.now() + sec * 1000;

/** Diffuse la vue + rafraîchit l'écran local de l'hôte. */
const push = (extra = {}) => {
  const view = hostView();
  NET?.send.send({ k: 'view', ...view, ...extra });
  V = { host: true, ...view, ...extra, self: selfId };
  render();
};

const hostOnPeer = (id) => {
  if (S.phase === 'LOBBY') {
    if (!S.players.has(id)) {
      S.players.set(id, mkPlayer(id));
      push();
    }
  } else if (S.players.has(id)) {
    S.players.get(id).connected = true;
    NET.send.send({ k: 'view', ...hostView() }, { target: id });
    push();
  } else {
    NET.send.send({ k: 'spectate' }, { target: id });
  }
};

const hostOnPeerLeft = (id) => {
  if (!S?.players.has(id)) return;
  if (S.phase === 'LOBBY') {
    S.players.delete(id);
    push();
  } else {
    S.players.get(id).connected = false;
    push();
    checkForced();
  }
};

const hostOnMsg = (m, peerId) => {
  if (!m || typeof m !== 'object' || !m.k) return;
  switch (m.k) {
    case 'hello': {
      const name = String(m.name || '').slice(0, 20);
      const pid = String(m.pid || '').slice(0, 40);
      const tn = String(m.tn || '').slice(0, 20);
      /* reprise de casquette : même pid+tn → même joueur, même après une
       * recharge de page (selfId régénéré). En lobby, on admet aussi le pid
       * seul si l'ancien onglet est déconnecté (tab fermé puis rouvert). */
      let knownId = pid
        ? [...S.players.entries()]
          .find(([, pl]) => pl.pid === pid && (!tn || pl.tn === tn))?.[0]
        : undefined;
      if (!knownId && pid) {
        knownId = S.phase === 'LOBBY'
          ? [...S.players.entries()]
            .find(([, pl]) => pl.pid === pid && pl.tn !== tn && !pl.connected)?.[0]
          : undefined;
      }
      if (knownId && knownId !== peerId) {
        const pl = S.players.get(knownId);
        S.players.delete(knownId);
        if (name) pl.name = name;
        pl.pid = pid;
        pl.tn = tn;
        pl.connected = true;
        S.players.set(peerId, pl);
        if (S.chooserId === knownId) S.chooserId = peerId;
        /* le faux et le vote déjà envoyés par l'ancienne session suivent le joueur */
        for (const map of [S.fakes, S.votes]) {
          if (map.has(knownId)) {
            const v = map.get(knownId);
            map.delete(knownId);
            map.set(peerId, v);
          }
        }
      } else if (!S.players.has(peerId)) {
        if (S.phase !== 'LOBBY') {
          NET.send.send({ k: 'spectate' }, { target: peerId });
          return;
        }
        const pl = mkPlayer(peerId, name);
        pl.pid = pid;
        pl.tn = tn;
        S.players.set(peerId, pl);
      } else {
        const pl = S.players.get(peerId);
        if (name) pl.name = name;
        pl.pid = pid || pl.pid;
        pl.tn = tn || pl.tn;
        pl.connected = true;
      }
      if (S.phase === 'LOBBY') push();
      else NET.send.send({ k: 'view', ...hostView() }, { target: peerId });
      break;
    }
    case 'pick': {
      if (S.phase !== 'PICK' || peerId !== S.chooserId) return;
      const w = String(m.w || '').trim().slice(0, 40);
      const d = String(m.def || '').trim().slice(0, 300);
      if (!w || !d || S.used.has(w.toLowerCase())) {
        NET.send.send({ k: 'repick' }, { target: peerId });
        return;
      }
      S.word = w;
      S.pos = String(m.p || '').trim().slice(0, 10);
      S.realDef = d;
      S.used.add(w.toLowerCase());
      startDraft();
      break;
    }
    case 'def': {
      if (S.phase !== 'DRAFT' || peerId === S.chooserId || !S.players.has(peerId)) return;
      S.fakes.set(peerId, String(m.text || '').trim().slice(0, 220) || '(sans proposition)');
      push();
      if (expectedWriters().every((p) => S.fakes.has(p.id))) startRead();
      break;
    }
    case 'vote': {
      /* mode vocal seul : les votes (numéros seuls) arrivent déjà pendant la dictée */
      const oralNow = S.phase === 'READ' && S.hideText;
      if (!(S.phase === 'VOTE' || oralNow)
        || peerId === S.chooserId || !S.players.has(peerId)) return;
      const idx = Number(m.idx);
      if (!Number.isInteger(idx) || idx < 0 || idx >= (S.options?.length || 0)) return;
      if (!S.votes.has(peerId)) S.votes.set(peerId, idx);
      push();
      if (expectedWriters().length
        && expectedWriters().every((p) => S.votes.has(p.id))) {
        if (S.phase === 'READ') startVote();   // passe par VOTE (chrono, cohérence d'état)
        clearTimer('vote');
        startReveal();
      }
      break;
    }
  }
};

/* --- machine à états --- */
const startGame = () => {
  if (livePlayers().length < 3) return;
  S.rounds = livePlayers().length;
  clearAllTimers();
  nextTurn(0);
};

const nextTurn = (idx) => {
  clearAllTimers();
  if (S.rounds && S.round >= S.rounds) { S.phase = 'END'; push(); return; }
  const players = livePlayers();
  if (!players[idx]) { S.phase = 'END'; push(); return; }
  S.round++;
  S.cursor = idx;
  S.chooserId = players[idx].id;
  S.word = ''; S.pos = ''; S.realDef = ''; S.deadline = 0;
  S.fakes.clear(); S.votes.clear(); S.options = null; S.realIdx = -1;
  S.phase = 'PICK';
  S.deadline = nowPlus(CFG.pickSec);
  setTimer('pick', CFG.pickSec * 1000, () => { if (S.phase === 'PICK') hostForceRandom(); });
  push();
};

const hostForceRandom = () => {
  const w = randomPick(1, new Set([...S.used, ...localHist()]))[0];
  if (!w) return;
  S.word = w.w; S.pos = w.p; S.realDef = w.d;
  S.used.add(w.w.toLowerCase());
  startDraft();
};

const startDraft = () => {
  clearTimer('pick');
  rememberWord(S.word);     // mémorisé chez tous les téléphones : exclu des prochaines manches
  S.phase = 'DRAFT';
  S.deadline = nowPlus(CFG.draftSec);
  setTimer('draft', CFG.draftSec * 1000, () => { if (S.phase === 'DRAFT') startRead(); });
  push();
};

/* lecture par l'hôte puis vote ; en mode vocal seul, le vote (numéros seuls)
 * est possible dès la dictée — sinon il s'ouvre après validation de l'hôte */
const startRead = () => {
  if (S.phase !== 'DRAFT') return;
  const options = expectedWriters()
    .map((p) => ({ text: S.fakes.get(p.id) ?? '(sans proposition)', by: p.id }));
  options.push({ text: S.realDef, by: null });
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  S.options = options.map((o) => o.text);
  S.byIds = options.map((o) => o.by);
  S.realIdx = S.byIds.indexOf(null);
  S.phase = 'READ';
  clearTimer('draft');
  push();
};

const startVote = () => {
  if (S.phase !== 'READ') return;
  S.phase = 'VOTE';
  S.deadline = nowPlus(CFG.voteSec);
  setTimer('vote', CFG.voteSec * 1000, () => { if (S.phase === 'VOTE') startReveal(); });
  push();
  /* tout le monde a voté pendant la dictée ? dévoilement direct */
  if (expectedWriters().length && expectedWriters().every((p) => S.votes.has(p.id))) startReveal();
};

const hostForceDraft = () => { if (S.phase === 'DRAFT') startRead(); };

const hostForceVote = () => { if (S.phase === 'VOTE') { clearTimer('vote'); startReveal(); } };

const startReveal = () => {
  if (S.phase !== 'VOTE' && S.phase !== 'READ') return;
  clearTimer('vote');
  const deltas = new Map();
  for (let i = 0; i < (S.byIds?.length || 0); i++) {
    const here = [...S.votes.entries()].filter(([, idx]) => idx === i).map(([id]) => id);
    const by = S.byIds[i];
    if (by !== null) deltas.set(by, (deltas.get(by) || 0) + here.length);
    if (i === S.realIdx) {
      deltas.set(S.chooserId, (deltas.get(S.chooserId) || 0) + here.length);
      for (const v of here) deltas.set(v, (deltas.get(v) || 0) + 1);
    }
  }
  for (const [id, n] of deltas) {
    const p = S.players.get(id);
    if (p) p.score += n;
  }
  S.deltas = [...deltas.entries()];
  S.phase = 'REVEAL';
  push();
};

const checkForced = () => {
  if (S?.phase === 'DRAFT' && expectedWriters().length
    && expectedWriters().every((p) => S.fakes.has(p.id))) startRead();
  /* mode vocal seul : tous les votes pendant la dictée → dévoilement direct */
  if (S?.phase === 'READ' && S.hideText && expectedWriters().length
    && expectedWriters().every((p) => S.votes.has(p.id))) { startVote(); startReveal(); }
  if (S?.phase === 'VOTE' && expectedWriters().length
    && expectedWriters().every((p) => S.votes.has(p.id))) startReveal();
};

const endGame = () => { clearAllTimers(); S.phase = 'END'; push(); };

/* --- vue diffusée --- */
const hostView = () => ({
  phase: S.phase,
  round: S.round,
  rounds: S.rounds,
  chooserId: S.chooserId,
  players: livePlayers().map((p) => ({ id: p.id, name: p.name, score: p.score })),
  hideText: S.hideText,
  deadline: S.phase === 'VOTE' ? S.deadline : 0,
  /* le mot n'est diffusé qu'aux phases qui en ont besoin ; jamais pendant la
   * lecture (les invités n'ont rien à lire, c'est l'hôte qui dicte) */
  word: ['DRAFT', 'REVEAL'].includes(S.phase) ? S.word : undefined,
  pos: ['DRAFT', 'REVEAL'].includes(S.phase) ? S.pos : undefined,
  submitted: S.phase === 'DRAFT' ? [...S.fakes.keys()] : undefined,
  expectedN: ['DRAFT', 'READ', 'VOTE'].includes(S.phase) ? expectedWriters().length : undefined,
  /* textes diffusés seulement au vote hors mode vocal et au dévoilement ;
   * en READ l'hôte lit depuis son état interne S, rien ne fuit aux invités */
  options: (S.phase === 'REVEAL' || (S.phase === 'VOTE' && !S.hideText)) ? S.options : undefined,
  realIdx: S.phase === 'REVEAL' ? S.realIdx : undefined,
  byIds: S.phase === 'REVEAL' ? S.byIds : undefined,
  votes: S.phase === 'REVEAL' ? [...S.votes.entries()] : undefined,
  voted: ['READ', 'VOTE'].includes(S.phase) ? [...S.votes.keys()] : undefined,
  deltas: S.phase === 'REVEAL' ? S.deltas : undefined,
});

/* ------------------------------------------------------------------ invité */
const guestOnMsg = (m, peerId) => {
  if (!m || typeof m !== 'object') return;
  if (m.k === 'view') {
    V = { ...m, self: selfId, host: false };
    if (m.phase === 'DRAFT' && m.word) rememberWord(m.word);
    render();
  } else if (m.k === 'spectate') {
    V = { spectate: true };
    render();
  } else if (m.k === 'repick') {
    if (V) {
      V = { ...V, repicked: true };
      render();
    }
  }
};

/* ------------------------------------------------------------------ rendu */
const TEMP = { draft: '', manualOpen: false, mw: '', mp: '', md: '', phase: '' };

const render = () => {
  if (ABOUT_OPEN) { renderAbout(); return; }
  if (!NET) { renderStart(); return; }
  if (!V) { h('<p class="banner">Connexion aux relais… (quelques secondes)</p>'); return; }
  if (V.spectate) { renderSpectator(); return; }
  if (TEMP.phase !== V.phase) {     // changement de phase : on vide les brouillons
    TEMP.draft = '';
    if (V.phase === 'PICK') refillDeck();   // un nouveau paquet de cartes par manche
    TEMP.phase = V.phase;
  } else if (document.querySelector('#ta-def')) {
    TEMP.draft = document.querySelector('#ta-def').value;
  }
  switch (V.phase) {
    case 'LOBBY': renderLobby(); break;
    case 'PICK': renderPick(); break;
    case 'DRAFT': renderDraft(); break;
    case 'READ': renderRead(); break;
    case 'VOTE': renderVote(); break;
    case 'REVEAL': renderReveal(); break;
    case 'END': renderEnd(); break;
    default: renderStart();
  }
};

const nameById = (id) => (V.players || []).find((p) => p.id === id)?.name || '…';
const isChooser = () => V.chooserId === selfId;
const me = () => ({ id: selfId, name: localName() });

const playerCountHtml = (scored) => (V.players || []).map((p) => `
  <li>
    <span>${esc(p.name) || '<i>(sans nom)</i>'}${p.id === selfId ? ' <span class="badge">toi</span>' : ''}</span>
    <span>${scored ? `${p.score} pt${p.score > 1 ? 's' : ''}` : p.connected === false ? 'déconnecté' : ''}</span>
  </li>`).join('');

/* --- barre d'administration (hôte seulement) --- */
const adminBar = () => {
  if (!V.host) return '';
  const b = [];
  if (V.phase === 'LOBBY') {
    b.push(`<button id="bstart" class="primary">Lancer la partie (3 joueurs min)</button>`);
    b.push(`<label class="optline"><input type="checkbox" id="bhide" ${S?.hideText ? 'checked' : ''}/>Mode vocal seul — pendant la dictée : numéros seuls, vote dès la lecture</label>`);
  }
  if (V.phase === 'DRAFT') b.push(`<button id="bforce">Clore l'étape (${Math.min(V.submitted?.length || 0, V.expectedN || 0)}/${V.expectedN || 0})</button>`);
  if (V.phase === 'READ') b.push(`<button id="bforce">Passer au vote — tout le monde a entendu</button>`);
  if (V.phase === 'VOTE') b.push(`<button id="bforce">Forcer le dévoilement (${Math.min(V.voted?.length || 0, V.expectedN || 0)}/${V.expectedN || 0})</button>`);
  if (V.phase === 'REVEAL') b.push(`<button id="bnext" class="primary">Manche suivante</button>`);
  if (V.phase === 'END') b.push(`<button id="bnext" class="primary">Rejouer</button>`);
  if (V.phase === 'REVEAL') b.push(`<button id="bend" class="ghost danger">Terminer la partie</button>`);
  if (V.phase === 'END') b.push(`<button id="bend" class="ghost danger">Retour à l'accueil</button>`);
  return `<div class="card admin-card">${b.join('')}</div>`;
};

const wireAdmin = () => {
  const bstart = $('#bstart');
  if (bstart) bstart.addEventListener('click', startGame);
  $('#bhide')?.addEventListener('change', (e) => {
    if (S) { S.hideText = e.target.checked; push(); }
  });
  const bforce = $('#bforce');
  if (bforce) bforce.addEventListener('click', () => {
    if (V.phase === 'DRAFT') hostForceDraft();
    else if (V.phase === 'READ') startVote();
    else if (V.phase === 'VOTE') hostForceVote();
  });
  const bnext = $('#bnext');
  if (bnext && (V.phase === 'REVEAL' || V.phase === 'END')) {
    bnext.addEventListener('click', () => {
      if (V.phase === 'END') {
        for (const p of S.players.values()) p.score = 0;
        S.round = 0;
      }
      nextTurn((S.cursor + 1) % livePlayers().length);
    });
  }
  const bend = $('#bend');
  if (bend) bend.addEventListener('click', () => {
    if (V.phase === 'END') location.href = location.pathname;
    else endGame();
  });
};

/* --- À propos : attribution du pack de mots (CC BY-SA 4.0, Lexique) --- */
const renderAbout = () => {
  h(`
    <h1>À propos &amp; sources<small>licences du pack de mots</small></h1>
    <div class="card">
      <h2>Définitions — Wiktionnaire (CC BY-SA 4.0)</h2>
      <p>Les définitions embarquées dans le pack proviennent du
        <a href="https://fr.wiktionary.org" target="_blank" rel="noopener">Wiktionnaire francophone</a>,
        sous licence <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.fr" target="_blank" rel="noopener">Creative Commons Attribution – Partage dans les mêmes conditions 4.0</a>.
        Ce pack en est une adaptation conforme : la source est attribuée ici avec
        le lien vers sa licence, et toute redistribution du pack doit conserver
        cette mention dans les mêmes conditions.</p>
    </div>
    <div class="card">
      <h2>Sélection des mots — Lexique</h2>
      <p>La liste des mots et leur filtrage par fréquence d'usage s'appuient sur
        <a href="http://lexique.org" target="_blank" rel="noopener">Lexique</a>
        (lexique.org). Ces données sont destinées à un usage de recherche :
        à vérifier avant tout usage commercial.</p>
    </div>
    <div class="card">
      <h2>Hors pack</h2>
      <p>Les mots saisis manuellement en cours de partie ne viennent d'aucune
        source externe — ils restent entre vous. Le jeu et son protocole P2P
        (Trystero / WebRTC, relais Nostr) ne dépendent d'aucun serveur de jeu.</p>
    </div>
    <button id="bback" class="ghost">‹ Retour</button>
  `);
  $('#bback').addEventListener('click', () => { ABOUT_OPEN = false; render(); });
};

/* --- écran d'accueil --- */
const renderStart = () => {
  h(`
    <h1>Jeu du Dictionnaire<small>multijoueur local, zéro serveur</small></h1>
    <div class="card">
      <h2>Ton nom</h2>
      <input id="iname" maxlength="18" placeholder="ex. Léonie" value="${esc(localName())}" />
    </div>
    <div class="card">
      <h2>Créer une partie</h2>
      <p class="muted">Ton téléphone devient l'hôte. Désactive le VPN et évite les réseaux "invités" (isolation client).</p>
      <button id="bcreate" class="primary">Créer la salle</button>
    </div>
    <div class="card">
      <h2>Rejoindre</h2>
      <input id="icode" maxlength="6" autocapitalize="characters" placeholder="CODE SALLE" value="${esc(roomCode)}" />
      <button id="bjoin" class="primary">Rejoindre</button>
    </div>
    ${PACK ? `<p class="muted">📚 Pack : ${PACK.length} mots rares embarqués.</p>`
    : '<p class="muted">⚠️ Pack indisponible : mode saisie manuelle.</p>'}
    <button id="babout" class="ghost">ℹ️ À propos &amp; licences du pack</button>
  `);
  $('#babout').addEventListener('click', () => { ABOUT_OPEN = true; render(); });
  $('#iname').addEventListener('change', () => setName($('#iname').value));
  $('#bcreate').addEventListener('click', async () => {
    setName($('#iname').value);
    await boot(GENERATE_CODE(), true);
  });
  $('#bjoin').addEventListener('click', async () => {
    setName($('#iname').value);
    const code = ($('#icode').value || '').toUpperCase().trim();
    if (code.length < 4) return;
    await boot(code, false);
  });
};

const GENERATE_CODE = () => {
  const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += A[Math.floor(Math.random() * A.length)];
  return s;
};

const boot = async (code, isHost) => {
  try {
    await setupRoom(code, isHost);
  } catch (e) {
    alert(`Réseau : ${e.message || e}`);
    return;
  }
  if (urlName) sessionStorage.setItem('jdd.tab.name', urlName);
  if (isHost) buildState();
  V = null;
  hello();
  if (isHost) push();
  else {
    /* écran d'attente : temps écoulé, puis filet anti-blocage */
    const t0 = Date.now();
    clearInterval(waitingIv);
    const paintWaiting = () => {
      if (V) { clearInterval(waitingIv); return; }
      const secs = Math.round((Date.now() - t0) / 1000);
      h(`<p class="banner">Connexion au créateur… (${secs}&nbsp;s)</p>
        ${secs >= 6 ? `
        <p class="banner">On dirait que cela prend plus de temps que d'habitude. Pourquoi ne pas relancer un nouveau salon&nbsp;?</p>
        <button id="bnewroom" class="primary">Créer un nouveau salon</button>
        ${secs >= 15 ? '<p class="muted" style="text-align:center">Vérifie aussi le code et le Wi-Fi.</p>' : ''}` : ''}`);
      $('#bnewroom')?.addEventListener('click', failoverToNewRoom);
    };
    paintWaiting();
    waitingIv = setInterval(paintWaiting, 1000);
  }
};

/* le créateur ne répond pas : on quitte proprement la salle et on repart hôte */
const failoverToNewRoom = async () => {
  clearInterval(waitingIv);
  try { NET?.room?.leave?.(); } catch { }
  NET = null;
  history.replaceState(null, '', location.pathname);   // efface ?room=CODE
  await boot(GENERATE_CODE(), true);
};

/* --- LOBBY --- */
const renderLobby = () => {
  const link = `${location.origin}${location.pathname}?room=${esc(roomCode)}`;
  h(`
    <h1>Salle ${esc(roomCode)}<small>partagez le lien ou le code</small></h1>
    <div class="card">
      <h2>Joueurs (${V.players?.length || 0})</h2>
      <ul class="players">${playerCountHtml(false)}</ul>
      <button id="bcopy" class="ghost">📋 Copier le lien d'invitation</button>
    </div>
    <div class="card">
      <h2>Ton nom</h2>
      <input id="iname" maxlength="18" value="${esc(localName())}" />
    </div>
    ${adminBar()}
    <button id="babout" class="ghost">ℹ️ À propos &amp; licences</button>
    <button class="ghost danger" id="bleave">Quitter la salle</button>
  `);
  $('#babout')?.addEventListener('click', () => { ABOUT_OPEN = true; render(); });
  $('#bcopy')?.addEventListener('click', () => {
    navigator.clipboard?.writeText(link).then(
      () => alert('Lien copié : envoie-le aux autres joueurs.'),
      () => alert(`Lien :\n${link}`),
    );
  });
  const iname = $('#iname');
  if (iname) iname.addEventListener('change', () => {
    setName(iname.value);
    hello();
    if (V.host) {
      S.players.get(selfId).name = localName();
      push();
    }
  });
  $('#bleave')?.addEventListener('click', () => { location.href = location.pathname; });
  wireAdmin();
};

/* --- PICK : paquet de 10 cartes navigables --- */
let deck = [], deckIdx = 0;
const refillDeck = () => {
  deck = randomPick(10, new Set([...(S?.used ?? []), ...localHist()]));
  deckIdx = 0;
};

const renderPick = () => {
  const mine = isChooser();
  h(mine ? `
    <h1>Manche ${V.round}/${V.rounds}</h1>
    <p class="banner">À toi de choisir le mot obscur. Seuls tes yeux le voient.</p>
    ${V.repicked ? '<p class="err">Ce mot a déjà été joué dans cette partie — choisis-en un autre.</p>' : ''}
    ${PACK ? `
    <p class="muted" style="text-align:center">10 cartes — swipe (ou ‹ ›) pour feuilleter, tu peux repasser plusieurs fois</p>
    <div class="deck" id="deck">${deckHtml()}</div>
    <div class="deck-nav">
      <button id="bdprev" class="nav">‹</button>
      <span class="muted">${deckIdx + 1}/${deck.length}</span>
      <button id="bdnext" class="nav">›</button>
    </div>
    <button id="btake" class="primary">✓ Choisir ce mot</button>
    <button id="breroll" class="ghost">🎴 Nouveau paquet</button>` : '<p class="muted banner">Pas de pack embarqué sur ce téléphone.</p>'}
    <details class="manual" id="manual" ${TEMP.manualOpen ? 'open' : ''}>
      <summary>✍️ Saisie manuelle (tu dois connaître la vraie définition)</summary>
      <input id="iw" placeholder="Le mot" autocapitalize="none" value="${esc(TEMP.mw)}" />
      <input id="ip" placeholder="genre : n.m., n.f., adj., v." maxlength="10" value="${esc(TEMP.mp)}" />
      <input id="id" placeholder="La vraie définition (requis)" value="${esc(TEMP.md)}" />
      <button id="bpick" class="primary">Choisir ce mot</button>
    </details>
    ${adminBar()}` : `
    <h1>Manche ${V.round}/${V.rounds}</h1>
    <p class="banner"><b>${esc(nameById(V.chooserId))}</b> choisit un mot…</p>
    ${adminBar()}`);
  if (mine) wirePick();
  wireAdmin();
};

/* une carte au premier plan + la suivante pour l'effet paquet */
const deckHtml = () => {
  if (!deck[deckIdx]) {
    return '<div class="deck-card empty"><p class="banner">Paquet terminé — tire un nouveau 🎴 ou saisis manuellement ✍️</p></div>';
  }
  const cardHtml = (x, d) => `<div class="deck-card${d ? ' behind' : ''}" data-k="${d}" style="--d:${d}">
      <div class="dw">${esc(x.w)}</div>
      <div class="dp">${esc(x.p)}</div>
      <div class="dd">${esc(x.d)}</div>
    </div>`;
  const next = deck[(deckIdx + 1) % deck.length];
  return cardHtml(next, 1) + cardHtml(deck[deckIdx], 0);
};

const nextCard = () => { deckIdx = (deckIdx + 1) % deck.length; render(); };
const prevCard = () => { deckIdx = (deckIdx - 1 + deck.length) % deck.length; render(); };

const wirePick = () => {
  if (!deck.length) refillDeck();
  wireDeck();
  $('#breroll')?.addEventListener('click', () => { refillDeck(); render(); });
  $('#bdprev')?.addEventListener('click', prevCard);
  $('#bdnext')?.addEventListener('click', nextCard);
  $('#btake')?.addEventListener('click', () => {
    const x = deck[deckIdx];
    if (x) { deckIdx = (deckIdx + 1) % deck.length; sendPick(x.w, x.p, x.d); render(); }
  });
  const dpanel = $('#manual');
  dpanel?.addEventListener('toggle', () => { TEMP.manualOpen = dpanel.open; });
  $('#iw')?.addEventListener('input', () => { TEMP.mw = $('#iw').value; });
  $('#ip')?.addEventListener('input', () => { TEMP.mp = $('#ip').value; });
  $('#id')?.addEventListener('input', () => { TEMP.md = $('#id').value; });
  $('#bpick')?.addEventListener('click', () => {
    const w = (TEMP.mw || '').trim();
    const d = (TEMP.md || '').trim();
    if (!w || !d) return alert('Mot ET vraie définition requis (tu es le lecteur).');
    if (localHist().has(w.toLowerCase())) {
      return alert('Ce mot a déjà été joué sur ce téléphone — choisis-en un autre.');
    }
    const p = (TEMP.mp || 'n.').trim();
    TEMP.mw = ''; TEMP.mp = ''; TEMP.md = '';
    sendPick(w.toLowerCase(), p, d);
  });
};

/* swipe = navigation circulaire : droite → carte suivante, gauche → précédente */
const wireDeck = () => {
  const card = $('#deck .deck-card[data-k="0"]');
  if (!card || !deck[deckIdx]) return;
  let sx = null, dx = 0, dragging = false;
  card.addEventListener('pointerdown', (e) => {
    sx = e.clientX; dx = 0; dragging = true;
    try { card.setPointerCapture(e.pointerId); } catch { }
  });
  card.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    dx = e.clientX - sx;
    card.style.transform = `translateX(${dx}px) rotate(${dx / 40}deg)`;
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    if (dx > 70) { nextCard(); return; }
    if (dx < -70) { prevCard(); return; }
    card.style.transform = '';
  };
  card.addEventListener('pointerup', end);
  card.addEventListener('pointercancel', end);
};

const sendPick = (w, p, def) => {
  const msg = { k: 'pick', w, p, def };
  V.repicked = false;
  if (V.host) hostOnMsg(msg, selfId);
  else NET.send.send(msg);
};

/* --- DRAFT --- */
const renderDraft = () => {
  const submitted = V.submitted || [];
  const mine = !isChooser();
  const done = submitted.includes(selfId);
  const pct = Math.round((submitted.length / Math.max(1, V.expectedN || 1)) * 100);
  h(`
    <h1>Manche ${V.round}/${V.rounds}</h1>
    <div class="card">
      <div class="word-big">${esc(V.word)} <span class="pos">${esc(V.pos || '')}</span></div>
      <p class="banner" data-timer="${V.deadline || 0}">${fmtTimer(V.deadline)}</p>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <p class="muted" style="text-align:center">${submitted.length}/${V.expectedN} définitions reçues</p>
      ${isChooser()
    ? `<p class="banner">Les autres inventent un faux… Tu liras toutes les propositions à voix haute ensuite.</p>`
    : done
      ? `<p class="banner">Proposition envoyée ✓</p>`
      : `
      <label>Ta définition (fausse — tu sais, elle ne sera pas la vraie)</label>
      <textarea id="ta-def" maxlength="220" placeholder="Que diable peut bien vouloir dire « ${esc(V.word)} »&nbsp;?…">${esc(TEMP.draft)}</textarea>
      <button id="bsend" class="primary">Envoyer mon faux</button>`}
    </div>
    ${V.host && S ? hostDraftPanel() : ''}
    ${adminBar()}
  `);
  const ta = $('#ta-def');
  if (ta) ta.addEventListener('input', () => { TEMP.draft = ta.value; });
  $('#bsend')?.addEventListener('click', () => {
    const text = ta.value.trim();
    if (!text) return;
    TEMP.draft = '';
    const msg = { k: 'def', text };
    if (V.host) hostOnMsg(msg, selfId);
    else NET.send.send(msg);
  });
  wireAdmin();
};

/* panneau réservé à l'hôte : tout ce qu'il lui faut pendant qu'on invente */
const hostDraftPanel = () => {
  const rows = [...S.fakes.entries()]
    .map(([id, t]) => `<li>
      <span>${esc(S.players.get(id)?.name || id.slice(0, 6))}</span>
      <span class="muted" style="text-align:right;max-width:60%">${esc(t)}</span>
    </li>`).join('');
  return `<div class="card host-only">
    <h2>Tableau de l'hôte</h2>
    <p><b>${esc(S.word)}</b> <span class="muted">${esc(S.pos || '')}</span></p>
    <p class="muted big-def">Vraie définition : ${esc(S.realDef)}</p>
    ${rows
    ? `<p class="muted">Définitions reçues en direct :</p><ul class="players">${rows}</ul>`
    : '<p class="banner">Aucune définition reçue pour l\u2019instant…</p>'}
  </div>`;
};

/* --- LECTURE : l'hôte dicte, les invités n'ont rien (ou des numéros en mode vocal) --- */
const hostReadCard = () => `
  <div class="card host-only">
    <h2>Lis à voix haute</h2>
    <p class="muted">D'abord le mot… puis les définitions dans l'ordre. Ne montre pas cet écran.</p>
    <div class="word-big">${esc(S.word)} <span class="pos">${esc(S.pos || '')}</span></div>
    ${(S.options || []).map((o, i) =>
      `<div class="opt${i === S.realIdx ? ' host-real' : ''}"><span class="n">${i + 1}</span>${esc(o)}</div>`).join('')}
    ${V.hideText
      ? `<p class="banner">🗳️ ${S.votes.size} vote(s) reçus pendant ta dictée (mode vocal : ils votent en numéros)</p>`
      : '<p class="muted" style="text-align:center">Le vote s\u2019ouvrira quand tu auras fini de lire.</p>'}
  </div>`;

const renderRead = () => {
  const mine = isChooser();
  const iVoted = (V.voted || []).includes(selfId);
  let body = '';
  if (V.host) {
    body = hostReadCard();
  } else if (mine) {
    body = `<div class="card">
      <h2>Écoute</h2>
      <p class="banner">L'hôte dicte le mot puis les définitions, à voix haute.</p>
      <p class="muted" style="text-align:center">Tu ne votes pas — c'est toi qui as choisi le mot.${V.hideText ? ' Les autres votent déjà, en numéros seuls.' : ''}</p>
    </div>`;
  } else if (V.hideText) {
    /* mode vocal seul : numéros seuls, on peut voter pendant la dictée */
    body = iVoted
      ? `<p class="banner">Vote enregistré ✓ — ${(V.voted || []).length}/${V.expectedN} votes…</p>`
      : `<p class="banner">Vote pendant la dictée — les textes restent masqués&nbsp;:</p>
        ${voteBoard([], true)}`;
  } else if (iVoted) {
    body = `<p class="banner">Vote enregistré ✓ — ${(V.voted || []).length}/${V.expectedN} votes…</p>`;
  } else {
    body = `<div class="card">
      <h2>Écoute</h2>
      <p class="banner">Le mot et les définitions seront dictés à voix haute.</p>
      <p class="muted" style="text-align:center">Ne lis rien à l'écran : retiens ce que tu entends, le vote s'ouvrira quand l'hôte aura fini.</p>
    </div>`;
  }
  h(`
    <h1>Manche ${V.round}/${V.rounds} — lecture</h1>
    ${body}
    ${adminBar()}
  `);
  document.querySelectorAll('[data-v]').forEach((el) => el.addEventListener('click', () => {
    const msg = { k: 'vote', idx: Number(el.dataset.v) };
    if (V.host) hostOnMsg(msg, selfId);
    else NET.send.send(msg);
  }));
  wireAdmin();
};

/* --- VOTE : s'ouvre après la validation de l'hôte (mode normal),
 *     ou continue en numéros seuls (mode vocal, certains ont déjà voté) --- */
const renderVote = () => {
  const mine = isChooser();
  const iVoted = (V.voted || []).includes(selfId);
  let body = '';
  if (mine) {
    body = `<p class="banner">Les autres votent… (tu ne votes pas — tu as choisi le mot)</p>`;
  } else if (iVoted) {
    body = `<p class="banner">Vote enregistré ✓ — ${(V.voted || []).length}/${V.expectedN} votes reçus…</p>`;
  } else if (V.host) {
    /* l'hôte voit toutes les propositions, et vote par numéro comme tout le monde */
    body = `${hostVotePanel()}
      <p class="muted" style="text-align:center">Ton bulletin — clique un numéro&nbsp;:</p>
      ${voteBoard([], true)}`;
  } else if (V.hideText) {
    body = `<p class="banner">Mode vocal : numéros seuls, souviens-toi de la dictée.</p>
      ${voteBoard([], true)}`;
  } else {
    body = `<p class="muted" style="text-align:center">Quelle définition est la vraie&nbsp;?</p>
      ${voteBoard(V.options || [], false)}`;
  }
  h(`
    <h1>Manche ${V.round}/${V.rounds} — vote</h1>
    ${body}
    <p class="banner" data-timer="${V.deadline || 0}">${fmtTimer(V.deadline)}</p>
    ${adminBar()}
  `);
  document.querySelectorAll('[data-v]').forEach((el) => el.addEventListener('click', () => {
    const msg = { k: 'vote', idx: Number(el.dataset.v) };
    if (V.host) hostOnMsg(msg, selfId);
    else NET.send.send(msg);
  }));
  wireAdmin();
};

/* options du vote : numéros seuls si hideText, sinon textes */
const voteBoard = (texts, hidden) => {
  const n = Math.max(texts.length, (V.expectedN || 0) + 1);
  return Array.from({ length: n }, (_, i) =>
    hidden
      ? `<div class="opt vote" data-v="${i}"><span class="n">${i + 1}</span><span class="muted">définition n°${i + 1} — entendue à voix haute</span></div>`
      : `<div class="opt vote" data-v="${i}"><span class="n">${i + 1}</span>${esc(texts[i] ?? '…')}</div>`).join('');
};

/* panneau hôte pendant le vote : les textes complets + comptes de votes en direct */
const hostVotePanel = () => {
  const counts = {};
  for (const [, idx] of S?.votes ?? []) counts[idx] = (counts[idx] || 0) + 1;
  return `<div class="card host-only">
    <h2>Tableau de l'hôte — propositions</h2>
    ${S?.options?.length ? S.options.map((o, i) =>
      `<div class="opt${i === S.realIdx ? ' host-real' : ''}">
        <span class="n">${i + 1}</span>${esc(o)}
        ${counts[i] ? ` <span class="badge">🗳️ ${counts[i]}</span>` : ''}
      </div>`).join('')
    : '<p class="muted">Aucune proposition…</p>'}
  </div>`;
};

/* --- REVEAL --- */
const renderReveal = () => {
  const votesCount = {};
  for (const [, idx] of V.votes || []) votesCount[idx] = (votesCount[idx] || 0) + 1;
  const myVote = (V.votes || []).find(([id]) => id === selfId)?.[1];
  const rows = (V.options || []).map((o, i) => {
    const real = V.realIdx === i;
    const by = V.byIds?.[i];
    const author = by === null ? '<b>vraie définition</b>' : esc(nameById(by));
    return `
      <div class="opt ${real ? 'real' : ''} ${by === selfId ? 'mine' : ''}">
        <span class="n">${i + 1}</span>${esc(o)}
        <div class="muted" style="margin-top:6px">
          ${votesCount[i] ? `🗳️ ${votesCount[i]}` : ''} — ${author}${real ? ' <span class="badge real">vraie</span>' : ''}
          ${myVote === i ? ' · ton vote' : by === selfId ? ' · ton(s) faux' : ''}
        </div>
      </div>`;
  }).join('');
  const deltas = new Map(V.deltas || []);
  h(`
    <h1>Manche ${V.round}/${V.rounds} — dévoilement</h1>
    <div class="card">
      <div class="word-big">${esc(V.word)} <span class="pos">${esc(V.pos || '')}</span></div>
      ${rows}
      <ul class="players" style="margin-top:12px">
        ${(V.players || []).map((p) => `
          <li>
            <span>${esc(p.name)}${p.id === selfId ? ' <span class="badge">toi</span>' : ''} <span class="muted">+${deltas.get(p.id) || 0}</span></span>
            <b>${p.score}</b>
          </li>`).join('')}
      </ul>
    </div>
    ${adminBar()}
  `);
  wireAdmin();
};

/* --- SPECTATOR --- */
const renderSpectator = () => h(`
  <h1>Partie déjà lancée</h1>
  <p class="banner">Tu es spectateur : dans ce prototype, on ne peut rejoindre qu'au lobby.</p>
  <button class="ghost" onclick="location.href=location.pathname">Retour à l'accueil</button>
`);

/* --- END --- */
const renderEnd = () => {
  const best = [...(V.players || [])].sort((a, b) => b.score - a.score);
  h(`
    <h1>Fin de partie 🏁</h1>
    <div class="card">
      <h2>Classement</h2>
      <ul class="players">
        ${best.map((p, i) => `<li><span>${['🥇', '🥈', '🥉'][i] || '·'} ${esc(p.name)}${p.id === selfId ? ' <span class="badge">toi</span>' : ''}</span><b>${p.score}</b></li>`).join('')}
      </ul>
    </div>
    ${adminBar()}
  `);
  wireAdmin();
};

/* ------------------------------------------------------------------ boot */
if (roomCode) await boot(roomCode, false);
else renderStart();
