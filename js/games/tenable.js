// Tenable: vul de top 10 aan met 3 levens
import { findMatchIndex } from '../utils/name-match.js';
import { updateGameState } from '../utils/storage.js';
import { hapticSuccess, hapticError, hapticLight } from '../utils/haptics.js';

let data = null;
let state = null;
let onFinish = null;

/**
 * Render de volledige Tenable screen
 */
export function initTenable(gameData, gameState, finishCb) {
    data = gameData;
    state = { ...gameState }; // kopie
    onFinish = finishCb;

    if (!data) {
        renderNoData();
        return;
    }

    // Vraag
    document.getElementById('tenable-question').textContent = data.question;
    document.getElementById('tenable-subtitle').textContent = data.subtitle;

    // Lives
    renderLives();

    // Tower
    renderTower();

    // Input
    const form = document.getElementById('tenable-form');
    const input = document.getElementById('tenable-input');
    input.value = '';
    input.disabled = false;
    form.onsubmit = handleSubmit;

    // Focus input na korte delay (voor screen transition)
    setTimeout(() => input.focus(), 400);

    // Als al gespeeld vandaag → direct naar resultaat
    if (state.played) {
        showResult();
    }
}

function renderLives() {
    const livesEl = document.getElementById('tenable-lives');
    livesEl.innerHTML = '';
    for (let i = 0; i < 3; i++) {
        const span = document.createElement('span');
        span.className = 'life' + (i >= state.lives ? ' lost' : '');
        livesEl.appendChild(span);
    }
}

function renderTower() {
    const tower = document.getElementById('tenable-tower');
    tower.innerHTML = '';

    // Rank 1 onderaan (zoals TV-show) - flex-direction: column-reverse in CSS
    // Dus we renderen 1..10 in normale volgorde
    for (let rank = 1; rank <= 10; rank++) {
        const slot = document.createElement('div');
        slot.className = 'tower-slot';

        const isRevealed = state.revealedRanks.includes(rank);
        const answer = data.answers.find(a => a.rank === rank);

        if (isRevealed && answer) {
            slot.classList.add('revealed');
            slot.innerHTML = `
                <span class="slot-rank">${rank}</span>
                <span class="slot-name">${escapeHtml(answer.name)}</span>
            `;
        } else {
            slot.innerHTML = `
                <span class="slot-rank">${rank}</span>
                <span class="slot-name"></span>
            `;
        }

        slot.dataset.rank = rank;
        tower.appendChild(slot);
    }
}

function renderNoData() {
    document.getElementById('tenable-question').textContent = 'Geen quiz vandaag';
    document.getElementById('tenable-subtitle').textContent = 'Kom morgen terug';
    document.getElementById('tenable-tower').innerHTML = '';
    document.getElementById('tenable-form').onsubmit = (e) => e.preventDefault();
    document.getElementById('tenable-input').disabled = true;
}

async function handleSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('tenable-input');
    const raw = input.value.trim();
    if (!raw) return;

    // Check of al geraden (voorkomt dubbele levens verliezen op herhaalde fout)
    if (state.history.map(h => h.toLowerCase()).includes(raw.toLowerCase())) {
        shakeInput(input);
        input.value = '';
        return;
    }

    state.history.push(raw);

    const matchIdx = findMatchIndex(raw, data.answers);

    if (matchIdx >= 0) {
        const answer = data.answers[matchIdx];

        // Al onthuld? (kan gebeuren bij duplicate answers zoals Advocaat 2x)
        if (state.revealedRanks.includes(answer.rank)) {
            shakeInput(input);
            input.value = '';
            return;
        }

        // Correct!
        state.revealedRanks.push(answer.rank);
        await hapticSuccess();

        // Animate de specifieke slot
        const slot = document.querySelector(`.tower-slot[data-rank="${answer.rank}"]`);
        if (slot) {
            slot.classList.add('revealed');
            slot.innerHTML = `
                <span class="slot-rank">${answer.rank}</span>
                <span class="slot-name">${escapeHtml(answer.name)}</span>
            `;
        }

        input.value = '';
        await saveState();

        // Alle 10? -> win
        if (state.revealedRanks.length === 10) {
            await finishGame(true);
        }
    } else {
        // Fout
        state.lives--;
        await hapticError();
        shakeInput(input);
        input.value = '';
        renderLives();
        await saveState();

        if (state.lives <= 0) {
            await finishGame(false);
        }
    }
}

function shakeInput(input) {
    input.classList.remove('error');
    void input.offsetWidth; // force reflow
    input.classList.add('error');
    setTimeout(() => input.classList.remove('error'), 500);
}

async function saveState() {
    state.score = state.revealedRanks.length; // 0-10 punten
    await updateGameState('tenable', state);
}

async function finishGame(allTen) {
    state.played = true;
    state.score = state.revealedRanks.length;
    await updateGameState('tenable', state);

    // Disable input
    document.getElementById('tenable-input').disabled = true;

    // Toon gemiste antwoorden als ghosts
    const missed = data.answers.filter(a => !state.revealedRanks.includes(a.rank));
    for (const m of missed) {
        const slot = document.querySelector(`.tower-slot[data-rank="${m.rank}"]`);
        if (slot) {
            slot.classList.add('ghost');
            slot.innerHTML = `
                <span class="slot-rank">${m.rank}</span>
                <span class="slot-name">${escapeHtml(m.name)}</span>
            `;
        }
    }

    setTimeout(() => showResult(), 600);
}

function showResult() {
    const modal = document.getElementById('result-modal');
    const icon  = document.getElementById('result-icon');
    const title = document.getElementById('result-title');
    const score = document.getElementById('result-score');
    const reveal= document.getElementById('result-reveal');

    const allTen = state.revealedRanks.length === 10;

    icon.className = 'result-icon ' + (allTen ? 'success' : 'fail');
    icon.innerHTML = allTen
        ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`
        : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

    title.textContent = allTen ? 'Perfect 10!' : 'Einde';
    score.textContent = `${state.revealedRanks.length}/10 correct`;

    // Reveal alle antwoorden
    reveal.innerHTML = data.answers.map(a => {
        const gotIt = state.revealedRanks.includes(a.rank);
        return `<div class="reveal-row">
            <span><span class="reveal-rank">${a.rank}.</span>${escapeHtml(a.name)}</span>
            <span style="color: ${gotIt ? 'var(--accent)' : 'var(--fg-tertiary)'}; font-weight: 600;">
                ${gotIt ? '✓' : '–'}
            </span>
        </div>`;
    }).join('');

    modal.classList.add('active');

    document.getElementById('result-continue').onclick = () => {
        modal.classList.remove('active');
        onFinish && onFinish();
    };
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
