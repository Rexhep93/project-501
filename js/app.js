import { loadTodayData, loadSampleData } from './utils/data-loader.js';
import { getState, countPlayed, totalScore } from './utils/storage.js';
import { hapticLight } from './utils/haptics.js';
import { recordToday, getLast7Days } from './utils/history.js';
import { initViewportHandling } from './utils/viewport.js';
import { shareResult } from './utils/share.js';
import { toast } from './utils/toast.js';

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

const GAME_LABELS = {
    tenable: 'Tenable',
    guessPlayer: 'Player',
    whoAmI: 'Who Am I',
    guessClub: 'Club'
};

let todayData = null;
let dataLoadFailed = false;
let currentScreen = 'menu';
let lastRenderedScore = 0;
let isFirstRender = true;
let celebrationShown = false;

// ═══════════════════════════════════════
// BOOTSTRAP
// ═══════════════════════════════════════

async function bootstrap() {
    initViewportHandling();
    renderMasthead();
    showSkeleton();

    try {
        todayData = USE_SAMPLE_DATA ? loadSampleData() : await loadTodayData();
        dataLoadFailed = false;
    } catch (e) {
        console.error('Data load failed completely, using sample:', e);
        todayData = loadSampleData();
        dataLoadFailed = true;
    }

    hideSkeleton();
    await renderMenu();

    if (dataLoadFailed) showDataErrorBanner();

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
    setupCelebration();

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        const resultModal = document.getElementById('result-modal');
        const celeb = document.getElementById('celebration');
        if (resultModal.classList.contains('active')) {
            resultModal.classList.remove('active');
            navigate('menu');
        } else if (celeb.classList.contains('active')) {
            celeb.classList.remove('active');
        } else if (currentScreen !== 'menu') {
            navigate('menu');
        }
    });
}

// ═══════════════════════════════════════
// SKELETON / ERROR STATES
// ═══════════════════════════════════════

function showSkeleton() { document.body.classList.add('loading'); }
function hideSkeleton() { document.body.classList.remove('loading'); }

function showDataErrorBanner() {
    const banner = document.getElementById('data-error-banner');
    if (!banner) return;
    banner.classList.add('visible');
    const retryBtn = document.getElementById('data-error-retry');
    if (retryBtn) {
        retryBtn.onclick = async () => {
            banner.classList.remove('visible');
            showSkeleton();
            try {
                todayData = await loadTodayData();
                dataLoadFailed = false;
            } catch (e) {
                todayData = loadSampleData();
                dataLoadFailed = true;
            }
            hideSkeleton();
            await renderMenu();
            if (dataLoadFailed) showDataErrorBanner();
            else toast("Today's quiz loaded", 'success');
        };
    }
}

// ═══════════════════════════════════════
// MASTHEAD (date + matchday number)
// ═══════════════════════════════════════

function getMatchdayNumber() {
    // Anchor: Matchday 1 = Jan 1 2026. Compute days since then.
    const anchor = new Date(2026, 0, 1);
    const now = new Date();
    const days = Math.floor((now - anchor) / (1000 * 60 * 60 * 24));
    return Math.max(1, days + 1);
}

function renderMasthead() {
    const now = new Date();
    const weekday = now.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase();
    const day = now.getDate();
    const month = now.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase();
    const dateEl = document.getElementById('masthead-date');
    if (dateEl) dateEl.textContent = `${weekday} · ${day} ${month}`;
    const numEl = document.getElementById('masthead-num');
    if (numEl) numEl.textContent = getMatchdayNumber();
}

// ═══════════════════════════════════════
// MODAL DISMISSAL
// ═══════════════════════════════════════

function setupModalDismissal() {
    const resultModal = document.getElementById('result-modal');
    resultModal.addEventListener('click', (e) => {
        if (e.target === resultModal) {
            resultModal.classList.remove('active');
            navigate('menu');
        }
    });
}

// ═══════════════════════════════════════
// CELEBRATION
// ═══════════════════════════════════════

function setupCelebration() {
    const celeb = document.getElementById('celebration');
    document.getElementById('celeb-close').onclick = () => {
        celeb.classList.remove('active');
    };
    document.getElementById('celeb-see-review').onclick = () => {
        celeb.classList.remove('active');
    };
    document.getElementById('celeb-share').onclick = async () => {
        hapticLight();
        const state = await getState();
        await shareResult(state);
    };
}

