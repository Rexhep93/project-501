import { loadTodayData, loadSampleData } from './utils/data-loader.js';
import { getState, countPlayed, totalScore } from './utils/storage.js';
import { formatDisplayDate } from './utils/date-key.js';
import { hapticLight } from './utils/haptics.js';

import { initTenable }      from './games/tenable.js';
import { initGuessPlayer }  from './games/guess-player.js';
import { initWhoAmI }       from './games/who-am-i.js';
import { initGuessClub }    from './games/guess-club.js';

const USE_SAMPLE_DATA = true;

const GAME_MAX = {
    tenable: 10,
    guessPlayer: 5,
    whoAmI: 5,
    guessClub: 5
};

let todayData = null;
let currentScreen = 'menu';

async function bootstrap() {
    document.getElementById('date-display').textContent = formatDisplayDate();

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

    // ESC closes any open modal + returns to menu if from result
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

/**
 * Click on modal backdrop → close + return to menu (for result modal)
 * For total modal → just close
 */
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

async function renderMenu() {
    const state = await getState();
    const played = countPlayed(state);

    document.getElementById('progress-count').textContent = `${played}/4`;
    document.getElementById('progress-fill').style.width = `${(played / 4) * 100}%`;

    ['tenable', 'guessPlayer', 'whoAmI', 'guessClub'].forEach(game => {
        const tile = document.querySelector(`.game-tile[data-game="${game}"]`);
        const done = state[game]?.played;
        tile.classList.toggle('completed', !!done);

        // Show score on completed tile
        const scoreEl = tile.querySelector(`[data-score-tile="${game}"]`);
        if (done) {
            scoreEl.textContent = `${state[game].score}/${GAME_MAX[game]}`;
        } else {
            scoreEl.textContent = '';
        }
    });
}

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
    const max = 25;
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

    setTimeout(() => modal.classList.add('active'), 400);
}

document.addEventListener('DOMContentLoaded', bootstrap);
document.addEventListener('visibilitychange', async () => {
    if (!document.hidden && currentScreen === 'menu') {
        await renderMenu();
    }
});
