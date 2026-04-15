import { isMatch } from '../utils/name-match.js';
import { updateGameState } from '../utils/storage.js';
import { hapticSuccess, hapticError } from '../utils/haptics.js';
import { renderHearts } from '../utils/hearts.js';
import { flagUrl, countryName } from '../utils/flags.js';
import { toast } from '../utils/toast.js';

let data = null;
let state = null;
let onFinish = null;

const MAX_ATTEMPTS = 3;
const POINTS_PER_ATTEMPT = [5, 3, 1];

export function initGuessClub(gameData, gameState, finishCb) {
    data = gameData;
    state = { ...gameState };
    onFinish = finishCb;

    if (!data || !data.lineup || data.lineup.length === 0) {
        renderNoData();
        return;
    }

    renderYearBadge();
    renderScore();
    renderLives();
    renderFormation();

    const form = document.getElementById('guessClub-form');
    const input = document.getElementById('guessClub-input');
    input.value = '';
    input.disabled = state.played;
    form.onsubmit = handleSubmit;

    setTimeout(() => { if (!state.played) input.focus(); }, 400);
    if (state.played) showResult();
}

function renderYearBadge() {
    const badge = document.getElementById('guessClub-year');
    const parts = [];
    if (data.year) parts.push(`Season ${data.year}`);
    if (data.formation) parts.push(data.formation);
    badge.textContent = parts.join(' · ');
}

function renderScore() {
    const pt = state.attempts < MAX_ATTEMPTS ? POINTS_PER_ATTEMPT[state.attempts] : 0;
    document.getElementById('guessClub-score').textContent = `${pt} pt`;
}

function renderLives(animateLatest = false) {
    renderHearts(document.getElementById('guessClub-lives'), MAX_ATTEMPTS, state.attempts, animateLatest);
}

function parseFormation(str) {
    const parts = str.split(/[-–]/).map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));
    if (parts.length === 0) return [1, 4, 3, 3];
    return [1, ...parts];
}

function renderFormation() {
    const container = document.getElementById('formation-container');
    container.innerHTML = '';
    const rows = parseFormation(data.formation || '4-3-3');

    const pitch = document.createElement('div');
    pitch.className = 'pitch';
    pitch.innerHTML = `
        <div class="pitch-lines">
            <div class="pitch-border"></div>
            <div class="pitch-halfline"></div>
            <div class="pitch-circle"></div>
            <div class="pitch-box pitch-box-top"></div>
            <div class="pitch-box pitch-box-bottom"></div>
        </div>
    `;

    const rowsContainer = document.createElement('div');
    rowsContainer.className = 'pitch-rows';

    // Lineup order: keeper -> defenders -> midfielders -> attackers
    // Display: attackers on top, keeper at bottom
    const rowIndices = [];
    let startIdx = 0;
    for (const r of rows) {
        rowIndices.push(data.lineup.slice(startIdx, startIdx + r));
        startIdx += r;
    }
    const displayRows = [...rowIndices].reverse();

    for (const rowPlayers of displayRows) {
        const rowEl = document.createElement('div');
        rowEl.className = 'pitch-row';
        for (const player of rowPlayers) {
            const cn = countryName(player.country);
            const fUrl = flagUrl(player.country);
            const playerEl = document.createElement('div');
            playerEl.className = 'pitch-player';
            playerEl.innerHTML = `
                <div class="flag-bubble" title="${escapeHtml(cn)}">
                    ${fUrl ? `<img src="${fUrl}" alt="${escapeHtml(cn)}" loading="lazy">` : ''}
                </div>
                ${player.shirt ? `<div class="shirt-number">${escapeHtml(String(player.shirt))}</div>` : ''}
            `;
            rowEl.appendChild(playerEl);
        }
        rowsContainer.appendChild(rowEl);
    }

    pitch.appendChild(rowsContainer);
    container.appendChild(pitch);
}

function renderNoData() {
    document.getElementById('formation-container').innerHTML =
        `<p class="empty-state">No quiz today. Come back tomorrow.</p>`;
    document.getElementById('guessClub-year').textContent = '';
    document.getElementById('guessClub-form').onsubmit = (e) => e.preventDefault();
    document.getElementById('guessClub-input').disabled = true;
}

/**
 * Build flexible alias list — also accept answers without the year suffix.
 */
function buildFlexibleAliases() {
    const all = new Set();
    for (const a of data.aliases) {
        all.add(a);
        const stripped = a
            .replace(/\b(19|20)?\d{2}[/\-](19|20)?\d{2}\b/g, '')
            .replace(/\b(19|20)\d{2}\b/g, '')
            .replace(/\s+/g, ' ')
            .trim();
        if (stripped) all.add(stripped);
    }
    return [...all];
}

async function handleSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('guessClub-input');
    const raw = input.value.trim();
    if (!raw) return;

    const flexAliases = buildFlexibleAliases();

    if (isMatch(raw, flexAliases)) {
        state.solved = true;
        state.score = POINTS_PER_ATTEMPT[state.attempts];
        state.attempts++;
        await hapticSuccess();
        toast('Correct!', 'success');
        await finishGame();
    } else {
        state.attempts++;
        await hapticError();
        const remaining = MAX_ATTEMPTS - state.attempts;
        if (remaining > 0) {
            toast(`Incorrect · ${remaining} ${remaining === 1 ? 'try' : 'tries'} left`, 'error');
        } else {
            toast('Incorrect · game over', 'error');
        }
        shakeInput(input);

        if (state.attempts >= MAX_ATTEMPTS) {
            state.solved = false;
            state.score = 0;
            await finishGame();
        } else {
            renderLives(true);
            renderScore();
            input.value = '';
            await updateGameState('guessClub', state);
        }
    }
}

function shakeInput(input) {
    input.classList.remove('error');
    void input.offsetWidth;
    input.classList.add('error');
    setTimeout(() => input.classList.remove('error'), 500);
}

async function finishGame() {
    state.played = true;
    await updateGameState('guessClub', state);
    document.getElementById('guessClub-input').disabled = true;
    renderLives();
    renderScore();
    setTimeout(() => showResult(), 600);
}

function showResult() {
    const modal  = document.getElementById('result-modal');
    const icon   = document.getElementById('result-icon');
    const title  = document.getElementById('result-title');
    const score  = document.getElementById('result-score');
    const reveal = document.getElementById('result-reveal');

    icon.className = 'result-icon ' + (state.solved ? 'success' : 'fail');
    icon.innerHTML = state.solved
        ? `<svg viewBox="0 0 24 24"><use href="#i-check"/></svg>`
        : `<svg viewBox="0 0 24 24"><use href="#i-cross"/></svg>`;

    title.textContent = state.solved ? 'Got it!' : 'Game over';
    score.innerHTML = `<strong>${state.score}</strong> points · the club was <strong>${escapeHtml(data.club)}</strong>`;
    reveal.innerHTML = '';
    modal.classList.add('active');
    document.getElementById('result-continue').onclick = () => {
        modal.classList.remove('active');
        onFinish && onFinish();
    };
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}
