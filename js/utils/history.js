// Per-day score history for streak strip (last 7 days)
// Stores a simple map: { "2026-04-15": 22, "2026-04-14": 18, ... }
// Updated when a full day is completed, but also on any game finish so partial progress shows

import { todayKey } from './date-key.js';

const HISTORY_KEY = 'voetbalquiz_history_v1';
const MAX_DAYS = 30;

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

async function loadHistory() {
    try {
        const raw = await rawGet(HISTORY_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        return {};
    }
}

async function saveHistory(history) {
    // Trim to last MAX_DAYS entries (prevent unbounded growth)
    const keys = Object.keys(history).sort().reverse().slice(0, MAX_DAYS);
    const trimmed = {};
    for (const k of keys) trimmed[k] = history[k];
    await rawSet(HISTORY_KEY, JSON.stringify(trimmed));
}

/**
 * Record today's current total in history.
 * Can be called repeatedly — always overwrites today's value.
 */
export async function recordToday(totalScore) {
    const history = await loadHistory();
    history[todayKey()] = totalScore;
    await saveHistory(history);
}

/**
 * Return an array of { date, dayNum, score, played, isToday } for the last 7 days,
 * oldest first. `played` is true if there's a history entry for that date.
 */
export async function getLast7Days() {
    const history = await loadHistory();
    const todayStr = todayKey();
    const out = [];
    const now = new Date();

    for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${day}`;
        const score = history[dateStr];

        out.push({
            date: dateStr,
            dayNum: d.getDate(),
            score: typeof score === 'number' ? score : null,
            played: typeof score === 'number',
            isToday: dateStr === todayStr
        });
    }
    return out;
}
