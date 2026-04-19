// Per-day score history for streak strip + lifetime stats

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
    const keys = Object.keys(history).sort().reverse().slice(0, MAX_DAYS);
    const trimmed = {};
    for (const k of keys) trimmed[k] = history[k];
    await rawSet(HISTORY_KEY, JSON.stringify(trimmed));
}

/**
 * Record a score for a specific date (defaults to today).
 * Keeps the HIGHER of existing and new — so time-travel can't overwrite a
 * better earlier score.
 */
export async function recordScore(totalScore, dateKey = null) {
    const d = dateKey || todayKey();
    const history = await loadHistory();
    const existing = history[d];
    if (typeof existing !== 'number' || totalScore > existing) {
        history[d] = totalScore;
        await saveHistory(history);
    }
}

// Back-compat alias
export async function recordToday(totalScore) {
    return recordScore(totalScore, todayKey());
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
 * Lifetime stats. Streak = consecutive days (ending today or yesterday) with
 * a recorded score. Oude dagen inhalen herstelt geen gebroken streak.
 */
export async function getLifetimeStats() {
    const history = await loadHistory();
    const entries = Object.entries(history)
        .filter(([, v]) => typeof v === 'number')
        .sort((a, b) => a[0].localeCompare(b[0]));

    if (entries.length === 0) {
        return { streak: 0, total: 0, best: 0, days: 0 };
    }

    const total = entries.reduce((sum, [, v]) => sum + v, 0);
    const best = entries.reduce((max, [, v]) => (v > max ? v : max), 0);
    const days = entries.length;

    const todayStr = todayKey();
    const yDate = new Date();
    yDate.setDate(yDate.getDate() - 1);
    const yesterdayStr = `${yDate.getFullYear()}-${String(yDate.getMonth() + 1).padStart(2, '0')}-${String(yDate.getDate()).padStart(2, '0')}`;

    let streak = 0;
    let cursor = null;
    if (history[todayStr] !== undefined) {
        cursor = new Date();
    } else if (history[yesterdayStr] !== undefined) {
        cursor = new Date();
        cursor.setDate(cursor.getDate() - 1);
    }

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
