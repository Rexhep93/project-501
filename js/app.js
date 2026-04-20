import { loadDataForDate, loadSampleData } from './utils/data-loader.js';
import { getState, countPlayed, totalScore } from './utils/storage.js';
import { hapticLight } from './utils/haptics.js';
import { recordScore, getLast7Days, getLifetimeStats } from './utils/history.js';
import { initViewportHandling } from './utils/viewport.js';
import { shareResult } from './utils/share.js';
import { toast } from './utils/toast.js';
import { todayKey, dateToKey, keyToDate, isToday } from './utils/date-key.js';
import { getSettings, saveSettings, applyTheme, initThemeListener } from './utils/settings.js';
import { checkAchievements, getRecentUnlocked, getAchievement, ACHIEVEMENTS, getUnlocked, getIcon, getColor } from './utils/achievements.js';

import { initTenable }      from './games/tenable.js';
import { initGuessPlayer }  from './games/guess-player.js';
import { initWhoAmI }       from './games/who-am-i.js';
import { initGuessClub }    from './games/guess-club.js';

const USE_SAMPLE_DATA = false;

const GAME_MAX = { tenable: 10, guessPlayer: 5, whoAmI: 5, guessClub: 5 };

let currentDate = todayKey();   // dateKey of the day currently loaded/shown
let currentData = null;         // the data for currentDate
let dataLoadFailed = false;
let currentScreen = 'menu';
let lastRenderedScore = 0;
let isFirstRender = true;
let celebrationShownForDate = null;  // which date's celebration we've already shown this session

// ═══════════════════════════════════════
// BOOTSTRAP
// ═══════════════════════════════════════

async function bootstrap() {
    initThemeListener();
    initViewportHandling();
    renderMasthead();
    showSkeleton();

    try {
        currentData = USE_SAMPLE_DATA ? loadSampleData() : await loadDataForDate(currentDate);
        dataLoadFailed = false;
    } catch (e) {
        console.error('Data load failed, using sample:', e);
        currentData = loadSampleData();
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
    setupSettings();
    setupBackToToday();

    const achCloseBtn = document.getElementById('achievements-close');
    if (achCloseBtn) achCloseBtn.onclick = closeAchievementsScreen;

    document.addEventListener('keydown', async (e) => {
        if (e.key !== 'Escape') return;
        const resultModal = document.getElementById('result-modal');
        const celeb = document.getElementById('celebration');
        const settings = document.getElementById('settings-screen');
        if (resultModal.classList.contains('active')) {
            closeResultModal();
        } else if (celeb.classList.contains('active')) {
            celeb.classList.remove('active');
        } else if (settings.classList.contains('active')) {
            closeSettings();
        } else if (document.getElementById('achievements-screen').classList.contains('active')) {
            closeAchievementsScreen();
        } else if (currentScreen !== 'menu') {
            navigate('menu');
        }
    });
}

// ═══════════════════════════════════════
// SKELETON / ERROR
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
                currentData = await loadDataForDate(currentDate);
                dataLoadFailed = false;
            } catch (e) {
                currentData = loadSampleData();
                dataLoadFailed = true;
            }
            hideSkeleton();
            await renderMenu();
            if (dataLoadFailed) showDataErrorBanner();
            else toast("Quiz loaded", 'success');
        };
    }
}

// ═══════════════════════════════════════
// MASTHEAD
// ═══════════════════════════════════════

function renderMasthead() {
    const d = keyToDate(currentDate);
    const weekday = d.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase();
    const day = d.getDate();
    const month = d.toLocaleDateString('en-GB', { month: 'short' }).toUpperCase();
    const dateEl = document.getElementById('masthead-date');
    if (dateEl) dateEl.textContent = `${weekday} · ${day} ${month}`;
}

function setupBackToToday() {
    const btn = document.getElementById('back-to-today');
    if (!btn) return;
    btn.onclick = async () => {
        await loadDay(todayKey());
    };
}

function updateBackToTodayVisibility() {
    const btn = document.getElementById('back-to-today');
    if (!btn) return;
    btn.style.display = isToday(currentDate) ? 'none' : 'inline-flex';
}

// ═══════════════════════════════════════
// RESULT MODAL
// ═══════════════════════════════════════

function closeResultModal() {
    const modal = document.getElementById('result-modal');
    modal.classList.remove('active');
}

function setupModalDismissal() {
    const resultModal = document.getElementById('result-modal');

    // Backdrop tap = close modal, stay on game screen
    resultModal.addEventListener('click', (e) => {
        if (e.target === resultModal) {
            closeResultModal();
        }
    });

    // X button = close modal, stay on game screen
    const closeBtn = document.getElementById('result-close');
    if (closeBtn) closeBtn.onclick = () => closeResultModal();

    // Continue = save progress and go back to menu
    const continueBtn = document.getElementById('result-continue');
    if (continueBtn) {
        continueBtn.onclick = async () => {
            closeResultModal();
            await handleGameFinished();
        };
    }
}

