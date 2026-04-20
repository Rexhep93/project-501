// Achievements — 11 football-themed badges.
// Each achievement has a specific football-themed icon (not a generic category icon).
// Flat editorial style: solid tint disc, white icon on top.

import { toast } from './toast.js';
import { hapticSuccess } from './haptics.js';
import { getLifetimeStats } from './history.js';
import { countPlayed, totalScore } from './storage.js';

const STORAGE_KEY = 'voetbalquiz_achievements_v1';

// ═══════════════════════════════════════════════════════════════
// FOOTBALL ICONS — flat, stroke-based, editorial. No gradients.
// Designed at 24x24 viewBox, white stroke on colored disc.
// ═══════════════════════════════════════════════════════════════

const ICON = {
    // Classic pennant flag (like on a corner flag)
    flag: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 21V4"/><path d="M6 4h10l-2 4 2 4H6"/></svg>`,
    // Calendar with 7 prominent
    calendar7: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="1.5"/><path d="M3 10h18"/><path d="M8 3v4M16 3v4"/><path d="M8.5 16.5h3M12 14v5M13 14l-1.5 2.5"/></svg>`,
    // Calendar with 30 days grid
    calendar30: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="1.5"/><path d="M3 10h18"/><path d="M8 3v4M16 3v4"/><circle cx="8" cy="14" r="0.8" fill="currentColor"/><circle cx="12" cy="14" r="0.8" fill="currentColor"/><circle cx="16" cy="14" r="0.8" fill="currentColor"/><circle cx="8" cy="17.5" r="0.8" fill="currentColor"/><circle cx="12" cy="17.5" r="0.8" fill="currentColor"/><circle cx="16" cy="17.5" r="0.8" fill="currentColor"/></svg>`,
    // Trophy — solid handles
    trophy: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 4h8v6a4 4 0 01-8 0V4z"/><path d="M8 6H5a2 2 0 002 4"/><path d="M16 6h3a2 2 0 01-2 4"/><path d="M10 14v3h4v-3"/><path d="M8 20h8"/><path d="M12 17v3"/></svg>`,
    // Star (for high score)
    starFilled: `<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M12 3l2.6 5.8 6.4.7-4.8 4.4 1.3 6.3L12 17l-5.5 3.2 1.3-6.3L3 9.5l6.4-.7L12 3z"/></svg>`,
    // Football (soccer ball) — classic pentagon pattern
    football: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 5l3.5 2.5-1.3 4.2h-4.4L8.5 7.5 12 5z" fill="currentColor" stroke="none"/><path d="M12 12l4 3M12 12l-4 3M12 12v-3"/></svg>`,
    // Football pitch with center circle
    pitch: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"><rect x="3" y="5" width="18" height="14" rx="1"/><path d="M12 5v14"/><circle cx="12" cy="12" r="2.5"/><path d="M3 9h2v6H3M21 9h-2v6h2"/></svg>`,
    // Magnifying glass (mystery/who am i)
    magnify: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/><path d="M9 10.5h3M10.5 9v3" stroke-width="1.6"/></svg>`,
    // Boot (football boot for career)
    boot: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16v-5l3-1 2-3h6l4 5v4a2 2 0 01-2 2H6a2 2 0 01-2-2z"/><path d="M8 18v1M11 18v1M14 18v1M17 18v1"/></svg>`,
    // Captain armband / medal
    medal: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3l2 5M16 3l-2 5"/><circle cx="12" cy="14" r="6"/><path d="M12 11v6M9 14h6" stroke-width="1.6"/></svg>`,
    // Stopwatch (for 50 matchdays — dedication)
    stopwatch: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="14" r="7"/><path d="M12 14V9"/><path d="M10 3h4M12 3v4"/><path d="M18.5 7.5l1.5-1.5"/></svg>`,
};

/**
 * All achievement definitions. Each has its OWN icon + its OWN color from the
 * app's existing palette (not generic category colors).
 */
export const ACHIEVEMENTS = [
    // ─── Streak ───
    {
        id: 'first_matchday',
        name: 'Kick-off',
        description: 'Play your first matchday',
        category: 'streak',
        icon: ICON.flag,
        color: 'var(--player)',
        check: (ctx) => ctx.lifetimeStats.days >= 1
    },
    {
        id: 'week_warrior',
        name: 'Full Week',
        description: '7-day streak',
        category: 'streak',
        icon: ICON.calendar7,
        color: 'var(--player)',
        check: (ctx) => ctx.lifetimeStats.streak >= 7
    },
    {
        id: 'month_master',
        name: 'Season Regular',
        description: '30-day streak',
        category: 'streak',
        icon: ICON.calendar30,
        color: 'var(--player-dark)',
        check: (ctx) => ctx.lifetimeStats.streak >= 30
    },

    // ─── Score ───
    {
        id: 'perfect_matchday',
        name: 'Clean Sheet',
        description: 'Score a perfect 25 / 25',
        category: 'score',
        icon: ICON.trophy,
        color: 'var(--accent)',
        check: (ctx) => totalScore(ctx.state) === 25 && countPlayed(ctx.state) === 4
    },
    {
        id: 'high_scorer',
        name: 'Top of the Table',
        description: 'Score 20 or more in a day',
        category: 'score',
        icon: ICON.starFilled,
        color: 'var(--warn)',
        check: (ctx) => totalScore(ctx.state) >= 20 && countPlayed(ctx.state) === 4
    },
    {
        id: 'tenable_ace',
        name: 'All Ten',
        description: 'Name all 10 in Tenable',
        category: 'score',
        icon: ICON.football,
        color: 'var(--tenable)',
        check: (ctx) => ctx.state.tenable?.played && ctx.state.tenable?.score === 10
    },

    // ─── Per-game firsts ───
    {
        id: 'pitch_perfect',
        name: 'Read the Pitch',
        description: 'Guess the Club first try',
        category: 'game',
        icon: ICON.pitch,
        color: 'var(--club)',
        check: (ctx) => ctx.state.guessClub?.played && ctx.state.guessClub?.score === 5
    },
    {
        id: 'mystery_solver',
        name: 'Detective',
        description: 'Who Am I first try',
        category: 'game',
        icon: ICON.magnify,
        color: 'var(--whoami)',
        check: (ctx) => ctx.state.whoAmI?.played && ctx.state.whoAmI?.score === 5
    },
    {
        id: 'career_tracker',
        name: 'Scout',
        description: 'Guess the Player first try',
        category: 'game',
        icon: ICON.boot,
        color: 'var(--player)',
        check: (ctx) => ctx.state.guessPlayer?.played && ctx.state.guessPlayer?.score === 5
    },

    // ─── Meta ───
    {
        id: 'ten_matchdays',
        name: 'Regular',
        description: 'Play 10 matchdays',
        category: 'meta',
        icon: ICON.medal,
        color: 'var(--ink)',
        check: (ctx) => ctx.lifetimeStats.days >= 10
    },
    {
        id: 'fifty_matchdays',
        name: 'Veteran',
        description: 'Play 50 matchdays',
        category: 'meta',
        icon: ICON.stopwatch,
        color: 'var(--ink)',
        check: (ctx) => ctx.lifetimeStats.days >= 50
    }
];

export function getIcon(ach) {
    return ach.icon || ICON.trophy;
}

export function getColor(ach) {
    return ach.color || 'var(--ink)';
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

export function getUnlocked() {
    return loadUnlocked();
}

export function isUnlocked(id) {
    return !!loadUnlocked()[id];
}

export function getRecentUnlocked(limit = 3) {
    const unlocked = loadUnlocked();
    return Object.entries(unlocked)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([id]) => id);
}

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
        newlyUnlocked.forEach((ach, i) => {
            setTimeout(() => {
                hapticSuccess();
                toast(`Unlocked · ${ach.name}`, 'success');
            }, 300 + i * 1800);
        });
    }

    return newlyUnlocked;
}

export function getAchievement(id) {
    return ACHIEVEMENTS.find(a => a.id === id);
}
