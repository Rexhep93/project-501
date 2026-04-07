/* PROJECT 501 — LIVE TRANSFERMARKT EDITION */

// ============================================================
// CONFIG
// ============================================================
const API_BASE = ''; // same origin (project-501.vercel.app)
const IMPOSSIBLE_SCORES = new Set([163, 166, 169, 172, 173, 175, 176, 178, 179]);
const MAX_SCORE = 180;
const WIN_THRESHOLD = -10;

// ============================================================
// 30 QUESTIONS — gebruikt raw stats uit Transfermarkt
// raw indexen: [0=leeg, 1=naam, 2=apps, 3=goals, 4=assists, 5=yellow, 6=2nd_yellow, 7=red, 8=minutes]
// ============================================================
const QUESTIONS = [
  // Premier League (8)
  {label:"Premier League Goals",       desc:"Goals in de Premier League",       comp:"Premier League", stat:3},
  {label:"Premier League Appearances", desc:"Wedstrijden in de Premier League", comp:"Premier League", stat:2},
  {label:"Premier League Assists",     desc:"Assists in de Premier League",     comp:"Premier League", stat:4},
  {label:"Premier League Yellow Cards",desc:"Gele kaarten in de Premier League",comp:"Premier League", stat:5},
  {label:"FA Cup Goals",               desc:"Goals in de FA Cup",               comp:"FA Cup",         stat:3},
  {label:"FA Cup Appearances",         desc:"Wedstrijden in de FA Cup",         comp:"FA Cup",         stat:2},
  {label:"EFL Cup Goals",              desc:"Goals in de EFL Cup",              comp:"EFL Cup",        stat:3},
  {label:"Championship Goals",         desc:"Goals in de Championship",         comp:"Championship",   stat:3},
  // LaLiga (5)
  {label:"LaLiga Goals",       desc:"Goals in LaLiga",       comp:"LaLiga", stat:3},
  {label:"LaLiga Appearances", desc:"Wedstrijden in LaLiga", comp:"LaLiga", stat:2},
  {label:"LaLiga Assists",     desc:"Assists in LaLiga",     comp:"LaLiga", stat:4},
  {label:"Copa del Rey Goals", desc:"Goals in de Copa del Rey", comp:"Copa del Rey", stat:3},
  {label:"Supercopa Goals",    desc:"Goals in de Spaanse Supercopa", comp:"Supercopa", stat:3},
  // Serie A (3)
  {label:"Serie A Goals",       desc:"Goals in Serie A",       comp:"Serie A", stat:3},
  {label:"Serie A Appearances", desc:"Wedstrijden in Serie A", comp:"Serie A", stat:2},
  {label:"Coppa Italia Goals",  desc:"Goals in de Coppa Italia", comp:"Italy Cup", stat:3},
  // Bundesliga + Ligue 1 (3)
  {label:"Bundesliga Goals",       desc:"Goals in de Bundesliga",       comp:"Bundesliga", stat:3},
  {label:"Bundesliga Appearances", desc:"Wedstrijden in de Bundesliga", comp:"Bundesliga", stat:2},
  {label:"Ligue 1 Goals",          desc:"Goals in de Ligue 1",          comp:"Ligue 1",    stat:3},
  // Eredivisie (2)
  {label:"Eredivisie Goals",       desc:"Goals in de Eredivisie",       comp:"Eredivisie", stat:3},
  {label:"Eredivisie Appearances", desc:"Wedstrijden in de Eredivisie", comp:"Eredivisie", stat:2},
  // Europese cups (5)
  {label:"Champions League Goals",       desc:"Goals in de Champions League",       comp:"UEFA Champions League", stat:3},
  {label:"Champions League Appearances", desc:"Wedstrijden in de Champions League", comp:"UEFA Champions League", stat:2},
  {label:"Champions League Assists",     desc:"Assists in de Champions League",     comp:"UEFA Champions League", stat:4},
  {label:"Europa League Goals",          desc:"Goals in de Europa League",          comp:"Europa League",         stat:3},
  {label:"UEFA Super Cup Apps",          desc:"Wedstrijden in de UEFA Super Cup",   comp:"UEFA Super Cup",        stat:2},
  // Portugal + andere (4)
  {label:"Liga Portugal Goals",      desc:"Goals in de Primeira Liga", comp:"Liga Portugal",   stat:3},
  {label:"Taça de Portugal Goals",   desc:"Goals in de Taça de Portugal", comp:"Taça de Portugal", stat:3},
  {label:"Saudi Pro League Goals",   desc:"Goals in de Saudi Pro League", comp:"Saudi Pro League", stat:3},
  {label:"Club World Cup Goals",     desc:"Goals in het FIFA Club World Cup", comp:"Club World Cup", stat:3},
];

