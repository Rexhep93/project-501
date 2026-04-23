// Per-day score history for streak strip + lifetime stats + achievements

import { todayKey } from './date-key.js';
import { kvGet as rawGet, kvSet as rawSet, kvKeys } from './kv-store.js';

const HISTORY_KEY = 'voetbalquiz_history_v1';
const MAX_DAYS = 365;
const STATE_PREFIX = 'voetbalquiz_daily_state_';

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

export async function recordScore(totalScore, dateKey = null) {
    const d = dateKey || todayKey();
    const history = await loadHistory();
    const existing = history[d];
    if (typeof existing !== 'number' || totalScore > existing) {
        history[d] = totalScore;
        await saveHistory(history);
    }
}

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

/**
 * Load all daily-state keys from storage and aggregate cross-day statistics.
 * Used for tiered and hidden achievements.
 */
export async function getAggregateStats() {
    const stats = {
        perfectMatchdays: 0,
        football10AllTen: 0,
        football10PerfectNoHints: 0,
        guessPlayerFirstTry: 0,
        whoAmIFirstTry: 0,
        guessClubFirstTry: 0,
        weekendStreak: 0,
        longestStreakEver: 0
    };

    const allKeys = await kvKeys();
    const stateKeys = allKeys.filter(k => k.startsWith(STATE_PREFIX));

    // Also track which dates were played for streak analysis
    const playedDates = new Set();

    for (const key of stateKeys) {
        const raw = await rawGet(key);
        if (!raw) continue;
        let s;
        try { s = JSON.parse(raw); } catch (e) { continue; }

        const dateStr = key.replace(STATE_PREFIX, '');
        const f10 = s.football10;
        const played =
            (f10?.played ? 1 : 0) +
            (s.guessPlayer?.played ? 1 : 0) +
            (s.whoAmI?.played ? 1 : 0) +
            (s.guessClub?.played ? 1 : 0);

        if (played > 0) playedDates.add(dateStr);

        const totalScore = (f10?.score || 0)
                         + (s.guessPlayer?.score || 0)
                         + (s.whoAmI?.score || 0)
                         + (s.guessClub?.score || 0);

        if (played === 4 && totalScore === 25) stats.perfectMatchdays++;

        if (f10?.played && f10?.score === 10) {
            stats.football10AllTen++;
            if (!f10.hintsUsed || f10.hintsUsed.length === 0) {
                stats.football10PerfectNoHints++;
            }
        }
        if (s.guessPlayer?.played && s.guessPlayer?.score === 5) stats.guessPlayerFirstTry++;
        if (s.whoAmI?.played && s.whoAmI?.score === 5) stats.whoAmIFirstTry++;
        if (s.guessClub?.played && s.guessClub?.score === 5) stats.guessClubFirstTry++;
    }

    // Longest streak ever: walk through sorted played dates
    if (playedDates.size > 0) {
        const sorted = [...playedDates].sort();
        let longest = 1;
        let current = 1;
        for (let i = 1; i < sorted.length; i++) {
            const prev = new Date(sorted[i - 1]);
            const curr = new Date(sorted[i]);
            const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
            if (diffDays === 1) {
                current++;
                longest = Math.max(longest, current);
            } else {
                current = 1;
            }
        }
        stats.longestStreakEver = longest;
    }

    // Weekend streak: count consecutive Sat+Sun pairs. "Consecutive" means
    // the Saturdays themselves are exactly 7 days apart — playing one weekend
    // and then one three weeks later must reset the run.
    if (playedDates.size > 0) {
        const sorted = [...playedDates].sort();
        let weekendPairs = 0;
        let currentRun = 0;
        let previousSat = null;
        const seenWeekends = new Set();
        for (const dateStr of sorted) {
            const d = new Date(dateStr);
            const dow = d.getDay(); // 0=Sun, 6=Sat
            if (dow !== 0 && dow !== 6) continue;

            // Determine weekend key (Saturday date)
            const satDate = new Date(d);
            if (dow === 0) satDate.setDate(satDate.getDate() - 1);
            const sy = satDate.getFullYear();
            const sm = String(satDate.getMonth() + 1).padStart(2, '0');
            const sd = String(satDate.getDate()).padStart(2, '0');
            const weekendKey = `${sy}-${sm}-${sd}`;

            if (seenWeekends.has(weekendKey)) continue;

            const satKey = weekendKey;
            const sunDate = new Date(satDate);
            sunDate.setDate(sunDate.getDate() + 1);
            const sunKey = `${sunDate.getFullYear()}-${String(sunDate.getMonth() + 1).padStart(2, '0')}-${String(sunDate.getDate()).padStart(2, '0')}`;

            if (playedDates.has(satKey) && playedDates.has(sunKey)) {
                seenWeekends.add(weekendKey);
                if (previousSat) {
                    const gap = Math.round((satDate - previousSat) / (1000 * 60 * 60 * 24));
                    if (gap === 7) currentRun++;
                    else currentRun = 1;
                } else {
                    currentRun = 1;
                }
                previousSat = satDate;
                weekendPairs = Math.max(weekendPairs, currentRun);
            }
        }
        stats.weekendStreak = weekendPairs;
    }

    return stats;
}