function showCelebration(state) {
    const celeb = document.getElementById('celebration');
    const total = totalScore(state);

    // Reset fills so animation re-plays
    document.querySelectorAll('#celeb-recap .celeb-recap-fill').forEach(f => {
        f.style.transform = 'scaleX(0)';
    });

    // Set recap scores + labels
    const games = ['tenable', 'guessPlayer', 'whoAmI', 'guessClub'];
    games.forEach(g => {
        const row = document.querySelector(`.celeb-recap-row[data-game="${g}"]`);
        if (!row) return;
        const s = state[g];
        const score = s?.score || 0;
        const max = GAME_MAX[g];
        row.querySelector('.celeb-recap-score').textContent = `${score}/${max}`;
    });

    // Reset big score to 0 before animating
    const numEl = document.getElementById('celeb-score-num');
    numEl.textContent = '0';

    celeb.classList.add('active');

    // Staggered bar fills (starts ~400ms in, gives CSS fade-up time)
    games.forEach((g, i) => {
        setTimeout(() => {
            const row = document.querySelector(`.celeb-recap-row[data-game="${g}"]`);
            if (!row) return;
            const s = state[g];
            const frac = s ? Math.min(1, (s.score || 0) / GAME_MAX[g]) : 0;
            const fill = row.querySelector('.celeb-recap-fill');
            fill.style.transform = `scaleX(${frac.toFixed(2)})`;
        }, 500 + i * 150);
    });

    // Count up big number after bars finish (around 1.2s total)
    setTimeout(() => {
        animateCountUp(numEl, 0, total, 900);
    }, 1200);
}

// ═══════════════════════════════════════
// MENU RENDER
// ═══════════════════════════════════════

async function renderMenu() {
    const state = await getState();
    const total = totalScore(state);
    const played = countPlayed(state);

    renderScoreCard(state, total, played);
    renderTiles(state);

    if (played > 0) await recordToday(total);

    await renderWeekStrip(state);
}

function renderScoreCard(state, total, played) {
    const card = document.getElementById('score-card');
    if (!card) return;

    // 3 states: fresh (0 played), progress (1-3 played), done (4 played)
    if (played === 0) {
        card.dataset.state = 'fresh';
        card.innerHTML = `
            <div class="sc-fresh">
                <p class="sc-fresh-eyebrow">Today's edition</p>
                <p class="sc-fresh-quote">"Four games. Take your time."</p>
            </div>
        `;
        lastRenderedScore = 0;
        isFirstRender = false;
        return;
    }

    if (played < 4) {
        card.dataset.state = 'progress';
        card.innerHTML = `
            <div class="sc-progress">
                <p class="sc-label">Today's score</p>
                <div class="sc-value">
                    <span class="sc-num" id="score-num">${isFirstRender ? total : lastRenderedScore}</span>
                    <span class="sc-max">/25</span>
                </div>
                <p class="sc-sub">${played} of 4 played</p>
            </div>
            <div class="sc-segments">
                ${['tenable','guessPlayer','whoAmI','guessClub'].map(g => `
                    <div class="sc-segment" data-segment="${g}"><div class="sc-segment-fill"></div></div>
                `).join('')}
            </div>
        `;
        const numEl = document.getElementById('score-num');
        if (!isFirstRender && total !== lastRenderedScore) {
            animateCountUp(numEl, lastRenderedScore, total, 600);
        }
        lastRenderedScore = total;
        isFirstRender = false;

        // Fill segments
        ['tenable','guessPlayer','whoAmI','guessClub'].forEach(g => {
            const seg = card.querySelector(`.sc-segment[data-segment="${g}"] .sc-segment-fill`);
            if (!seg) return;
            const s = state[g];
            if (s && s.played) {
                const frac = Math.min(1, s.score / GAME_MAX[g]);
                requestAnimationFrame(() => seg.style.setProperty('--fill', frac.toFixed(2)));
            } else {
                seg.style.setProperty('--fill', '0');
            }
        });
        return;
    }

    // DONE state
    card.dataset.state = 'done';
    card.innerHTML = `
        <div class="sc-done-left">
            <p class="sc-done-eyebrow">Matchday complete</p>
            <div class="sc-done-value">
                <span class="sc-done-num">${total}</span>
                <span class="sc-done-max">/25</span>
            </div>
        </div>
        <button class="sc-done-share" id="sc-done-share">
            <svg viewBox="0 0 24 24"><use href="#i-share"/></svg>
            <span>Share</span>
        </button>
    `;
    document.getElementById('sc-done-share').onclick = async (e) => {
        e.stopPropagation();
        hapticLight();
        await shareResult(state);
    };
    lastRenderedScore = total;
    isFirstRender = false;
}

