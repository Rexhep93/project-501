import { findAllMatchIndices } from '../utils/name-match.js';
import { updateGameState } from '../utils/storage.js';
import { hapticSuccess, hapticError, hapticLight } from '../utils/haptics.js';
import { renderHearts } from '../utils/hearts.js';
import { toast } from '../utils/toast.js';

let data = null;
let state = null;
let onFinish = null;
let dateKey = null;

const MAX_LIVES = 3;
const MAX_HINTS = 3;

export function initFootball10(gameData, gameState, finishCb, forDate) {
    data = gameData;
    state = { ...gameState };
    onFinish = finishCb;
    dateKey = forDate;

    if (!data) { renderNoData(); return; }

    if (typeof state.wrongGuesses !== 'number') state.wrongGuesses = 0;
    if (!state.revealedFirstLetters) state.revealedFirstLetters = {};
    if (!Array.isArray(state.hintsUsed)) state.hintsUsed = [];

    document.getElementById('football10-question').textContent = data.question;
    document.getElementById('football10-subtitle').textContent = data.subtitle || '';

    renderHearts(document.getElementById('football10-attempts'), MAX_LIVES, state.wrongGuesses);
    renderPyramid();
    renderScoreChip();
    renderHintButton();

    const form = document.getElementById('football10-form');
    const input = document.getElementById('football10-input');
    input.value = '';
    input.disabled = state.played;
    form.onsubmit = handleSubmit;

    if (!state.played) setTimeout(() => input.focus(), 400);
    if (state.played) showResult();
}

function livesRemaining() {
    return Math.max(0, MAX_LIVES - state.wrongGuesses);
}

function renderScoreChip() {
    document.getElementById('football10-score').textContent = `${state.revealedRanks.length} / 10`;
}

/**
 * Hint button becomes visible after the first wrong guess.
 * Tapping it reveals the first letter of a random un-revealed rank, or the
 * rank itself if >= MAX_HINTS already used (no further hints).
 */
function renderHintButton() {
    const btn = document.getElementById('football10-hint-btn');
    if (!btn) return;
    const canHint = state.wrongGuesses > 0 && state.hintsUsed.length < MAX_HINTS && !state.played;
    btn.style.display = canHint ? 'inline-flex' : 'none';
    btn.onclick = handleHint;
    // Badge: remaining hints
    const badge = btn.querySelector('.hint-count');
    if (badge) {
        const left = MAX_HINTS - state.hintsUsed.length;
        badge.textContent = String(left);
    }
}

async function handleHint() {
    // Find unrevealed ranks that don't yet have a first-letter shown
    const unrevealed = data.answers
        .filter(a => !state.revealedRanks.includes(a.rank))
        .filter(a => !state.revealedFirstLetters[a.rank]);

    if (unrevealed.length === 0) {
        toast('No more hints available', 'warn');
        return;
    }

    // Random pick
    const pick = unrevealed[Math.floor(Math.random() * unrevealed.length)];
    const letter = (pick.name[0] || '?').toUpperCase();
    state.revealedFirstLetters[pick.rank] = letter;
    state.hintsUsed.push(pick.rank);
    await saveState();
    await hapticLight();
    toast(`#${pick.rank} starts with "${letter}"`, 'warn');

    // Update slot to show the hint inline
    const slot = document.querySelector(`.pyramid-slot[data-rank="${pick.rank}"]`);
    if (slot && !slot.classList.contains('revealed')) {
        slot.classList.add('hint');
        slot.innerHTML = `
            <span class="slot-rank">${pick.rank}</span>
            <span class="slot-name"><span class="slot-hint-letter">${letter}</span><span class="slot-hint-dots">…</span></span>
        `;
    }
    renderHintButton();
}

function renderPyramid() {
    const pyramid = document.getElementById('football10-pyramid');
    pyramid.innerHTML = '';
    for (let rank = 1; rank <= 10; rank++) {
        const slot = document.createElement('div');
        slot.className = 'pyramid-slot';
        const widthPct = 68 + ((rank - 1) / 9) * 32;
        slot.style.setProperty('--slot-width', `${widthPct}%`);
        const isRevealed = state.revealedRanks.includes(rank);
        const answer = data.answers.find(a => a.rank === rank);
        const hintLetter = state.revealedFirstLetters[rank];

        if (isRevealed && answer) {
            slot.classList.add('revealed');
            slot.innerHTML = `<span class="slot-rank">${rank}</span><span class="slot-name">${escapeHtml(answer.name)}</span>`;
        } else if (hintLetter) {
            slot.classList.add('hint');
            slot.innerHTML = `<span class="slot-rank">${rank}</span><span class="slot-name"><span class="slot-hint-letter">${hintLetter}</span><span class="slot-hint-dots">…</span></span>`;
        } else {
            slot.innerHTML = `<span class="slot-rank">${rank}</span><span class="slot-name"></span>`;
        }
        slot.dataset.rank = rank;
        pyramid.appendChild(slot);
    }
}

