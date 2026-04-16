import { loadTodayData, loadSampleData } from './utils/data-loader.js';
import { getState, countPlayed, totalScore } from './utils/storage.js';
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

function getISOWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

let todayData = null;
let currentScreen = 'menu';
let lastRenderedScore = 0;
let isFirstRender = true;

// ═══════════════════════════════════════
// BOOTSTRAP
// ═══════════════════════════════════════

async function bootstrap() {
    renderGreeting();

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
// GREETING — time + day based, warm copy
// ═══════════════════════════════════════

function renderGreeting() {
    const now = new Date();
    const hour = now.getHours();
    let partOfDay;
    if (hour < 6)       partOfDay = 'evening';
    else if (hour < 12) partOfDay = 'morning';
    else if (hour < 18) partOfDay = 'afternoon';
    else                partOfDay = 'evening';

    const greetings = {
        morning:   'Good morning',
        afternoon: 'Good afternoon',
        evening:   'Good evening'
    };
    document.getElementById('greeting-line-1').textContent = greetings[partOfDay];

    const weekday = now.toLocaleDateString('en-GB', { weekday: 'long' });
    document.getElementById('greeting-line-2').textContent = `${weekday}'s matchday`;

    const weekNum = getISOWeek(now);
    const label = document.getElementById('matchweek-label');
    if (label) {
        label.textContent = `Matchweek ${weekNum} · ${now.getDate()} ${now.toLocaleDateString('en-GB', { month: 'short' })}`;
    }
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

    // Score number — count up on returning from a game
    const numEl = document.getElementById('score-num');
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
        const seg = document.querySelector(`.score-segment[data-segment="${game}"] .score-segment-fill`);
        const s = state[game];
        if (s && s.played) {
            const frac = Math.min(1, s.score / GAME_MAX[game]);
            seg.style.setProperty('--fill', frac.toFixed(2));
        } else {
            seg.style.setProperty('--fill', '0');
        }
    });

    // Tiles — completed state + played chip
    ['tenable', 'guessPlayer', 'whoAmI', 'guessClub'].forEach(game => {
        const tile = document.querySelector(`.game-tile[data-game="${game}"]`);
        const done = state[game]?.played;
        tile.classList.toggle('completed', !!done);

        const chip = tile.querySelector(`[data-played-chip="${game}"]`);
        if (done) {
            chip.textContent = `${state[game].score}/${GAME_MAX[game]}`;
        } else {
            chip.textContent = '';
        }
    });

    // Record today in history if anything played
    if (countPlayed(state) > 0) {
        await recordToday(total);
    }

    await renderStreakStrip(state);
}

// ═══════════════════════════════════════
// STREAK STRIP
// ═══════════════════════════════════════

async function renderStreakStrip(state) {
    const strip = document.getElementById('streak-strip');
    const days = await getLast7Days();

    // For "today" cell, use live state's per-game played count (not just recorded total)
    const todayPlayedCount = countPlayed(state);

    strip.innerHTML = days.map(d => {
        const weekday = shortWeekday(d.date);

        if (d.isToday) {
            // Mini 4-segment progress for today
            const segs = [0, 1, 2, 3].map(i =>
                `<div class="streak-progress-seg ${i < todayPlayedCount ? 'filled' : ''}"></div>`
            ).join('');
            return `
                <div class="streak-cell today">
                    <span class="streak-weekday">${weekday}</span>
                    <span class="streak-daynum">${d.dayNum}</span>
                    <div class="streak-progress">${segs}</div>
                </div>`;
        }
        if (d.played) {
            return `
                <div class="streak-cell">
                    <span class="streak-weekday">${weekday}</span>
                    <span class="streak-daynum">${d.dayNum}</span>
                    <span class="streak-score-mini">${d.score}</span>
                </div>`;
        }
        return `
            <div class="streak-cell missed">
                <span class="streak-weekday">${weekday}</span>
                <span class="streak-daynum">${d.dayNum}</span>
                <span class="streak-score-mini">&nbsp;</span>
            </div>`;
    }).join('');

    requestAnimationFrame(() => {
        strip.scrollLeft = strip.scrollWidth;
    });
}

function shortWeekday(dateStr) {
    // dateStr is "YYYY-MM-DD" — parse as LOCAL date (avoid timezone UTC shift)
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 3);
}

// ═══════════════════════════════════════
// COUNT-UP ANIMATION
// ═══════════════════════════════════════

function animateCountUp(el, from, to, duration) {
    if (from === to) {
        el.textContent = to;
        return;
    }
    const start = performance.now();
    const diff = to - from;
    function step(now) {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 2); // quadratic ease-out
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
        const content = screen.querySelector('.game-content, .menu-container');
        if (content) content.scrollTop = 0;
    }
}

function showTotalScore(state) {
    const modal = document.getElementById('total-modal');
    const total = totalScore(state);
    document.getElementById('total-score').textContent = total;

    const breakdown = [
        { key: 'tenable',     label: 'Tenable',          score: state.tenable.score,     max: 10 },
        { key: 'guessPlayer', label: 'Guess the Player', score: state.guessPlayer.score, max: 5 },
        { key: 'whoAmI',      label: 'Who Am I',         score: state.whoAmI.score,      max: 5 },
        { key: 'guessClub',   label: 'Guess the Club',   score: state.guessClub.score,   max: 5 }
    ];

    document.getElementById('total-breakdown').innerHTML = breakdown.map(b => `
        <div class="breakdown-row" data-game="${b.key}">
            <span class="breakdown-dot"></span>
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