// ============================================================
// COUNTRY → FLAG
// ============================================================
const FLAGS = {
  "Argentina":"🇦🇷","Australia":"🇦🇺","Austria":"🇦🇹","Belgium":"🇧🇪","Brazil":"🇧🇷","Bulgaria":"🇧🇬",
  "Cameroon":"🇨🇲","Canada":"🇨🇦","Chile":"🇨🇱","Colombia":"🇨🇴","Croatia":"🇭🇷","Czech Republic":"🇨🇿",
  "Denmark":"🇩🇰","Ecuador":"🇪🇨","Egypt":"🇪🇬","England":"🏴󠁧󠁢󠁥󠁮󠁧󠁿","Finland":"🇫🇮","France":"🇫🇷",
  "Germany":"🇩🇪","Ghana":"🇬🇭","Greece":"🇬🇷","Guinea":"🇬🇳","Guinea-Bissau":"🇬🇼","Hungary":"🇭🇺",
  "Iceland":"🇮🇸","Iran":"🇮🇷","Ireland":"🇮🇪","Israel":"🇮🇱","Italy":"🇮🇹","Ivory Coast":"🇨🇮",
  "Jamaica":"🇯🇲","Japan":"🇯🇵","Korea, South":"🇰🇷","Mexico":"🇲🇽","Montenegro":"🇲🇪","Morocco":"🇲🇦",
  "Netherlands":"🇳🇱","Nigeria":"🇳🇬","North Macedonia":"🇲🇰","Northern Ireland":"🏴","Norway":"🇳🇴",
  "Paraguay":"🇵🇾","Peru":"🇵🇪","Poland":"🇵🇱","Portugal":"🇵🇹","Romania":"🇷🇴","Russia":"🇷🇺",
  "Saudi Arabia":"🇸🇦","Scotland":"🏴󠁧󠁢󠁳󠁣󠁴󠁿","Senegal":"🇸🇳","Serbia":"🇷🇸","Slovakia":"🇸🇰","Slovenia":"🇸🇮",
  "South Korea":"🇰🇷","Spain":"🇪🇸","Sweden":"🇸🇪","Switzerland":"🇨🇭","Tunisia":"🇹🇳","Turkey":"🇹🇷",
  "Ukraine":"🇺🇦","United States":"🇺🇸","Uruguay":"🇺🇾","Venezuela":"🇻🇪","Wales":"🏴󠁧󠁢󠁷󠁬󠁳󠁿",
  "Algeria":"🇩🇿","Bosnia-Herzegovina":"🇧🇦","Cape Verde":"🇨🇻","Mali":"🇲🇱","DR Congo":"🇨🇩",
  "Albania":"🇦🇱","Kosovo":"🇽🇰","Georgia":"🇬🇪","Armenia":"🇦🇲","Azerbaijan":"🇦🇿",
};
function getFlag(n) { return FLAGS[n] || "🌍"; }

// ============================================================
// STATE
// ============================================================
let gameMode = 'solo';
let currentQuestion = null;
let currentTurn = 0;
let scores = [501, 501];
let turnNumber = 0;
let usedPlayerIds = new Set();

const $ = (id) => document.getElementById(id);

