// Guess the Player: raad speler aan zijn clubs (progressive reveal)
import { isMatch } from '../utils/name-match.js';
import { updateGameState } from '../utils/storage.js';
import { hapticSuccess, hapticError } from '../utils/haptics.js';

let data = null;
let state = null;
let onFinish = null;

const MAX_ATTEMPTS = 5;

export function initGuessPlayer(gameData, gameState, finishCb) {
    data = gameData;
    state = { ...gameState };
    onFinish = finishCb;

    if (!data || !data.clubs || data.clubs.length === 0) {
        renderNoData();
        return;
    }

    // Als niet gespeeld: minstens 1 club zichtbaar
    if (!state.revealedClubs || state.revealedClubs < 1) {
        state.revealedClubs = 1;
    }

    renderScore();
    renderAttempts();
    renderClubs();

    const form = document.getElementById('guessPlayer-form');
    const input = document.getElementById('guessPlayer-input');
    input.value = '';
    input.disabled = state.played;
    form.onsubmit = handleSubmit;

    setTimeout(() => {
        if (!state.played) input.focus();
    }, 400);

    if (state.played) showResult();
}

function renderScore() {
    const currentPoints = calculatePoints(state.attempts);
    document.getElementById('guessPlayer-score').textContent = `${currentPoints} pt`;
}

function renderAttempts() {
    const dots = document.querySelectorAll('#guessPlayer-attempts .dot');
    dots.forEach((d, i) => {
        d.classList.toggle('used', i < state.attempts);
    });
}

function renderClubs() {
    const container = document.getElementById('clubs-container');
    container.innerHTML = '';
    const totalSlots = Math.max(5, data.clubs.length);

    for (let i = 0; i < totalSlots; i++) {
        const club = data.clubs[i];
        const card = document.createElement('div');
        card.className = 'club-card';

        const orderNum = i + 1;
        const isRevealed = orderNum <= state.revealedClubs;

        if (club && isRevealed) {
            card.classList.add('revealed');
            card.innerHTML = `
                <div class="club-order">${orderNum}</div>
                <div class="club-info">
                    <p class="club-name">${escapeHtml(club.name)}</p>
                    ${club.years ? `<p class="club-years">${escapeHtml(club.years)}</p>` : ''}
                </div>
            `;
        } else {
            card.classList.add('locked');
            card.innerHTML = `
                <div class="club-order">${orderNum}</div>
                <div class="club-info">
                    <p class="locked-placeholder">Nog verborgen</p>
                </div>
            `;
        }
        container.appendChild(card);
    }
}

function renderNoData() {
    document.getElementById('clubs-container').innerHTML =
        `<p style="text-align: center; color: var(--fg-secondary); padding: 40px 20px;">
            Geen quiz vandaag. Kom morgen terug.
        </p>`;
    document.getElementById('guessPlayer-form').onsubmit = (e) => e.preventDefault();
    document.getElementById('guessPlayer-input').disabled = true;
}

/**
 * Punten-berekening: na X attempts (voor deze guess)
 * attempts=0 → nog 5 pt (eerste poging waard)
 * attempts=1 → 4 pt mogelijk
 * attempts=4 → 1 pt mogelijk
 */
function calculatePoints(attemptsDone) {
    return Math.max(0, 5 - attemptsDone);
}

async function handleSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('guessPlayer-input');
    const raw = input.value.trim();
    if (!raw) return;

    if (isMatch(raw, data.aliases)) {
        // Correct!
        state.solved = true;
        state.score = calculatePoints(state.attempts);
        state.attempts++; // telt als gebruikte poging
        await hapticSuccess();

        // Reveal alle clubs voor de show
        state.revealedClubs = data.clubs.length;
        renderClubs();
        await finishGame();
    } else {
        // Fout
        state.attempts++;
        await hapticError();
        shakeInput(input);

        if (state.attempts >= MAX_ATTEMPTS) {
            // Game over - reveal alles
            state.solved = false;
            state.score = 0;
            state.revealedClubs = data.clubs.length;
            renderClubs();
            await finishGame();
        } else {
            // Reveal volgende club
            state.revealedClubs = Math.min(data.clubs.length, state.attempts + 1);
            renderClubs();
            renderAttempts();
            renderScore();
            input.value = '';
            await updateGameState('guessPlayer', state);
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
    await updateGameState('guessPlayer', state);
    document.getElementById('guessPlayer-input').disabled = true;
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
