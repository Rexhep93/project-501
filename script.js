/* ============================================================
   PROJECT 501 — GAME LOGIC
   ============================================================ */

// ============================================================
// CONSTANTS
// ============================================================

const DATA_BASE = 'data/players/';
const IMPOSSIBLE_SCORES = new Set([163, 166, 169, 172, 173, 175, 176, 178, 179]);
const MAX_SCORE = 180;
const WIN_THRESHOLD = -10; // Win zone: 0 t/m -10
const TIMER_SECONDS = 30;

// ============================================================
// STATE
// ============================================================

let autocompleteData = [];  // [{id, n}]
let categories = [];
let playerCache = {};       // letter → [player objects]
let usedPlayerIds = new Set();

let gameMode = 'solo';      // 'solo' | 'multi'
let selectedCategory = null;
let currentTurn = 0;        // 0 = player 1, 1 = player 2
let scores = [501, 501];
let turnNumber = 0;
let timerInterval = null;
let timerRemaining = TIMER_SECONDS;

// DOM refs
const $ = (id) => document.getElementById(id);

// ============================================================
// DATA LOADING
// ============================================================

async function loadData() {
  try {
    const [acResp, catResp] = await Promise.all([
      fetch('data/autocomplete.json'),
      fetch('data/categories.json')
    ]);
    autocompleteData = await acResp.json();
    categories = await catResp.json();
    console.log(`Loaded ${autocompleteData.length} players, ${categories.length} categories`);
  } catch (e) {
    console.error('Data laden mislukt:', e);
  }
}

function normalizeLetterJS(name) {
  if (!name) return '_';
  let letter = name.charAt(0).toUpperCase();
  let normalized = letter.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (normalized === 'Ø') normalized = 'O';
  return /[A-Z]/.test(normalized) ? normalized : '_';
}

async function getPlayerById(id) {
  const entry = autocompleteData.find(p => p.id === id);
  if (!entry) return null;

  const letter = normalizeLetterJS(entry.n);
  if (!playerCache[letter]) {
    try {
      const resp = await fetch(`${DATA_BASE}${letter}.json`);
      playerCache[letter] = await resp.json();
    } catch (e) {
      console.error(`Kan ${letter}.json niet laden:`, e);
      return null;
    }
  }
  return playerCache[letter].find(p => p.id === id) || null;
}

// ============================================================
// SCREEN MANAGEMENT
// ============================================================

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}

// ============================================================
// CATEGORIES
// ============================================================

function renderCategories() {
  const grid = $('categoryGrid');
  grid.innerHTML = '';
  categories.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'cat-btn';
    btn.innerHTML = `${cat.label}<div class="cat-desc">${cat.desc}</div>`;
    btn.addEventListener('click', () => selectCategory(cat, btn));
    grid.appendChild(btn);
  });
}

function selectCategory(cat, btn) {
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedCategory = cat;
  $('startGameBtn').disabled = false;
}

// ============================================================
// GAME SETUP
// ============================================================

function startSetup(mode) {
  gameMode = mode;
  selectedCategory = null;
  $('startGameBtn').disabled = true;
  renderCategories();
  showScreen('setupScreen');
}

function startGame() {
  if (!selectedCategory) return;

  scores = [501, 501];
  usedPlayerIds = new Set();
  currentTurn = 0;
  turnNumber = 1;

  // Reset UI
  $('gameCategoryLabel').textContent = selectedCategory.label;
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
  startTimer();
}

// ============================================================
// TIMER
// ============================================================

function startTimer() {
  clearInterval(timerInterval);
  timerRemaining = TIMER_SECONDS;
  updateTimerBar();

  timerInterval = setInterval(() => {
    timerRemaining -= 0.1;
    updateTimerBar();
    if (timerRemaining <= 0) {
      clearInterval(timerInterval);
      handleTimeout();
    }
  }, 100);
}

function updateTimerBar() {
  const pct = Math.max(0, (timerRemaining / TIMER_SECONDS) * 100);
  const fill = $('timerFill');
  fill.style.width = pct + '%';
  fill.className = 'timer-fill';
  if (pct < 20) fill.classList.add('danger');
  else if (pct < 40) fill.classList.add('warning');
}

function handleTimeout() {
  addHistory(currentTurn, 'Tijd op!', 0, true, 'Geen antwoord');
  updateLastScore(currentTurn, 'BUST — tijd op!', true);
  nextTurn();
}

// ============================================================
// TURN LOGIC
// ============================================================

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

  // Score kleuren
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
  startTimer();
  setTimeout(() => $('playerInput').focus(), 100);
}