function renderNoData() {
    document.getElementById('football10-question').textContent = 'No quiz this day';
    document.getElementById('football10-subtitle').textContent = 'No data available';
    document.getElementById('football10-pyramid').innerHTML = '';
    document.getElementById('football10-form').onsubmit = (e) => e.preventDefault();
    document.getElementById('football10-input').disabled = true;
    const btn = document.getElementById('football10-hint-btn');
    if (btn) btn.style.display = 'none';
}

async function handleSubmit(e) {
    e.preventDefault();
    const input = document.getElementById('football10-input');
    const raw = input.value.trim();
    if (!raw) return;

    if (state.history.map(h => h.toLowerCase()).includes(raw.toLowerCase())) {
        toast('Already tried that', 'warn');
        shakeInput(input);
        input.value = '';
        return;
    }

    state.history.push(raw);
    const allIndices = findAllMatchIndices(raw, data.answers);

    // Filter out answers that are already revealed
    const newMatches = allIndices
        .map(i => data.answers[i])
        .filter(a => !state.revealedRanks.includes(a.rank));

    if (newMatches.length > 0) {
        // Sort by rank so the toast/reveal order is predictable
        newMatches.sort((a, b) => a.rank - b.rank);

        for (const answer of newMatches) {
            state.revealedRanks.push(answer.rank);
            const slot = document.querySelector(`.pyramid-slot[data-rank="${answer.rank}"]`);
            if (slot) {
                slot.classList.remove('hint');
                slot.classList.add('revealed');
                slot.innerHTML = `<span class="slot-rank">${answer.rank}</span><span class="slot-name">${escapeHtml(answer.name)}</span>`;
            }
        }

        await hapticSuccess();
        if (newMatches.length === 1) {
            const a = newMatches[0];
            toast(`Nice — #${a.rank} ${a.name}`, 'success');
        } else {
            const names = newMatches.map(a => `#${a.rank} ${a.name}`).join(' + ');
            toast(`Double hit — ${names}`, 'success');
        }

        input.value = '';
        await saveState();
        renderScoreChip();

        if (state.revealedRanks.length === 10) {
            await finishGame();
        }
        return;
    }

    // Input matched only already-revealed answers (all were duplicates)
    if (allIndices.length > 0) {
        const a = data.answers[allIndices[0]];
        toast(`${a.name} already on the board`, 'warn');
        shakeInput(input);
        input.value = '';
        return;
    }

    // No match at all — wrong guess
    state.wrongGuesses++;
    await hapticError();
    const remaining = livesRemaining();
    const msg = remaining > 0
        ? `Missed · ${remaining} ${remaining === 1 ? 'life' : 'lives'} left`
        : 'Missed · no lives left';
    toast(msg, 'error');
    shakeInput(input);
    input.value = '';
    renderHearts(document.getElementById('football10-attempts'), MAX_LIVES, state.wrongGuesses, true);
    renderHintButton();
    await saveState();

    if (remaining <= 0) {
        await finishGame();
    }
}

function shakeInput(input) {
    input.classList.remove('error');
    void input.offsetWidth;
    input.classList.add('error');
    setTimeout(() => input.classList.remove('error'), 500);
}

async function saveState() {
    state.score = state.revealedRanks.length;
    await updateGameState('football10', state, dateKey);
}

async function finishGame() {
    state.played = true;
    state.score = state.revealedRanks.length;
    await updateGameState('football10', state, dateKey);
    document.getElementById('football10-input').disabled = true;
    renderHintButton();

    const missed = data.answers.filter(a => !state.revealedRanks.includes(a.rank));
    for (const m of missed) {
        const slot = document.querySelector(`.pyramid-slot[data-rank="${m.rank}"]`);
        if (slot) {
            slot.classList.remove('hint');
            slot.classList.add('ghost');
            slot.innerHTML = `<span class="slot-rank">${m.rank}</span><span class="slot-name">${escapeHtml(m.name)}</span>`;
        }
    }
    setTimeout(() => showResult(), 800);
}

function showResult() {
    const modal = document.getElementById('result-modal');
    const icon  = document.getElementById('result-icon');
    const title = document.getElementById('result-title');
    const score = document.getElementById('result-score');
    const reveal= document.getElementById('result-reveal');

    const got = state.revealedRanks.length;
    const allTen = got === 10;

    icon.className = 'result-icon ' + (allTen ? 'success' : 'fail');
    icon.innerHTML = allTen
        ? `<svg viewBox="0 0 24 24"><use href="#i-check"/></svg>`
        : `<svg viewBox="0 0 24 24"><use href="#i-cross"/></svg>`;

    title.textContent = allTen ? 'Perfect ten.' : 'Nice try.';
    score.innerHTML = allTen
        ? `You named all <strong>10</strong>.`
        : `You named <strong>${got} out of 10</strong>.`;

    reveal.innerHTML = data.answers
        .slice()
        .sort((a, b) => a.rank - b.rank)
        .map(a => {
            const gotIt = state.revealedRanks.includes(a.rank);
            return `<div class="reveal-row">
                <span><span class="reveal-rank">${a.rank}.</span><span class="reveal-name">${escapeHtml(a.name)}</span></span>
                <span class="reveal-mark ${gotIt ? 'got' : 'missed'}">${gotIt ? '✓' : '–'}</span>
            </div>`;
        }).join('');

    modal.classList.add('active');
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