// ============================================================
// HELPERS
// ============================================================
function parseStat(rawStr) {
  if (!rawStr || rawStr === '-') return 0;
  // Transfermarkt: "1.580'" of "292"
  const cleaned = String(rawStr).replace(/[.']/g, '').trim();
  const n = parseInt(cleaned, 10);
  return isNaN(n) ? 0 : n;
}

function getStatFromPlayer(playerData, question) {
  if (!playerData || !playerData.clubs) return null;
  // Zoek competitie in alle clubs/secties
  for (const club of playerData.clubs) {
    for (const c of (club.competitions || [])) {
      if (c.competition === question.comp) {
        return parseStat(c.raw[question.stat]);
      }
    }
  }
  return 0; // competitie niet gevonden = 0 = bust
}

function checkBust(stat, currentScore) {
  if (stat === 0) return true;
  if (stat > MAX_SCORE) return true;
  if (IMPOSSIBLE_SCORES.has(stat)) return true;
  if (currentScore - stat < WIN_THRESHOLD) return true;
  return false;
}

// ============================================================
// SCREEN MGMT
// ============================================================
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}

// ============================================================
// FLOW
// ============================================================
function startSetup(mode) {
  gameMode = mode;
  pickRandomQuestion();
  showScreen('categoryScreen');
}

function pickRandomQuestion() {
  currentQuestion = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
  $('catRevealName').textContent = currentQuestion.label;
  $('catRevealDesc').textContent = currentQuestion.desc;
}

function startGame() {
  scores = [501, 501];
  usedPlayerIds = new Set();
  currentTurn = 0;
  turnNumber = 1;

  $('gameCategoryLabel').textContent = currentQuestion.label;
  $('score1').textContent = '501';
  $('score2').textContent = '501';
  $('last1').innerHTML = '';
  $('last2').innerHTML = '';
  $('historySection').innerHTML = '';
  $('playerInput').value = '';

  if (gameMode === 'multi') {
    $('scorePanel2').style.display = '';
    $('p1Label').textContent = 'Speler 1';
    $('p2Label').textContent = 'Speler 2';
  } else {
    $('scorePanel2').style.display = 'none';
    $('p1Label').textContent = 'Jij';
  }

  updateTurnUI();
  showScreen('gameScreen');
  setTimeout(() => $('playerInput').focus(), 300);
}

function updateTurnUI() {
  const p1 = $('scorePanel1');
  const p2 = $('scorePanel2');

  if (gameMode === 'solo') {
    $('gameTurnLabel').textContent = `Beurt ${turnNumber}`;
    p1.classList.add('active-turn');
  } else {
    const who = currentTurn === 0 ? 'Speler 1' : 'Speler 2';
    $('gameTurnLabel').textContent = `Beurt ${turnNumber} — ${who}`;
    p1.classList.toggle('active-turn', currentTurn === 0);
    p2.classList.toggle('active-turn', currentTurn === 1);
  }

  [0, 1].forEach(i => {
    const el = $(`score${i + 1}`);
    el.className = 'score-value';
    if (scores[i] <= 50) el.classList.add('low');
    if (scores[i] <= 10) el.classList.add('danger');
  });
}

function nextTurn() {
  if (gameMode === 'multi') {
    currentTurn = currentTurn === 0 ? 1 : 0;
    if (currentTurn === 0) turnNumber++;
  } else {
    turnNumber++;
  }
  $('playerInput').value = '';
  $('acList').classList.remove('show');
  updateTurnUI();
  setTimeout(() => $('playerInput').focus(), 100);
}

// ============================================================
// SUBMIT (LIVE API CALL)
// ============================================================
async function submitPlayer(player) {
  if (usedPlayerIds.has(player.id)) {
    showFeedback('Speler al gebruikt!');
    return;
  }
  usedPlayerIds.add(player.id);

  // Loading state
  $('playerInput').disabled = true;
  $('playerInput').value = `${player.name} — laden...`;

  try {
    const resp = await fetch(`${API_BASE}/api/player?id=${player.id}`);
    const data = await resp.json();

    if (!data.clubs) {
      showFeedback('Geen data');
      $('playerInput').disabled = false;
      $('playerInput').value = '';
      return;
    }

    const stat = getStatFromPlayer(data, currentQuestion);
    const isBust = checkBust(stat, scores[currentTurn]);

    if (isBust) {
      const reason = stat > MAX_SCORE ? `${stat} > 180`
        : IMPOSSIBLE_SCORES.has(stat) ? `${stat} onmogelijk`
        : stat === 0 ? '0 — geen data'
        : `Te ver`;
      addHistory(currentTurn, player.name, stat, true, reason);
      updateLastScore(currentTurn, `BUST — ${player.name} (${stat})`, true);
      const panel = $(`scorePanel${currentTurn + 1}`);
      panel.classList.add('bust');
      setTimeout(() => panel.classList.remove('bust'), 500);
    } else {
      scores[currentTurn] -= stat;
      $(`score${currentTurn + 1}`).textContent = scores[currentTurn];
      addHistory(currentTurn, player.name, stat, false);
      updateLastScore(currentTurn, `${player.name} — ${stat}`, false);

      if (scores[currentTurn] <= 0 && scores[currentTurn] >= WIN_THRESHOLD) {
        if (gameMode === 'multi' && currentTurn === 0) {
          $('playerInput').disabled = false;
          nextTurn();
          return;
        }
        endGame();
        return;
      }
    }

    $('playerInput').disabled = false;
    nextTurn();
  } catch (err) {
    console.error(err);
    showFeedback('API fout');
    $('playerInput').disabled = false;
    $('playerInput').value = '';
  }
}

function updateLastScore(idx, text, isBust) {
  $(`last${idx + 1}`).innerHTML = `<span class="${isBust ? 'bust' : 'hit'}">${text}</span>`;
}

function addHistory(idx, name, stat, isBust, reason) {
  const section = $('historySection');
  const div = document.createElement('div');
  div.className = 'history-item';
  const whoClass = idx === 0 ? 'p1' : 'p2';
  const whoLabel = gameMode === 'solo' ? turnNumber : (idx === 0 ? 'P1' : 'P2');
  const scoreClass = isBust ? 'bust' : 'hit';
  const scoreText = isBust ? 'BUST' : `-${stat}`;
  const detail = reason || `${stat}`;
  div.innerHTML = `
    <div class="h-who ${whoClass}">${whoLabel}</div>
    <div style="flex:1"><div>${name}</div><div class="h-player">${detail}</div></div>
    <div class="h-score ${scoreClass}">${scoreText}</div>
  `;
  section.insertBefore(div, section.firstChild);
}

function showFeedback(msg) {
  const input = $('playerInput');
  input.value = '';
  input.placeholder = msg;
  setTimeout(() => { input.placeholder = 'Typ een spelersnaam...'; }, 2000);
}

// ============================================================
// END GAME
// ============================================================
function endGame() {
  let winner, detail;
  if (gameMode === 'solo') {
    winner = 'Gewonnen!';
    detail = `In ${turnNumber} beurten`;
  } else {
    const z0 = scores[0] <= 0 && scores[0] >= WIN_THRESHOLD;
    const z1 = scores[1] <= 0 && scores[1] >= WIN_THRESHOLD;
    if (z0 && z1) {
      const d0 = Math.abs(scores[0]), d1 = Math.abs(scores[1]);
      if (d0 < d1) { winner = 'Speler 1 wint!'; detail = 'Dichter bij 0'; }
      else if (d1 < d0) { winner = 'Speler 2 wint!'; detail = 'Dichter bij 0'; }
      else { winner = 'Gelijkspel!'; detail = ''; }
    } else if (z0) { winner = 'Speler 1 wint!'; detail = `Op ${scores[0]}`; }
    else { winner = 'Speler 2 wint!'; detail = `Op ${scores[1]}`; }
  }
  $('winTitle').textContent = winner;
  $('winDetail').textContent = detail;
  const sd = $('winScores');
  if (gameMode === 'solo') {
    sd.innerHTML = `<div class="win-score-box winner"><div class="wsb-name">Eindscore</div><div class="wsb-score">${scores[0]}</div></div><div class="win-score-box"><div class="wsb-name">Beurten</div><div class="wsb-score">${turnNumber}</div></div>`;
  } else {
    const w0 = scores[0] <= 0 && scores[0] >= WIN_THRESHOLD;
    const w1 = scores[1] <= 0 && scores[1] >= WIN_THRESHOLD;
    sd.innerHTML = `<div class="win-score-box ${w0?'winner':''}"><div class="wsb-name">Speler 1</div><div class="wsb-score">${scores[0]}</div></div><div class="win-score-box ${w1?'winner':''}"><div class="wsb-name">Speler 2</div><div class="wsb-score">${scores[1]}</div></div>`;
  }
  showScreen('winScreen');
}

// ============================================================
// AUTOCOMPLETE (LIVE API)
// ============================================================
let acHighlight = -1;
let acResults = [];
let debounceTimer = null;
let searchAbortController = null;

function initAutocomplete() {
  const input = $('playerInput');
  const list = $('acList');

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => searchPlayers(input.value), 250);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      acHighlight = Math.min(acHighlight + 1, acResults.length - 1);
      updateAcHighlight();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      acHighlight = Math.max(acHighlight - 1, 0);
      updateAcHighlight();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (acHighlight >= 0 && acResults[acHighlight]) selectPlayer(acResults[acHighlight]);
      else if (acResults.length === 1) selectPlayer(acResults[0]);
    } else if (e.key === 'Escape') {
      list.classList.remove('show');
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrap')) list.classList.remove('show');
  });
}