// ============================================================
// SCORING
// ============================================================

function getPlayerStat(player, category) {
  if (category.comp) {
    if (player.comp && player.comp[category.comp]) {
      return player.comp[category.comp][category.stat] || 0;
    }
    return 0;
  }
  return player[category.stat] || 0;
}

function checkBust(stat, currentScore) {
  if (stat === 0) return true;
  if (stat > MAX_SCORE) return true;
  if (IMPOSSIBLE_SCORES.has(stat)) return true;
  if (currentScore - stat < WIN_THRESHOLD) return true;
  return false;
}

async function submitPlayer(playerId) {
  clearInterval(timerInterval);

  if (usedPlayerIds.has(playerId)) {
    showFeedback('Speler al gebruikt!');
    startTimer();
    return;
  }

  const player = await getPlayerById(playerId);
  if (!player) {
    showFeedback('Speler niet gevonden');
    startTimer();
    return;
  }

  const stat = getPlayerStat(player, selectedCategory);
  usedPlayerIds.add(playerId);

  const isBust = checkBust(stat, scores[currentTurn]);

  if (isBust) {
    const reason = stat > MAX_SCORE ? `${stat} > 180`
      : IMPOSSIBLE_SCORES.has(stat) ? `${stat} is onmogelijk`
      : stat === 0 ? '0 punten'
      : `Te ver (${scores[currentTurn] - stat} < ${WIN_THRESHOLD})`;

    addHistory(currentTurn, player.n, stat, true, reason);
    updateLastScore(currentTurn, `BUST — ${player.n} (${stat}) — ${reason}`, true);

    // Shake animatie
    const panel = $(`scorePanel${currentTurn + 1}`);
    panel.classList.add('bust');
    setTimeout(() => panel.classList.remove('bust'), 500);
  } else {
    scores[currentTurn] -= stat;
    $(`score${currentTurn + 1}`).textContent = scores[currentTurn];
    addHistory(currentTurn, player.n, stat, false);
    updateLastScore(currentTurn, `${player.n} — ${stat}`, false);

    // Win check
    if (scores[currentTurn] <= 0 && scores[currentTurn] >= WIN_THRESHOLD) {
      if (gameMode === 'multi' && currentTurn === 0) {
        // Speler 1 finished → speler 2 krijgt nog een beurt
        nextTurn();
        return;
      }
      endGame();
      return;
    }
  }

  nextTurn();
}

// ============================================================
// UI HELPERS
// ============================================================

function updateLastScore(playerIdx, text, isBust) {
  $(`last${playerIdx + 1}`).innerHTML =
    `<span class="${isBust ? 'bust' : 'hit'}">${text}</span>`;
}

