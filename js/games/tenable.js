import { findMatchIndex } from '../utils/name-match.js';
import { updateGameState } from '../utils/storage.js';
import { hapticSuccess, hapticError } from '../utils/haptics.js';
import { renderHearts } from '../utils/hearts.js';

let data = null;
let state = null;
let onFinish = null;

export function initTenable(gameData, gameState, finishCb) {
    data = gameData;
    state = { ...gameState };
    onFinish = finishCb;

    if (!data) {
        renderNoData();
        return;
    }

    document.getElementById('tenable-question').textContent = data.question;
    document.getElementById('tenable-subtitle').textContent = data.subtitle;

    renderHearts(document.getElementById('tenable-lives'), 3, 3 - state.lives);
    renderPyramid();

    const form = document.getElementById('tenable-form');
    const input = document.getElementById('tenable-input');
    input.value = '';
    input.disabled = state.played;
    form.onsubmit = handleSubmit;

    if (!state.played) setTimeout(() => input.focus(), 400);
    if (state.played) showResult();
}

function renderPyramid() {
    const pyramid = document.getElementById('tenable-pyramid');
    pyramid.innerHTML = '';

    // Pyramid: rank 1 top (narrowest), rank 10 bottom (widest)
    for (let rank = 1; rank <= 10; rank++) {
        const slot = document.createElement('div');
        slot.className = 'pyramid-slot';

        const widthPct = 50 + ((rank - 1) / 9) * 50;
        slot.style.setProperty('--slot-width', `${widthPct}%`);

        const isRevealed = state.revealedRanks.includes(rank);
        const answer = data.answers.find(a => a.rank === rank);

        if (isRevealed && answer) {
            slot.classList.add('revealed');
            slot.innerHTML = `<span class="slot-rank">${rank}</span><span class="slot-name">${escapeHtml(answer.name)}</span>`;
        } else {
            slot.innerHTML = `<span class="slot-rank">${rank}</span><span class="slot-name"></span>`;
        }

        slot.dataset.rank = rank;
        pyramid.appendChild(slot);
    }
}

function renderNoData() {
    document.getElementById('tenable-question').textContent = 'No quiz today';
    document.getElementById('tenable-subtitle').textContent = 'Come back tomorrow';
    document.getElementById('tenable-pyramid').innerHTML = '';
    document.getElementById('tenable-form').onsubmit = (e) => e.preventDefault();
    document.getElementById('tenable-input').disabled = true;
}

async function handleSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('tenable-input');
    const raw = input.value.trim();
    if (!raw) return;

    if (state.history.map(h => h.toLowerCase()).includes(raw.toLowerCase())) {
        shakeInput(input);
        input.value = '';
        return;
    }

    state.history.push(raw);
    const matchIdx = findMatchIndex(raw, data.answers);

    if (matchIdx >= 0) {
        const answer = data.answers[matchIdx];
        if (state.revealedRanks.includes(answer.rank)) {
            shakeInput(input);
            input.value = '';
            return;
        }
        state.revealedRanks.push(answer.rank);
        await hapticSuccess();

        const slot = document.querySelector(`.pyramid-slot[data-rank="${answer.rank}"]`);
        if (slot) {
            slot.classList.add('revealed');
            slot.innerHTML = `<span class="slot-rank">${answer.rank}</span><span class="slot-name">${escapeHtml(answer.name)}</span>`;
        }

        input.value = '';
        await saveState();

        if (state.revealedRanks.length === 10) {
            await finishGame();
        }
    } else {
        state.lives--;
        await hapticError();
        shakeInput(input);
        input.value = '';
        renderHearts(document.getElementById('tenable-lives'), 3, 3 - state.lives, true);
        await saveState();

        if (state.lives <= 0) {
            await finishGame();
        }
    }
}

function shakeInput(input) {
    input.classList.remove('error');
    void input.offsetWidth;
    input.classList.add('error');
    setTimeout(() => input.classList.remove('error'), 500);
}

async function saveState() {
    state.score = state.revealedRanks.length;
    await updateGameState('tenable', state);
}

async function finishGame() {
    state.played = true;
    state.score = state.revealedRanks.length;
    await updateGameState('tenable', state);
    document.getElementById('tenable-input').disabled = true;

    const missed = data.answers.filter(a => !state.revealedRanks.includes(a.rank));
    for (const m of missed) {
        const slot = document.querySelector(`.pyramid-slot[data-rank="${m.rank}"]`);
        if (slot) {
            slot.classList.add('ghost');
            slot.innerHTML = `<span class="slot-rank">${m.rank}</span><span class="slot-name">${escapeHtml(m.name)}</span>`;
        }
    }
    setTimeout(() => showResult(), 700);
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
        ? `<svg viewBox="0 0 24 24"><use href="#i-check"/></svg>`
        : `<svg viewBox="0 0 24 24"><use href="#i-cross"/></svg>`;

    title.textContent = allTen ? 'Perfect 10!' : 'Game over';
    score.textContent = `${state.revealedRanks.length}/10 correct`;

    reveal.innerHTML = data.answers.map(a => {
        const gotIt = state.revealedRanks.includes(a.rank);
        return `<div class="reveal-row">
            <span><span class="reveal-rank">${a.rank}.</span>${escapeHtml(a.name)}</span>
            <span style="color: ${gotIt ? 'var(--accent)' : 'var(--fg-tertiary)'}; font-weight: 600;">${gotIt ? '✓' : '–'}</span>
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
