// Storage abstractie: Capacitor Preferences indien beschikbaar, anders localStorage
// Zodat we op iOS native opslag gebruiken en op web de fallback

import { todayKey } from './date-key.js';

const STORAGE_KEY = 'voetbalquiz_daily_state';

// Detect Capacitor Preferences plugin (beschikbaar na cap sync)
let prefs = null;
try {
    if (window.Capacitor?.Plugins?.Preferences) {
        prefs = window.Capacitor.Plugins.Preferences;
    }
} catch (e) { /* ignore */ }

async function rawGet(key) {
    if (prefs) {
        const { value } = await prefs.get({ key });
        return value;
    }
    return localStorage.getItem(key);
}

async function rawSet(key, value) {
    if (prefs) {
        await prefs.set({ key, value });
    } else {
        localStorage.setItem(key, value);
    }
}

/**
 * Default state shape voor een dag.
 * Tenable: lives is afgeleid uit history — no stored duplicate.
 * WhoAmI: revealedHints tracks progressive hint reveal (1..3).
 */
function defaultState() {
    return {
        date: todayKey(),
        tenable:     { played: false, score: 0, revealedRanks: [], history: [], wrongGuesses: 0 },
        guessPlayer: { played: false, score: 0, attempts: 0, revealedClubs: 1, solved: false },
        whoAmI:      { played: false, score: 0, attempts: 0, revealedHints: 1, solved: false },
        guessClub:   { played: false, score: 0, attempts: 0, solved: false }
    };
}

/**
 * Haal state op voor vandaag. Reset als datum is gewisseld.
 */
export async function getState() {
    try {
        const raw = await rawGet(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed.date === todayKey()) {
                // Merge met default voor forward-compat als we velden toevoegen
                const base = defaultState();
                const merged = {
                    ...base,
                    ...parsed,
                    tenable:     { ...base.tenable,     ...(parsed.tenable     || {}) },
                    guessPlayer: { ...base.guessPlayer, ...(parsed.guessPlayer || {}) },
                    whoAmI:      { ...base.whoAmI,      ...(parsed.whoAmI      || {}) },
                    guessClub:   { ...base.guessClub,   ...(parsed.guessClub   || {}) }
                };
                // Migration: convert old 'lives' field into 'wrongGuesses' (derived).
                // If old save had lives:2, that means 1 wrong guess.
                if (typeof parsed.tenable?.lives === 'number' &&
                    typeof merged.tenable.wrongGuesses !== 'number') {
                    merged.tenable.wrongGuesses = 3 - parsed.tenable.lives;
                }
                return merged;
            }
        }
    } catch (e) {
        console.warn('[Storage] getState fout:', e);
    }
    return defaultState();
}

/**
 * Sla state op
 */
export async function saveState(state) {
    try {
        await rawSet(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        console.error('[Storage] saveState fout:', e);
    }
}

/**
 * Update één spel's state en sla direct op
 */
export async function updateGameState(gameKey, patch) {
    const state = await getState();
    state[gameKey] = { ...state[gameKey], ...patch };
    await saveState(state);
    return state;
}

/**
 * Hoeveel spellen heeft de gebruiker al gespeeld vandaag?
 */
export function countPlayed(state) {
    return ['tenable', 'guessPlayer', 'whoAmI', 'guessClub']
        .filter(k => state[k]?.played).length;
}

/**
 * Totaalscore over alle 4
 */
export function totalScore(state) {
    return (state.tenable?.score     || 0)
         + (state.guessPlayer?.score || 0)
         + (state.whoAmI?.score      || 0)
         + (state.guessClub?.score   || 0);
}
