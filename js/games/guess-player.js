import { isMatch } from '../utils/name-match.js';
import { updateGameState } from '../utils/storage.js';
import { hapticSuccess, hapticError } from '../utils/haptics.js';
import { renderHearts } from '../utils/hearts.js';
import { getClubLogo } from '../utils/club-logo.js';
import { toast } from '../utils/toast.js';

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

    if (!state.revealedClubs || state.revealedClubs < 1) {
        state.revealedClubs = 1;
    }

    renderScore();
    renderLives();
    renderClubs();
    fetchAndShowLogos();

    const form = document.getElementById('guessPlayer-form');
    const input = document.getElementById('guessPlayer-input');
    input.value = '';
    input.disabled = state.played;
    form.onsubmit = handleSubmit;

    setTimeout(() => { if (!state.played) input.focus(); }, 400);
    if (state.played) showResult();
}

function renderScore() {
    document.getElementById('guessPlayer-score').textContent = `${calculatePoints(state.attempts)} pt`;
}

function renderLives(animateLatest = false) {
    renderHearts(document.getElementById('guessPlayer-lives'), MAX_ATTEMPTS, state.attempts, animateLatest);
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
                <div class="club-logo" data-club="${escapeHtml(club.name)}">
                    <svg class="club-logo-fallback" viewBox="0 0 32 32"><use href="#i-shield"/></svg>
                </div>
                <div class="club-info">
                    <p class="club-name">${escapeHtml(club.name)}</p>
                    ${club.years ? `<p class="club-years">${escapeHtml(club.years)}</p>` : ''}
                </div>
            `;
        } else {
            card.classList.add('locked');
            card.innerHTML = `
                <div class="club-order">${orderNum}</div>
                <div class="club-logo">
                    <svg class="club-logo-fallback" viewBox="0 0 32 32"><use href="#i-shield"/></svg>
                </div>
                <div class="club-info">
                    <p class="locked-placeholder">Hidden</p>
                </div>
            `;
        }
        container.appendChild(card);
    }
}

async function fetchAndShowLogos() {
    const promises = [];
    document.querySelectorAll('#clubs-container .club-logo[data-club]').forEach(el => {
        const name = el.dataset.club;
        promises.push(getClubLogo(name).then(url => {
            if (url) el.innerHTML = `<img src="${url}" alt="" loading="lazy">`;
        }).catch(() => {}));
    });
    await Promise.all(promises);
}

function renderNoData() {
    document.getElementById('clubs-container').innerHTML =
        `<p class="empty-state">No quiz today. Come back tomorrow.</p>`;
    document.getElementById('guessPlayer-form').onsubmit = (e) => e.preventDefault();
    document.getElementById('guessPlayer-input').disabled = true;
}

function calculatePoints(attemptsDone) {
    return Math.max(0, 5 - attemptsDone);
}

async function handleSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('guessPlayer-input');
    const raw = input.value.trim();
    if (!raw) return;

    if (isMatch(raw, data.aliases)) {
        state.solved = true;
        state.score = calculatePoints(state.attempts);
        state.attempts++;
        await hapticSuccess();
        toast(`Nice — ${data.player}`, 'success');
        state.revealedClubs = data.clubs.length;
        renderClubs();
        fetchAndShowLogos();
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
            state.revealedClubs = data.clubs.length;
            renderClubs();
            fetchAndShowLogos();
            await finishGame();
        } else {
            state.revealedClubs = Math.min(data.clubs.length, state.attempts + 1);
            renderClubs();
            fetchAndShowLogos();
            renderLives(true);
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
    renderLives();
    renderScore();
    setTimeout(() => showResult(), 700);
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
