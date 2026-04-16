import { loadTodayData, loadSampleData } from './utils/data-loader.js';
import { getState, countPlayed, totalScore } from './utils/storage.js';
import { todayKey } from './utils/date-key.js';
import { hapticLight } from './utils/haptics.js';
import { recordToday, getLast7Days } from './utils/history.js';

import { initTenable }      from './games/tenable.js';
import { initGuessPlayer }  from './games/guess-player.js';
import { initWhoAmI }       from './games/who-am-i.js';
import { initGuessClub }    from './games/guess-club.js';

const USE_SAMPLE_DATA = false;

const GAME_MAX = {
    tenable: 10,
    guessPlayer: 5,
    whoAmI: 5,
    guessClub: 5
};

let todayData = null;
let currentScreen = 'menu';
let lastRenderedScore = 0;
let isFirstRender = true;

// ═══════════════════════════════════════
// BOOTSTRAP
// ═══════════════════════════════════════

async function bootstrap() {
    renderBrandDate();

    try {
        todayData = USE_SAMPLE_DATA ? loadSampleData() : await loadTodayData();
    } catch (e) {
        console.error('Data load failed, using sample:', e);
        todayData = loadSampleData();
    }

    await renderMenu();

    document.querySelectorAll('[data-back]').forEach(btn => {
        btn.addEventListener('click', () => navigate('menu'));
    });

    document.querySelectorAll('.game-tile').forEach(tile => {
        tile.addEventListener('click', () => {
            const game = tile.dataset.game;
            hapticLight();
            openGame(game);
        });
    });

    setupModalDismissal();

    document.getElementById('total-continue').onclick = () => {
        document.getElementById('total-modal').classList.remove('active');
    };

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        const resultModal = document.getElementById('result-modal');
        const totalModal  = document.getElementById('total-modal');
        if (resultModal.classList.contains('active')) {
            resultModal.classList.remove('active');
            navigate('menu');
        } else if (totalModal.classList.contains('active')) {
            totalModal.classList.remove('active');
        } else if (currentScreen !== 'menu') {
            navigate('menu');
        }
    });
}

// ═══════════════════════════════════════
// BRAND DATE — "TUESDAY, 15 APR"
// ═══════════════════════════════════════

function renderBrandDate() {
    const now = new Date();
    const weekday = now.toLocaleDateString('en-GB', { weekday: 'long' }).toUpperCase();
    const day = now.getDate();
    const month = now.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase();
    document.getElementById('brand-date').textContent = `${weekday}, ${day} ${month}`;
}

// ═══════════════════════════════════════
// MODAL DISMISSAL
// ═══════════════════════════════════════

function setupModalDismissal() {
    const resultModal = document.getElementById('result-modal');
    const totalModal  = document.getElementById('total-modal');

    resultModal.addEventListener('click', (e) => {
        if (e.target === resultModal) {
            resultModal.classList.remove('active');
            navigate('menu');
        }
    });

    totalModal.addEventListener('click', (e) => {
        if (e.target === totalModal) {
            totalModal.classList.remove('active');
        }
    });
}

// ═══════════════════════════════════════
// MENU RENDER
// ═══════════════════════════════════════

async function renderMenu() {
    const state = await getState();
    const total = totalScore(state);

    // Hero score — count up on returning from a game
    const numEl = document.getElementById('hero-score-num');
    if (isFirstRender) {
        numEl.textContent = total;
        lastRenderedScore = total;
        isFirstRender = false;
    } else if (total !== lastRenderedScore) {
        animateCountUp(numEl, lastRenderedScore, total, 600);
        lastRenderedScore = total;
    }

    // Segment fills — each segment shows that game's score as fraction of its max
    ['tenable', 'guessPlayer', 'whoAmI', 'guessClub'].forEach(game => {
        const seg = document.querySelector(`.hero-segment[data-segment="${game}"] .hero-segment-fill`);
        const s = state[game];
        if (s && s.played) {
            const frac = Math.min(1, s.score / GAME_MAX[game]);
            seg.style.setProperty('--fill', frac.toFixed(2));
        } else {
            seg.style.setProperty('--fill', '0');
        }
    });

    // Tiles — completed state + score chip
    ['tenable', 'guessPlayer', 'whoAmI', 'guessClub'].forEach(game => {
        const tile = document.querySelector(`.game-tile[data-game="${game}"]`);
        const done = state[game]?.played;
        tile.classList.toggle('completed', !!done);

        const chipEl = tile.querySelector(`[data-score-tile="${game}"]`);
        if (done) {
            chipEl.textContent = `${state[game].score}/${GAME_MAX[game]}`;
        } else {
            chipEl.textContent = '';
        }
    });

    // Record today's score so streak strip reflects it
    if (countPlayed(state) > 0) {
        await recordToday(total);
    }

    // Streak strip
    await renderStreakStrip();
}