function addHistory(playerIdx, name, stat, isBust, reason) {
  const section = $('historySection');
  const div = document.createElement('div');
  div.className = 'history-item';

  const whoClass = playerIdx === 0 ? 'p1' : 'p2';
  const whoLabel = gameMode === 'solo' ? turnNumber : (playerIdx === 0 ? 'P1' : 'P2');
  const scoreClass = isBust ? 'bust' : 'hit';
  const scoreText = isBust ? 'BUST' : `-${stat}`;
  const detail = reason || `Stat: ${stat}`;

  div.innerHTML = `
    <div class="h-who ${whoClass}">${whoLabel}</div>
    <div style="flex:1">
      <div>${name}</div>
      <div class="h-player">${detail}</div>
    </div>
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
// WIN / END GAME
// ============================================================

function endGame() {
  clearInterval(timerInterval);

  let winner, detail;

  if (gameMode === 'solo') {
    winner = 'Gewonnen!';
    detail = `Je hebt 501 bereikt in ${turnNumber} beurten`;
  } else {
    const both = scores[0] <= 0 && scores[0] >= WIN_THRESHOLD
              && scores[1] <= 0 && scores[1] >= WIN_THRESHOLD;

    if (both) {
      const diff0 = Math.abs(scores[0]);
      const diff1 = Math.abs(scores[1]);
      if (diff0 < diff1) {
        winner = 'Speler 1 wint!';
        detail = 'Beide in de win-zone, maar Speler 1 is dichter bij 0';
      } else if (diff1 < diff0) {
        winner = 'Speler 2 wint!';
        detail = 'Beide in de win-zone, maar Speler 2 is dichter bij 0';
      } else {
        winner = 'Gelijkspel!';
        detail = 'Beide even dicht bij 0';
      }
    } else if (scores[0] <= 0 && scores[0] >= WIN_THRESHOLD) {
      winner = 'Speler 1 wint!';
      detail = `Afgemaakt op ${scores[0]}`;
    } else {
      winner = 'Speler 2 wint!';
      detail = `Afgemaakt op ${scores[1]}`;
    }
  }

  $('winTitle').textContent = winner;
  $('winDetail').textContent = detail;

  const scoresDiv = $('winScores');
  if (gameMode === 'solo') {
    scoresDiv.innerHTML = `
      <div class="win-score-box winner">
        <div class="wsb-name">Eindscore</div>
        <div class="wsb-score">${scores[0]}</div>
      </div>
      <div class="win-score-box">
        <div class="wsb-name">Beurten</div>
        <div class="wsb-score">${turnNumber}</div>
      </div>
    `;
  } else {
    const w0 = scores[0] <= 0 && scores[0] >= WIN_THRESHOLD;
    const w1 = scores[1] <= 0 && scores[1] >= WIN_THRESHOLD;
    scoresDiv.innerHTML = `
      <div class="win-score-box ${w0 ? 'winner' : ''}">
        <div class="wsb-name">Speler 1</div>
        <div class="wsb-score">${scores[0]}</div>
      </div>
      <div class="win-score-box ${w1 ? 'winner' : ''}">
        <div class="wsb-name">Speler 2</div>
        <div class="wsb-score">${scores[1]}</div>
      </div>
    `;
  }

  showScreen('winScreen');
}

// ============================================================
// AUTOCOMPLETE
// ============================================================

let acHighlightIdx = -1;
let acResults = [];
let debounceTimer = null;

function initAutocomplete() {
  const input = $('playerInput');
  const list = $('acList');

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => searchPlayers(input.value), 120);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      acHighlightIdx = Math.min(acHighlightIdx + 1, acResults.length - 1);
      updateAcHighlight();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      acHighlightIdx = Math.max(acHighlightIdx - 1, 0);
      updateAcHighlight();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (acHighlightIdx >= 0 && acResults[acHighlightIdx]) {
        selectAcItem(acResults[acHighlightIdx]);
      } else if (acResults.length === 1) {
        selectAcItem(acResults[0]);
      }
    } else if (e.key === 'Escape') {
      list.classList.remove('show');
    }
  });

  // Sluit bij klik buiten
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-wrap')) {
      list.classList.remove('show');
    }
  });
}

function searchPlayers(query) {
  const list = $('acList');

  if (query.length < 2) {
    list.classList.remove('show');
    acResults = [];
    return;
  }

  const q = query.toLowerCase();
  acResults = autocompleteData
    .filter(p => !usedPlayerIds.has(p.id) && p.n.toLowerCase().includes(q))
    .slice(0, 15);

  acHighlightIdx = -1;
  renderAcResults();
}

function renderAcResults() {
  const list = $('acList');

  if (acResults.length === 0) {
    list.classList.remove('show');
    return;
  }

  list.innerHTML = '';
  acResults.forEach((p, i) => {
    const div = document.createElement('div');
    div.className = 'ac-item' + (i === acHighlightIdx ? ' highlighted' : '');
    div.innerHTML = `<span>${p.n}</span>`;
    div.addEventListener('click', () => selectAcItem(p));
    list.appendChild(div);
  });
  list.classList.add('show');
}

function updateAcHighlight() {
  const list = $('acList');
  list.querySelectorAll('.ac-item').forEach((el, i) => {
    el.classList.toggle('highlighted', i === acHighlightIdx);
  });
  const highlighted = list.querySelector('.highlighted');
  if (highlighted) highlighted.scrollIntoView({ block: 'nearest' });
}

function selectAcItem(player) {
  $('acList').classList.remove('show');
  $('playerInput').value = player.n;
  submitPlayer(player.id);
}

// ============================================================
// EVENT LISTENERS
// ============================================================

function initEvents() {
  // Start screen: mode buttons
  document.querySelectorAll('[data-mode]').forEach(btn => {
    btn.addEventListener('click', () => startSetup(btn.dataset.mode));
  });

  // Back / navigation buttons
  document.querySelectorAll('[data-target]').forEach(btn => {
    btn.addEventListener('click', () => showScreen(btn.dataset.target));
  });

  // Start game button
  $('startGameBtn').addEventListener('click', startGame);

  // Rematch button
  $('rematchBtn').addEventListener('click', () => startGame());
}

// ============================================================
// BOOT
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  loadData();
  initEvents();
  initAutocomplete();
});
