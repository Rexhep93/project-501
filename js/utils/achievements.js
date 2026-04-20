// Achievements — 11 badges tracked across all matchdays.
// Checked after each game finish. Unlocked achievements stored as
// { id: unlockTimestamp }.

import { toast } from './toast.js';
import { hapticSuccess } from './haptics.js';
import { getLifetimeStats } from './history.js';
import { countPlayed, totalScore } from './storage.js';

const STORAGE_KEY = 'voetbalquiz_achievements_v1';

/**
 * All achievement definitions.
 * Each `check` is called with context: { state, lifetimeStats }
 * and returns true if the achievement condition is met.
 */
export const ACHIEVEMENTS = [
    // ─── Streak ───
    {
        id: 'first_matchday',
        name: 'First Matchday',
        description: 'Play your first matchday',
        category: 'streak',
        check: (ctx) => ctx.lifetimeStats.days >= 1
    },
    {
        id: 'week_warrior',
        name: 'Week Warrior',
        description: '7-day streak',
        category: 'streak',
        check: (ctx) => ctx.lifetimeStats.streak >= 7
    },
    {
        id: 'month_master',
        name: 'Month Master',
        description: '30-day streak',
        category: 'streak',
        check: (ctx) => ctx.lifetimeStats.streak >= 30
    },

    // ─── Score ───
    {
        id: 'perfect_matchday',
        name: 'Perfect Matchday',
        description: 'Score 25/25 in one day',
        category: 'score',
        check: (ctx) => totalScore(ctx.state) === 25 && countPlayed(ctx.state) === 4
    },
    {
        id: 'high_scorer',
        name: 'High Scorer',
        description: 'Score 20+ in one day',
        category: 'score',
        check: (ctx) => totalScore(ctx.state) >= 20 && countPlayed(ctx.state) === 4
    },
    {
        id: 'tenable_ace',
        name: 'Tenable Ace',
        description: 'Get all 10 in Tenable',
        category: 'score',
        check: (ctx) => ctx.state.tenable?.played && ctx.state.tenable?.score === 10
    },

    // ─── Per-game firsts ───
    {
        id: 'pitch_perfect',
        name: 'Pitch Perfect',
        description: 'Guess the Club first try',
        category: 'game',
        check: (ctx) => ctx.state.guessClub?.played && ctx.state.guessClub?.score === 5
    },
    {
        id: 'mystery_solver',
        name: 'Mystery Solver',
        description: 'Who Am I first try',
        category: 'game',
        check: (ctx) => ctx.state.whoAmI?.played && ctx.state.whoAmI?.score === 5
    },
    {
        id: 'career_tracker',
        name: 'Career Tracker',
        description: 'Guess the Player first try',
        category: 'game',
        check: (ctx) => ctx.state.guessPlayer?.played && ctx.state.guessPlayer?.score === 5
    },

    // ─── Meta ───
    {
        id: 'ten_matchdays',
        name: 'Regular',
        description: 'Play 10 matchdays',
        category: 'meta',
        check: (ctx) => ctx.lifetimeStats.days >= 10
    },
    {
        id: 'fifty_matchdays',
        name: 'Devoted',
        description: 'Play 50 matchdays',
        category: 'meta',
        check: (ctx) => ctx.lifetimeStats.days >= 50
    }
];

/**
 * SVG icons per category. Minimalistic, single color.
 */
const ICONS = {
    streak: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M12 2s4 4 4 8a4 4 0 01-8 0c0-2 1-3 1-3s-1 5 3 5c3 0 3-3 3-5 0-3-3-5-3-5zM6 14c0 4 2.5 7 6 7s6-3 6-7"/></svg>',
    score:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><path d="M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z"/></svg>',
    game:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 2v20M2 12h20M5 5l14 14M19 5L5 19"/></svg>',
    meta:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="16" y1="3" x2="16" y2="7"/></svg>'
};

export function getIconForCategory(cat) {
    return ICONS[cat] || ICONS.meta;
}

function loadUnlocked() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        return {};
    }
}

function saveUnlocked(data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {}
}

/**
 * Returns map of {id: timestamp} for all unlocked achievements.
 */
export function getUnlocked() {
    return loadUnlocked();
}

export function isUnlocked(id) {
    const unlocked = loadUnlocked();
    return !!unlocked[id];
}

/**
 * Returns unlocked achievement IDs sorted by unlock timestamp descending.
 */
export function getRecentUnlocked(limit = 3) {
    const unlocked = loadUnlocked();
    return Object.entries(unlocked)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([id]) => id);
}

/**
 * Check all achievements against current state. Unlocks new ones and fires
 * toasts.
 *
 * @param {object} state - current matchday state
 * @returns {Promise<Array>} - array of newly-unlocked achievement defs
 */
export async function checkAchievements(state) {
    const unlocked = loadUnlocked();
    const lifetimeStats = await getLifetimeStats();
    const ctx = { state, lifetimeStats };
    const newlyUnlocked = [];

    for (const ach of ACHIEVEMENTS) {
        if (unlocked[ach.id]) continue;
        try {
            if (ach.check(ctx)) {
                unlocked[ach.id] = Date.now();
                newlyUnlocked.push(ach);
            }
        } catch (e) {
            console.warn('[Achievements] check failed for', ach.id, e);
        }
    }

    if (newlyUnlocked.length > 0) {
        saveUnlocked(unlocked);
        // Fire toast for each, staggered so user can read them
        newlyUnlocked.forEach((ach, i) => {
            setTimeout(() => {
                hapticSuccess();
                toast(`Achievement: ${ach.name}`, 'success');
            }, 300 + i * 1800);
        });
    }

    return newlyUnlocked;
}

/**
 * Find an achievement def by id.
 */
export function getAchievement(id) {
    return ACHIEVEMENTS.find(a => a.id === id);
}