async function renderStreakStrip() {
    const strip = document.getElementById('streak-strip');
    const days = await getLast7Days();
    strip.innerHTML = days.map(d => {
        if (d.isToday) {
            return `<div class="streak-cell today">
                <span class="streak-day">${d.dayNum}</span>
                ${d.played ? `<span class="streak-score">${d.score}/25</span>` : ''}
            </div>`;
        }
        if (d.played) {
            return `<div class="streak-cell">
                <span class="streak-day">${d.dayNum}</span>
                <span class="streak-score">${d.score}/25</span>
            </div>`;
        }
        return `<div class="streak-cell missed">
            <span class="streak-day">${d.dayNum}</span>
        </div>`;
    }).join('');

    // Scroll to the right (today) since cells are oldest-first
    requestAnimationFrame(() => {
        strip.scrollLeft = strip.scrollWidth;
    });
}

function animateCountUp(el, from, to, duration) {
    if (from === to) {
        el.textContent = to;
        return;
    }
    const start = performance.now();
    const diff = to - from;
    function step(now) {
        const t = Math.min(1, (now - start) / duration);
        // Quadratic ease-out
        const eased = 1 - Math.pow(1 - t, 2);
        const v = Math.round(from + diff * eased);
        el.textContent = v;
        if (t < 1) requestAnimationFrame(step);
        else el.textContent = to;
    }
    requestAnimationFrame(step);
}

// ═══════════════════════════════════════
// GAME DISPATCH
// ═══════════════════════════════════════

async function openGame(gameKey) {
    const state = await getState();
    const gameData  = todayData[gameKey];
    const gameState = state[gameKey];

    const finishCb = async () => {
        await renderMenu();
        navigate('menu');
        const newState = await getState();
        if (countPlayed(newState) === 4) {
            showTotalScore(newState);
        }
    };

    navigate(`${gameKey}-screen`);

    switch (gameKey) {
        case 'tenable':     initTenable(gameData, gameState, finishCb); break;
        case 'guessPlayer': initGuessPlayer(gameData, gameState, finishCb); break;
        case 'whoAmI':      initWhoAmI(gameData, gameState, finishCb); break;
        case 'guessClub':   initGuessClub(gameData, gameState, finishCb); break;
    }
}

function navigate(target) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    const targetId = target === 'menu' ? 'menu-screen' : target;
    const screen = document.getElementById(targetId);
    if (screen) {
        screen.classList.add('active');
        currentScreen = target;
        screen.scrollTop = 0;
    }
}

function showTotalScore(state) {
    const modal = document.getElementById('total-modal');
    const total = totalScore(state);
    document.getElementById('total-score').textContent = `${total}/25`;

    const breakdown = [
        { label: 'Tenable',          score: state.tenable.score,     max: 10 },
        { label: 'Guess the Player', score: state.guessPlayer.score, max: 5 },
        { label: 'Who Am I',         score: state.whoAmI.score,      max: 5 },
        { label: 'Guess the Club',   score: state.guessClub.score,   max: 5 }
    ];

    document.getElementById('total-breakdown').innerHTML = breakdown.map(b => `
        <div class="breakdown-row">
            <span class="breakdown-label">${b.label}</span>
            <span class="breakdown-score">${b.score}/${b.max}</span>
        </div>
    `).join('');

    setTimeout(() => modal.classList.add('active'), 400);
}

document.addEventListener('DOMContentLoaded', bootstrap);
document.addEventListener('visibilitychange', async () => {
    if (!document.hidden && currentScreen === 'menu') {
        await renderMenu();
    }
});
