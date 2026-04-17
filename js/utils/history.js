// Per-day score history for streak strip (last 7 days)
// Stores a simple map: { "2026-04-15": 22, "2026-04-14": 18, ... }

import { todayKey } from './date-key.js';

const HISTORY_KEY = 'voetbalquiz_history_v1';
const MAX_DAYS = 365;

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
    // Keep last MAX_DAYS — enough for all lifetime stats + 7-day strip
    const keys = Object.keys(history).sort().reverse().slice(0, MAX_DAYS);
    const trimmed = {};
    for (const k of keys) trimmed[k] = history[k];
    await rawSet(HISTORY_KEY, JSON.stringify(trimmed));
}

export async function recordToday(totalScore) {
    const history = await loadHistory();
    history[todayKey()] = totalScore;
    await saveHistory(history);
}

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

/**
 * Lifetime stats from history:
 * - streak: consecutive days played ending today or yesterday
 * - total: sum of all daily scores
 * - best: highest single-day score
 * - days: number of days played (any score recorded)
 */
export async function getLifetimeStats() {
    const history = await loadHistory();
    const entries = Object.entries(history)
        .filter(([, v]) => typeof v === 'number')
        .sort((a, b) => a[0].localeCompare(b[0])); // oldest → newest

    if (entries.length === 0) {
        return { streak: 0, total: 0, best: 0, days: 0 };
    }

    const total = entries.reduce((sum, [, v]) => sum + v, 0);
    const best = entries.reduce((max, [, v]) => (v > max ? v : max), 0);
    const days = entries.length;

    // Streak calculation: count back from today (or yesterday if today not played)
    const todayStr = todayKey();
    const yesterdayStr = (() => {
        const d = new Date();
        d.setDate(d.getDate() - 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    })();

    let streak = 0;
    let cursor = history[todayStr] !== undefined ? new Date() : (history[yesterdayStr] !== undefined ? (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d; })() : null);

    if (cursor) {
        while (true) {
            const y = cursor.getFullYear();
            const m = String(cursor.getMonth() + 1).padStart(2, '0');
            const d = String(cursor.getDate()).padStart(2, '0');
            const key = `${y}-${m}-${d}`;
            if (history[key] !== undefined) {
                streak++;
                cursor.setDate(cursor.getDate() - 1);
            } else {
                break;
            }
        }
    }

    return { streak, total, best, days };
}
