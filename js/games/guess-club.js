// Guess the Club: elftal met vlaggen in formatie, max 3 pogingen
import { isMatch } from '../utils/name-match.js';
import { updateGameState } from '../utils/storage.js';
import { hapticSuccess, hapticError } from '../utils/haptics.js';
import { displayFlag, COUNTRY_NAMES_NL } from '../utils/flags.js';

let data = null;
let state = null;
let onFinish = null;

const MAX_ATTEMPTS = 3;
const POINTS_PER_ATTEMPT = [5, 3, 1]; // eerste poging=5, tweede=3, derde=1

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
    renderAttempts();
    renderFormation();

    const form = document.getElementById('guessClub-form');
    const input = document.getElementById('guessClub-input');
    input.value = '';
    input.disabled = state.played;
    form.onsubmit = handleSubmit;

    setTimeout(() => {
        if (!state.played) input.focus();
    }, 400);

    if (state.played) showResult();
}

function renderYearBadge() {
    const badge = document.getElementById('guessClub-year');
    const parts = [];
    if (data.year) parts.push(`Seizoen ${data.year}`);
    if (data.formation) parts.push(data.formation);
    badge.textContent = parts.join(' · ');
}

function renderScore() {
    const pt = state.attempts < MAX_ATTEMPTS ? POINTS_PER_ATTEMPT[state.attempts] : 0;
    document.getElementById('guessClub-score').textContent = `${pt} pt`;
}

function renderAttempts() {
    const dots = document.querySelectorAll('#guessClub-attempts .dot');
    dots.forEach((d, i) => {
        d.classList.toggle('used', i < state.attempts);
    });
}

/**
 * Parse formation string naar array van rijen (van achter naar voren)
 * "4-3-3" → [4, 3, 3] (defenders, midfielders, attackers)
 * Keeper wordt automatisch toegevoegd als eerste rij
 */
function parseFormation(str) {
    const parts = str.split(/[-–]/).map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n));
    if (parts.length === 0) return [1, 4, 3, 3]; // fallback
    return [1, ...parts]; // voeg keeper toe
}

/**
 * Render het elftal als verticaal veld met vlaggen
 * Keeper onderaan, aanvallers bovenaan
 */
function renderFormation() {
    const container = document.getElementById('formation-container');
    container.innerHTML = '';

    const rows = parseFormation(data.formation || '4-3-3');
    const total = rows.reduce((a, b) => a + b, 0);

    if (total !== data.lineup.length) {
        console.warn(`[GuessClub] Formatie ${data.formation} (${total}) matcht niet met lineup (${data.lineup.length})`);
    }

    // Build field
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

    // Wij renderen TOP (aanvallers) eerst, dan midden-rijen, dan keeper
    // Dat betekent: reverse de rows array voor display
    let playerIdx = 0;
    // Lineup staat in volgorde: keeper eerst, dan verdedigers, dan midden, dan aanvallers
    // Maar we willen aanvallers bovenaan tonen. Dus parse lineup in volgorde en reverse de display.

    const rowsReversed = [...rows].reverse(); // nu: aanvallers, midden, verdedigers, keeper
    // We moeten de juiste spelers per rij toewijzen vanuit lineup

    // Bereken player indices: rows=[1,4,3,3] → keeper=0, defenders=1-4, mid=5-7, att=8-10
    const rowIndices = [];
    let startIdx = 0;
    for (const r of rows) {
        const slice = data.lineup.slice(startIdx, startIdx + r);
        rowIndices.push(slice);
        startIdx += r;
    }
    // rowIndices = [keeper, defenders, midfielders, attackers]
    // Voor display: reverse → [attackers, mid, def, keeper]
    const displayRows = [...rowIndices].reverse();

    for (const rowPlayers of displayRows) {
        const rowEl = document.createElement('div');
        rowEl.className = 'pitch-row';
        for (const player of rowPlayers) {
            const countryName = COUNTRY_NAMES_NL[player.country?.toUpperCase()] || player.country || '';
            const playerEl = document.createElement('div');
            playerEl.className = 'pitch-player';
            playerEl.innerHTML = `
                <div class="flag-bubble" title="${escapeHtml(countryName)}">
                    <span class="flag-emoji">${displayFlag(player.country)}</span>
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
        `<p style="text-align: center; color: var(--fg-secondary); padding: 40px 20px;">
            Geen quiz vandaag. Kom morgen terug.
        </p>`;
    document.getElementById('guessClub-year').textContent = '';
    document.getElementById('guessClub-form').onsubmit = (e) => e.preventDefault();
    document.getElementById('guessClub-input').disabled = true;
}

async function handleSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('guessClub-input');
    const raw = input.value.trim();
    if (!raw) return;

    if (isMatch(raw, data.aliases)) {
        // Correct!
        state.solved = true;
        state.score = POINTS_PER_ATTEMPT[state.attempts];
        state.attempts++;
        await hapticSuccess();
        await finishGame();
    } else {
        state.attempts++;
        await hapticError();
        shakeInput(input);

        if (state.attempts >= MAX_ATTEMPTS) {
            state.solved = false;
            state.score = 0;
            await finishGame();
        } else {
            renderAttempts();
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
    renderAttempts();
    renderScore();
    setTimeout(() => showResult(), 500);
}

function showResult() {
    const modal  = document.getElementById('result-modal');
    const icon   = document.getElementById('result-icon');
    const title  = document.getElementById('result-title');
    const score  = document.getElementById('result-score');
    const reveal = document.getElementById('result-reveal');

    icon.className = 'result-icon ' + (state.solved ? 'success' : 'fail');
    icon.innerHTML = state.solved
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

    title.textContent = state.solved ? 'Geraden!' : 'Helaas';
    score.textContent = `${state.score} punten · antwoord: ${data.club}`;
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
