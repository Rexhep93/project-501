// Voetbal Quiz - main app controller
import { loadTodayData, loadSampleData } from './utils/data-loader.js';
import { getState, countPlayed, totalScore } from './utils/storage.js';
import { formatDisplayDate } from './utils/date-key.js';
import { hapticLight } from './utils/haptics.js';

import { initTenable }      from './games/tenable.js';
import { initGuessPlayer }  from './games/guess-player.js';
import { initWhoAmI }       from './games/who-am-i.js';
import { initGuessClub }    from './games/guess-club.js';

// Zet op `true` voor dev/testing zonder Google Sheets
const USE_SAMPLE_DATA = true;

let todayData = null;
let currentScreen = 'menu';

async function bootstrap() {
    // Datum header
    document.getElementById('date-display').textContent = formatDisplayDate();

    // Data laden
    try {
        todayData = USE_SAMPLE_DATA
            ? loadSampleData()
            : await loadTodayData();
    } catch (e) {
        console.error('Data load mislukt, fallback sample:', e);
        todayData = loadSampleData();
    }

    // Menu
    await renderMenu();

    // Back buttons
    document.querySelectorAll('[data-back]').forEach(btn => {
        btn.addEventListener('click', () => navigate('menu'));
    });

    // Game cards
    document.querySelectorAll('.game-card').forEach(card => {
        card.addEventListener('click', () => {
            const game = card.dataset.game;
            hapticLight();
            openGame(game);
        });
    });

    // Total modal close
    document.getElementById('total-continue').onclick = () => {
        document.getElementById('total-modal').classList.remove('active');
    };
}

/**
 * Vernieuw menu met huidige voortgang
 */
async function renderMenu() {
    const state = await getState();
    const played = countPlayed(state);

    // Progress bar
    document.getElementById('progress-count').textContent = `${played}/4`;
    document.getElementById('progress-fill').style.width = `${(played / 4) * 100}%`;

    // Status iconen per spel
    ['tenable', 'guessPlayer', 'whoAmI', 'guessClub'].forEach(game => {
        const el = document.querySelector(`[data-status="${game}"]`);
        const done = state[game]?.played;
        el.dataset.completed = done ? 'true' : 'false';

        // Card completed class
        const card = document.querySelector(`.game-card[data-game="${game}"]`);
        card.classList.toggle('completed', done);
    });
}

/**
 * Open een spel screen
 */
async function openGame(gameKey) {
    const state = await getState();
    const gameData  = todayData[gameKey];
    const gameState = state[gameKey];

    const finishCb = async () => {
        await renderMenu();
        navigate('menu');

        // Als alle 4 gespeeld: toon totaalscore
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

/**
 * Toggle screens
 */
function navigate(target) {
    const screens = document.querySelectorAll('.screen');
    screens.forEach(s => s.classList.remove('active'));

    const targetId = target === 'menu' ? 'menu-screen' : target;
    const screen = document.getElementById(targetId);
    if (screen) {
        screen.classList.add('active');
        currentScreen = target;
        // Scroll to top
        screen.scrollTop = 0;
    }
}

/**
 * Toon dagelijkse totaalscore modal
 */
function showTotalScore(state) {
    const modal = document.getElementById('total-modal');
    const total = totalScore(state);
    const max = 10 + 5 + 5 + 5; // = 25

    document.getElementById('total-score').textContent = `${total}/${max}`;

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

    // Korte delay zodat je eerst de menu refresh ziet
    setTimeout(() => modal.classList.add('active'), 400);
}

// Boot
document.addEventListener('DOMContentLoaded', bootstrap);

// Re-render menu bij zichtbaar worden (voor state updates)
document.addEventListener('visibilitychange', async () => {
    if (!document.hidden && currentScreen === 'menu') {
        await renderMenu();
    }
});
