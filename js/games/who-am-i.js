// Who Am I: raad speler aan 3 hints (progressive reveal)
import { isMatch } from '../utils/name-match.js';
import { updateGameState } from '../utils/storage.js';
import { hapticSuccess, hapticError } from '../utils/haptics.js';

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

    if (!state.revealedHints || state.revealedHints < 1) {
        state.revealedHints = 1;
    }

    renderScore();
    renderAttempts();
    renderHints();

    const form = document.getElementById('whoAmI-form');
    const input = document.getElementById('whoAmI-input');
    input.value = '';
    input.disabled = state.played;
    form.onsubmit = handleSubmit;

    setTimeout(() => {
        if (!state.played) input.focus();
    }, 400);

    if (state.played) showResult();
}

function renderScore() {
    document.getElementById('whoAmI-score').textContent = `${calculatePoints(state.attempts)} pt`;
}

function renderAttempts() {
    const dots = document.querySelectorAll('#whoAmI-attempts .dot');
    dots.forEach((d, i) => {
        d.classList.toggle('used', i < state.attempts);
    });
}

function renderHints() {
    const container = document.getElementById('hints-container');
    container.innerHTML = '';

    // Altijd 3 kaartjes, ook als sommige nog verborgen zijn
    for (let i = 0; i < 3; i++) {
        const hint = data.hints[i];
        const card = document.createElement('div');
        card.className = 'hint-card';

        const isRevealed = (i + 1) <= state.revealedHints;

        if (hint && isRevealed) {
            card.classList.add('revealed');
            card.innerHTML = `
                <div class="hint-number">${i + 1}</div>
                <p class="hint-text">${escapeHtml(hint)}</p>
            `;
        } else {
            card.classList.add('locked');
            card.innerHTML = `
                <div class="hint-number">${i + 1}</div>
                <p class="hint-text">Hint ${i + 1} verschijnt na een foute poging</p>
            `;
        }
        container.appendChild(card);
    }
}

function renderNoData() {
    document.getElementById('hints-container').innerHTML =
        `<p style="text-align: center; color: var(--fg-secondary); padding: 40px 20px;">
            Geen quiz vandaag. Kom morgen terug.
        </p>`;
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
        state.revealedHints = 3;
        renderHints();
        await finishGame();
    } else {
        state.attempts++;
        await hapticError();
        shakeInput(input);

        if (state.attempts >= MAX_ATTEMPTS) {
            state.solved = false;
            state.score = 0;
            state.revealedHints = 3;
            renderHints();
            await finishGame();
        } else {
            // Reveal volgende hint (max 3 totaal)
            state.revealedHints = Math.min(3, state.attempts + 1);
            renderHints();
            renderAttempts();
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
    score.textContent = `${state.score} punten · antwoord: ${data.player}`;
    reveal.innerHTML = '';

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