async function searchPlayers(query) {
  const list = $('acList');
  if (query.length < 2) {
    list.classList.remove('show');
    acResults = [];
    return;
  }

  // Cancel previous search
  if (searchAbortController) searchAbortController.abort();
  searchAbortController = new AbortController();

  try {
    const resp = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(query)}`, {
      signal: searchAbortController.signal,
    });
    const data = await resp.json();
    acResults = (data.players || []).filter(p => !usedPlayerIds.has(p.id));
    acHighlight = -1;
    renderAc();
  } catch (e) {
    if (e.name !== 'AbortError') console.error(e);
  }
}

function renderAc() {
  const list = $('acList');
  if (acResults.length === 0) {
    list.classList.remove('show');
    return;
  }
  list.innerHTML = '';
  acResults.forEach((p, i) => {
    const div = document.createElement('div');
    div.className = 'ac-item' + (i === acHighlight ? ' highlighted' : '');
    div.innerHTML = `
      <span class="ac-flag">${getFlag(p.nationality)}</span>
      <div class="ac-info">
        <div class="ac-name">${p.name}</div>
        ${p.nationality ? `<div class="ac-meta">${p.nationality}</div>` : ''}
      </div>
    `;
    div.addEventListener('click', () => selectPlayer(p));
    list.appendChild(div);
  });
  list.classList.add('show');
}

function updateAcHighlight() {
  $('acList').querySelectorAll('.ac-item').forEach((el, i) => {
    el.classList.toggle('highlighted', i === acHighlight);
  });
}

function selectPlayer(player) {
  $('acList').classList.remove('show');
  submitPlayer(player);
}

// ============================================================
// EVENTS
// ============================================================
function initEvents() {
  document.querySelectorAll('[data-mode]').forEach(btn => {
    btn.addEventListener('click', () => startSetup(btn.dataset.mode));
  });
  document.querySelectorAll('[data-target]').forEach(btn => {
    btn.addEventListener('click', () => showScreen(btn.dataset.target));
  });
  $('btnPlayCategory').addEventListener('click', startGame);
  $('btnSkipCategory').addEventListener('click', pickRandomQuestion);
  $('btnBackToMenu').addEventListener('click', () => showScreen('startScreen'));
  $('rematchBtn').addEventListener('click', () => {
    pickRandomQuestion();
    showScreen('categoryScreen');
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initEvents();
  initAutocomplete();
});