async function handleGameFinished() {
    await renderMenu();
    navigate('menu');
    const newState = await getState(currentDate);
    
    // Check achievements before celebration (toasts will fire)
    await checkAchievements(newState);
    
    if (countPlayed(newState) === 4 && celebrationShownForDate !== currentDate) {
        celebrationShownForDate = currentDate;
        setTimeout(() => showCelebration(newState), 500);
    }
}

// ═══════════════════════════════════════
// CELEBRATION
// ═══════════════════════════════════════

function setupCelebration() {
    const celeb = document.getElementById('celebration');
    document.getElementById('celeb-close').onclick = () => celeb.classList.remove('active');
    document.getElementById('celeb-see-review').onclick = () => celeb.classList.remove('active');
    document.getElementById('celeb-share').onclick = async () => {
        hapticLight();
        const state = await getState(currentDate);
        await shareResult(state);
    };
}

function showCelebration(state) {
    const celeb = document.getElementById('celebration');
    const total = totalScore(state);

    document.querySelectorAll('#celeb-recap .celeb-recap-fill').forEach(f => {
        f.style.transform = 'scaleX(0)';
    });

    const games = ['tenable', 'guessPlayer', 'whoAmI', 'guessClub'];
    games.forEach(g => {
        const row = document.querySelector(`.celeb-recap-row[data-game="${g}"]`);
        if (!row) return;
        const s = state[g];
        const score = s?.score || 0;
        const max = GAME_MAX[g];
        row.querySelector('.celeb-recap-score').textContent = `${score}/${max}`;
    });

    const numEl = document.getElementById('celeb-score-num');
    numEl.textContent = '0';

    // Set date on the share-ready card
    const celebDate = document.getElementById('celeb-date');
    if (celebDate) {
        const d = keyToDate(currentDate);
        celebDate.textContent = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    celeb.classList.add('active');

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

    setTimeout(() => {
        animateCountUp(numEl, 0, total, 900);
    }, 1200);
}

// ═══════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════

function setupSettings() {
    const btn = document.getElementById('settings-btn');
    if (btn) btn.onclick = openSettings;

    const closeBtn = document.getElementById('settings-close');
    if (closeBtn) closeBtn.onclick = closeSettings;

    // Theme radio group
    document.querySelectorAll('[data-theme-option]').forEach(el => {
        el.onclick = () => {
            const theme = el.dataset.themeOption;
            saveSettings({ theme });
            updateSettingsUI();
            hapticLight();
        };
    });

    updateSettingsUI();
}

function openSettings() {
    hapticLight();
    updateSettingsUI();
    document.getElementById('settings-screen').classList.add('active');
}

function closeSettings() {
    document.getElementById('settings-screen').classList.remove('active');
}

function updateSettingsUI() {
    const current = getSettings().theme;
    document.querySelectorAll('[data-theme-option]').forEach(el => {
        el.classList.toggle('selected', el.dataset.themeOption === current);
    });
}

// ═══════════════════════════════════════
// MENU RENDER
// ═══════════════════════════════════════

async function renderMenu() {
    const state = await getState(currentDate);
    const total = totalScore(state);
    const played = countPlayed(state);

    renderMasthead();
    updateBackToTodayVisibility();
    renderScoreCard(state, total, played);
    renderTiles(state);

    // Only record to history if we played on today — oude dagen inhalen slaat
    // wel de beste score op, maar niet als vandaag.
    if (played > 0) await recordScore(total, currentDate);

    await renderWeekStrip();
    await renderLifetimeStats();
    renderAchievementsStrip();
}

function renderAchievementsStrip() {
    const section = document.getElementById('achievements-strip-section');
    const strip = document.getElementById('achievements-strip');
    if (!section || !strip) return;
    section.style.display = 'block';

    const unlocked = getUnlocked();
    const recentIds = getRecentUnlocked(3);
    const locked = ACHIEVEMENTS.filter(a => !unlocked[a.id]);

    const cells = [];
    let unlockedShown = 0;
    let lockedShown = 0;

    for (let i = 0; i < 3; i++) {
        let ach = null;
        let isLocked = false;

        if (unlockedShown < recentIds.length) {
            ach = getAchievement(recentIds[unlockedShown]);
            unlockedShown++;
        } else if (lockedShown < locked.length) {
            ach = locked[lockedShown];
            isLocked = true;
            lockedShown++;
        }

        if (!ach) {
            cells.push(`<div class="ach-strip-item locked"><div class="ach-strip-badge"></div><span class="ach-strip-name">—</span></div>`);
            continue;
        }

        cells.push(`
            <div class="ach-strip-item ${isLocked ? 'locked' : ''}" style="--ach-color: ${getColor(ach)};">
                <div class="ach-strip-badge">${getIcon(ach)}</div>
                <span class="ach-strip-name">${escapeHtml(ach.name)}</span>
            </div>
        `);
    }
    strip.innerHTML = cells.join('');

    const viewAllBtn = document.getElementById('achievements-view-all');
    if (viewAllBtn) viewAllBtn.onclick = openAchievementsScreen;
    strip.querySelectorAll('.ach-strip-item').forEach(el => {
        el.onclick = openAchievementsScreen;
    });
}

function openAchievementsScreen() {
    hapticLight();
    renderAchievementsScreen();
    document.getElementById('achievements-screen').classList.add('active');
}

function closeAchievementsScreen() {
    document.getElementById('achievements-screen').classList.remove('active');
}

function renderAchievementsScreen() {
    const body = document.getElementById('achievements-body');
    if (!body) return;

    const unlocked = getUnlocked();
    const unlockedCount = Object.keys(unlocked).length;
    const total = ACHIEVEMENTS.length;
    const progressFrac = total > 0 ? (unlockedCount / total).toFixed(2) : 0;

    const groups = { streak: [], score: [], game: [], meta: [] };
    ACHIEVEMENTS.forEach(a => { if (groups[a.category]) groups[a.category].push(a); });

    const groupTitles = {
        streak: 'Streak',
        score: 'Score',
        game: 'Game mastery',
        meta: 'Milestones'
    };

    let html = `
        <div class="achievements-progress">
            <div>
                <span class="achievements-progress-num">${unlockedCount}</span>
                <span class="achievements-progress-max">/ ${total}</span>
            </div>
            <p class="achievements-progress-label">Unlocked</p>
            <div class="achievements-progress-bar">
                <div class="achievements-progress-bar-fill" style="--progress: ${progressFrac};"></div>
            </div>
        </div>
    `;

    for (const cat of ['streak', 'score', 'game', 'meta']) {
        const items = groups[cat];
        if (!items.length) continue;
        html += `
            <section class="achievements-section">
                <h3 class="achievements-section-title">${groupTitles[cat]}</h3>
                <div class="achievements-grid">
                    ${items.map(ach => {
                        const isUnlocked = !!unlocked[ach.id];
                        return `
                            <div class="ach-card ${isUnlocked ? '' : 'locked'}" style="--ach-color: ${getColor(ach)};">
                                <div class="ach-card-badge">${getIcon(ach)}</div>
                                <h4 class="ach-card-name">${escapeHtml(ach.name)}</h4>
                                <p class="ach-card-desc">${escapeHtml(ach.description)}</p>
                            </div>
                        `;
                    }).join('')}
                </div>
            </section>
        `;
    }

    body.innerHTML = html;
}

async function renderLifetimeStats() {
    const el = document.getElementById('lifetime-stats');
    if (!el) return;
    const stats = await getLifetimeStats();
    if (stats.days === 0) { el.innerHTML = ''; return; }
    el.innerHTML = `
        <div class="lifetime-row">
            <div class="lifetime-item">
                <span class="lifetime-value">${stats.streak}</span>
                <span class="lifetime-label">Day streak</span>
            </div>
            <div class="lifetime-divider"></div>
            <div class="lifetime-item">
                <span class="lifetime-value">${stats.total.toLocaleString('en-GB')}</span>
                <span class="lifetime-label">Total points</span>
            </div>
            <div class="lifetime-divider"></div>
            <div class="lifetime-item">
                <span class="lifetime-value">${stats.best}<span class="lifetime-value-max">/25</span></span>
                <span class="lifetime-label">Best matchday</span>
            </div>
        </div>
    `;
}

function renderScoreCard(state, total, played) {
    const card = document.getElementById('score-card');
    if (!card) return;

    if (played === 0) {
        card.dataset.state = 'fresh';
        const otd = currentData?.onThisDay;
        if (otd && otd.headline) {
            card.innerHTML = `
                <div class="sc-otd">
                    <p class="sc-otd-eyebrow">On this day · ${otd.year || ''}</p>
                    <h3 class="sc-otd-headline">${escapeHtml(otd.headline)}</h3>
                    ${otd.story ? `<p class="sc-otd-story">${escapeHtml(otd.story)}</p>` : ''}
                </div>
            `;
        } else {
            card.innerHTML = `
                <div class="sc-otd">
                    <p class="sc-otd-eyebrow">${isToday(currentDate) ? "Today's matchday" : "That day"}</p>
                    <h3 class="sc-otd-headline">Four games waiting.</h3>
                </div>
            `;
        }
        lastRenderedScore = 0;
        isFirstRender = false;
        return;
    }

    if (played < 4) {
        card.dataset.state = 'progress';
        card.innerHTML = `
            <div class="sc-progress">
                <p class="sc-label">${isToday(currentDate) ? "Today's score" : 'Score'}</p>
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
        // Show celebration screen invisibly to render the share-card, then share
        const celebState = await getState(currentDate);
        showCelebration(celebState);
        await new Promise(r => setTimeout(r, 400));  // wait for bars to animate
        await shareResult(celebState);
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
        if (done) chip.textContent = `${state[game].score}/${GAME_MAX[game]}`;
        else chip.textContent = '';
    });
}

async function renderWeekStrip() {
    const strip = document.getElementById('week-strip');
    if (!strip) return;
    const days = await getLast7Days();
    const todayState = await getState(todayKey());
    const todayPlayed = countPlayed(todayState);
    const todayFillFrac = (todayPlayed / 4).toFixed(2);

    strip.innerHTML = days.map(d => {
        const weekday = shortWeekday(d.date);
        const isSelected = d.date === currentDate;
        const classes = ['day-cell'];
        if (d.isToday) classes.push('today');
        if (isSelected) classes.push('selected');
        if (d.played && !d.isToday) classes.push('played');
        return `
            <button class="${classes.join(' ')}" data-date="${d.date}">
                ${d.isToday ? `<div class="day-cell-today-fill" style="--fill: ${todayFillFrac};"></div>` : ''}
                <span class="day-cell-weekday">${weekday}</span>
                <span class="day-cell-num">${d.dayNum}</span>
                ${d.played && !d.isToday ? `<svg class="day-cell-check" viewBox="0 0 24 24"><use href="#i-check"/></svg>` : ''}
            </button>`;
    }).join('');
    
    // Bind clicks
    strip.querySelectorAll('.day-cell').forEach(el => {
        el.onclick = async () => {
            const target = el.dataset.date;
            if (target === currentDate) return;
            hapticLight();
            await loadDay(target);
        };
    });
}

async function loadDay(dateKey) {
    currentDate = dateKey;
    isFirstRender = true;  // reset so score doesn't animate from wrong value
    showSkeleton();
    try {
        currentData = await loadDataForDate(currentDate);
        dataLoadFailed = false;
    } catch (e) {
        currentData = loadSampleData();
        dataLoadFailed = true;
    }
    hideSkeleton();
    await renderMenu();
    if (dataLoadFailed) showDataErrorBanner();
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
    const state = await getState(currentDate);
    const gameData  = currentData[gameKey];
    const gameState = state[gameKey];

    const hero = document.getElementById(`${gameKey}-hero`);
    if (hero) hero.classList.remove('shrunk');

    const finishCb = handleGameFinished;

    navigate(`${gameKey}-screen`);

    switch (gameKey) {
        case 'tenable':     initTenable(gameData, gameState, finishCb, currentDate); break;
        case 'guessPlayer': initGuessPlayer(gameData, gameState, finishCb, currentDate); break;
        case 'whoAmI':      initWhoAmI(gameData, gameState, finishCb, currentDate); break;
        case 'guessClub':   initGuessClub(gameData, gameState, finishCb, currentDate); break;
    }
    setupHeroShrink(gameKey);
}

function setupHeroShrink(gameKey) {
    const hero = document.getElementById(`${gameKey}-hero`);
    const form = document.getElementById(`${gameKey}-form`);
    const input = document.getElementById(`${gameKey}-input`);
    if (!hero || !form || !input) return;

    // Auto-shrink after 4 seconds of viewing the game
    const autoShrinkTimer = setTimeout(() => {
        if (!hero.classList.contains('shrunk')) {
            hero.classList.add('shrunk');
        }
    }, 4000);

    // Also shrink on first submit
    form.addEventListener('submit', () => {
        if (!input.value.trim()) return;
        clearTimeout(autoShrinkTimer);
        if (!hero.classList.contains('shrunk')) hero.classList.add('shrunk');
    });

    // Tap hero to toggle (expand if shrunk, shrink if expanded)
    hero.addEventListener('click', (e) => {
        if (e.target.closest('.hero-score-chip')) return;
        if (e.target.closest('#tenable-hint-btn')) return;
        clearTimeout(autoShrinkTimer);
        hero.classList.toggle('shrunk');
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
        // Re-render in case day rolled over
        if (isToday(currentDate) === false && todayKey() !== currentDate) {
            // fine — stay where we are
        }
        await renderMenu();
    }
});

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}
