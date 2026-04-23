// Per-day game state. Key format: voetbalquiz_daily_state_YYYY-MM-DD
// Migration: old key 'voetbalquiz_daily_state' (single-day) is read once, moved
// to its date-suffixed equivalent, then removed.
//
// Uses the shared kv-store abstraction so the same code runs on web
// (localStorage) and in a Capacitor iOS build (Preferences plugin).

import { todayKey } from './date-key.js';
import { kvGet as rawGet, kvSet as rawSet, kvRemove as rawRemove } from './kv-store.js';

const STORAGE_PREFIX = 'voetbalquiz_daily_state_';
const LEGACY_KEY = 'voetbalquiz_daily_state';

function defaultState(dateKey) {
    return {
        date: dateKey,
        football10:  { played: false, score: 0, revealedRanks: [], history: [], wrongGuesses: 0, hintsUsed: [], revealedFirstLetters: {} },
        guessPlayer: { played: false, score: 0, attempts: 0, revealedClubs: 1, solved: false },
        whoAmI:      { played: false, score: 0, attempts: 0, revealedHints: 1, solved: false },
        guessClub:   { played: false, score: 0, attempts: 0, solved: false, shirtsRevealed: false }
    };
}

function keyFor(dateKey) {
    return STORAGE_PREFIX + dateKey;
}

/**
 * Migrate legacy key if it exists and matches today.
 */
let migrationDone = false;
async function migrateLegacyIfNeeded() {
    if (migrationDone) return;
    migrationDone = true;
    try {
        const raw = await rawGet(LEGACY_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (parsed.date) {
            const newKey = keyFor(parsed.date);
            const existing = await rawGet(newKey);
            if (!existing) {
                await rawSet(newKey, raw);
            }
        }
        await rawRemove(LEGACY_KEY);
    } catch (e) {
        console.warn('[Storage] Legacy migration failed:', e);
    }
}

/**
 * Get state for a specific date (defaults to today).
 * Merges with default shape for forward-compat.
 */
export async function getState(dateKey = null) {
    await migrateLegacyIfNeeded();
    const d = dateKey || todayKey();
    try {
        const raw = await rawGet(keyFor(d));
        if (raw) {
            const parsed = JSON.parse(raw);
            const base = defaultState(d);
            const merged = {
                ...base,
                ...parsed,
                date: d,
                football10:  { ...base.football10,  ...(parsed.football10  || {}) },
                guessPlayer: { ...base.guessPlayer, ...(parsed.guessPlayer || {}) },
                whoAmI:      { ...base.whoAmI,      ...(parsed.whoAmI      || {}) },
                guessClub:   { ...base.guessClub,   ...(parsed.guessClub   || {}) }
            };
            // Legacy migration: old 'lives' → wrongGuesses
            if (typeof parsed.football10?.lives === 'number' &&
                typeof merged.football10.wrongGuesses !== 'number') {
                merged.football10.wrongGuesses = 3 - parsed.football10.lives;
            }
            return merged;
        }
    } catch (e) {
        console.warn('[Storage] getState error:', e);
    }
    return defaultState(d);
}

export async function saveState(state) {
    const d = state.date || todayKey();
    try {
        await rawSet(keyFor(d), JSON.stringify(state));
    } catch (e) {
        console.error('[Storage] saveState error:', e);
    }
}

/**
 * Update one game's state for a given date (defaults to today).
 */
export async function updateGameState(gameKey, patch, dateKey = null) {
    const d = dateKey || todayKey();
    const state = await getState(d);
    state[gameKey] = { ...state[gameKey], ...patch };
    await saveState(state);
    return state;
}

export function countPlayed(state) {
    return ['football10', 'guessPlayer', 'whoAmI', 'guessClub']
        .filter(k => state[k]?.played).length;
}

export function totalScore(state) {
    return (state.football10?.score  || 0)
         + (state.guessPlayer?.score || 0)
         + (state.whoAmI?.score      || 0)
         + (state.guessClub?.score   || 0);
}