function renderTiles(state) {
    ['tenable', 'guessPlayer', 'whoAmI', 'guessClub'].forEach(game => {
        const tile = document.querySelector(`.game-tile[data-game="${game}"]`);
        if (!tile) return;
        const done = state[game]?.played;
        tile.classList.toggle('completed', !!done);

        const chip = tile.querySelector(`[data-played-chip="${game}"]`);
        if (done) {
            chip.textContent = `${state[game].score}/${GAME_MAX[game]}`;
        } else {
            chip.textContent = '';
        }
    });
}

async function renderWeekStrip(state) {
    const strip = document.getElementById('week-strip');
    if (!strip) return;
    const days = await getLast7Days();
    const played = countPlayed(state);
    const fillFrac = (played / 4).toFixed(2);

    strip.innerHTML = days.map(d => {
        const weekday = shortWeekday(d.date);

        if (d.isToday) {
            return `
                <div class="day-cell today">
                    <div class="today-ring-fill" style="--fill: ${fillFrac};"></div>
                    <div class="today-ring"></div>
                    <span class="day-cell-weekday">${weekday}</span>
                    <span class="day-cell-num">${d.dayNum}</span>
                </div>`;
        }
        if (d.played) {
            return `
                <div class="day-cell">
                    <span class="day-cell-weekday">${weekday}</span>
                    <span class="day-cell-num">${d.dayNum}</span>
                    <span class="day-cell-score">${d.score}</span>
                </div>`;
        }
        return `
            <div class="day-cell missed">
                <span class="day-cell-weekday">${weekday}</span>
                <span class="day-cell-num">${d.dayNum}</span>
            </div>`;
    }).join('');
}

function shortWeekday(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 3);
}

function animateCountUp(el, from, to, duration) {
    if (!el) return;
    if (from === to) { el.textContent = to; return; }
    const start = performance.now();
    const diff = to - from;
    function step(now) {
        const t = Math.min(1, (now - start) / duration);
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

    // Reset hero to full state when opening
    const hero = document.getElementById(`${gameKey}-hero`);
    if (hero) hero.classList.remove('shrunk');

    const finishCb = async () => {
        await renderMenu();
        navigate('menu');
        const newState = await getState();
        if (countPlayed(newState) === 4 && !celebrationShown) {
            celebrationShown = true;
            setTimeout(() => showCelebration(newState), 500);
        }
    };

    navigate(`${gameKey}-screen`);

    switch (gameKey) {
        case 'tenable':     initTenable(gameData, gameState, finishCb); break;
        case 'guessPlayer': initGuessPlayer(gameData, gameState, finishCb); break;
        case 'whoAmI':      initWhoAmI(gameData, gameState, finishCb); break;
        case 'guessClub':   initGuessClub(gameData, gameState, finishCb); break;
    }

    // Hook hero-shrink: shrink on first input focus OR first submit
    setupHeroShrink(gameKey);
}

function setupHeroShrink(gameKey) {
    const hero = document.getElementById(`${gameKey}-hero`);
    const form = document.getElementById(`${gameKey}-form`);
    const input = document.getElementById(`${gameKey}-input`);
    if (!hero || !form || !input) return;

    // Shrink only on first real submit (user typed something and pressed enter).
    // Do NOT trigger on focus — the input auto-focuses on screen open, which
    // would shrink the hero before the user can read the question.
    const shrinkOnce = (e) => {
        // Ignore empty submits (happens if user just hits enter on empty field)
        if (!input.value.trim()) return;
        if (!hero.classList.contains('shrunk')) {
            hero.classList.add('shrunk');
        }
    };

    form.addEventListener('submit', shrinkOnce);

    // Tap-to-expand: tapping the shrunk hero temporarily expands it
    hero.addEventListener('click', (e) => {
        // Don't expand if user clicks the score chip or a button
        if (e.target.closest('.hero-score-chip')) return;
        if (hero.classList.contains('shrunk')) {
            hero.classList.remove('shrunk');
            // Auto-re-shrink after 4s if user doesn't interact
            setTimeout(() => {
                // Only re-shrink if they've already made a submit attempt
                if (input.value === '' && form.dataset.everSubmitted === '1') {
                    hero.classList.add('shrunk');
                }
            }, 4000);
        }
    });

    // Track first submit for re-shrink logic above
    form.addEventListener('submit', () => {
        if (input.value.trim()) form.dataset.everSubmitted = '1';
    });
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

document.addEventListener('DOMContentLoaded', bootstrap);
document.addEventListener('visibilitychange', async () => {
    if (!document.hidden && currentScreen === 'menu') {
        await renderMenu();
    }
});
