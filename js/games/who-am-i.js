import { isMatch } from '../utils/name-match.js';
import { updateGameState } from '../utils/storage.js';
import { hapticSuccess, hapticError } from '../utils/haptics.js';
import { renderHearts } from '../utils/hearts.js';
import { toast } from '../utils/toast.js';

let data = null;
let state = null;
let onFinish = null;

const MAX_ATTEMPTS = 5;

export function initWhoAmI(gameData, gameState, finishCb) {
    data = gameData;
    state = { ...gameState };
    onFinish = finishCb;

    if (!data || !data.hints || data.hints.length === 0) {
        renderNoData();
        return;
    }

    renderScore();
    renderLives();
    renderHints();

    const form = document.getElementById('whoAmI-form');
    const input = document.getElementById('whoAmI-input');
    input.value = '';
    input.disabled = state.played;
    form.onsubmit = handleSubmit;

    setTimeout(() => { if (!state.played) input.focus(); }, 400);
    if (state.played) showResult();
}

function renderScore() {
    document.getElementById('whoAmI-score').textContent = `${calculatePoints(state.attempts)} pt`;
}

function renderLives(animateLatest = false) {
    renderHearts(document.getElementById('whoAmI-lives'), MAX_ATTEMPTS, state.attempts, animateLatest);
}

function renderHints() {
    const container = document.getElementById('hints-container');
    container.innerHTML = '';
    data.hints.forEach((hint, i) => {
        const card = document.createElement('div');
        card.className = 'hint-card';
        card.innerHTML = `
            <div class="hint-number">${i + 1}</div>
            <p class="hint-text">${escapeHtml(hint)}</p>
        `;
        container.appendChild(card);
    });
}

function renderNoData() {
    document.getElementById('hints-container').innerHTML =
        `<p class="empty-state">No quiz today. Come back tomorrow.</p>`;
    document.getElementById('whoAmI-form').onsubmit = (e) => e.preventDefault();
    document.getElementById('whoAmI-input').disabled = true;
}

function calculatePoints(attemptsDone) {
    return Math.max(0, 5 - attemptsDone);
}

async function handleSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('whoAmI-input');
    const raw = input.value.trim();
    if (!raw) return;

    if (isMatch(raw, data.aliases)) {
        state.solved = true;
        state.score = calculatePoints(state.attempts);
        state.attempts++;
        await hapticSuccess();
        toast(`Nice — ${data.player}`, 'success');
        await finishGame();
    } else {
        state.attempts++;
        await hapticError();
        const remaining = MAX_ATTEMPTS - state.attempts;
        if (remaining > 0) {
            toast(`Missed · ${remaining} ${remaining === 1 ? 'try' : 'tries'} left`, 'error');
        } else {
            toast(`Missed · it was ${data.player}`, 'error');
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
            await updateGameState('whoAmI', state);
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
    await updateGameState('whoAmI', state);
    document.getElementById('whoAmI-input').disabled = true;
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

    title.textContent = state.solved ? 'Nicely done.' : 'Not this time.';
    score.innerHTML = state.solved
        ? `You scored <strong>${state.score} out of 5</strong>. It was <strong>${escapeHtml(data.player)}</strong>.`
        : `The player was <strong>${escapeHtml(data.player)}</strong>.`;
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
