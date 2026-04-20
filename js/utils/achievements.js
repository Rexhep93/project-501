// Achievements — 11 football-themed badges in mini-tile style matching
// the main game tiles.

import { toast } from './toast.js';
import { hapticSuccess } from './haptics.js';
import { getLifetimeStats } from './history.js';
import { countPlayed, totalScore } from './storage.js';

const STORAGE_KEY = 'voetbalquiz_achievements_v1';

// ═══════════════════════════════════════════════════════════════
// Large expressive SVG art — drawn at 100x100, serves as
// decorative tile-art. Same style as the game tile art (bold,
// simple, silhouette-friendly).
// ═══════════════════════════════════════════════════════════════

const ART = {
    // Pennant corner flag
    flag: `<svg viewBox="0 0 100 100"><g fill="currentColor"><rect x="22" y="12" width="7" height="78" rx="2"/><path d="M29 14 L78 14 L66 34 L78 54 L29 54 Z"/></g></svg>`,

    // Calendar — 7 days
    calendar7: `<svg viewBox="0 0 100 100"><g fill="currentColor"><rect x="12" y="22" width="76" height="68" rx="6"/></g><g fill="#F5F1E8" opacity="0.92"><rect x="18" y="38" width="64" height="48" rx="3"/></g><g fill="currentColor"><rect x="22" y="14" width="8" height="20" rx="2"/><rect x="70" y="14" width="8" height="20" rx="2"/></g><text x="50" y="76" text-anchor="middle" font-family="'New York', ui-serif, Georgia, serif" font-weight="800" font-size="36" fill="currentColor">7</text></svg>`,

    // Calendar — 30 days
    calendar30: `<svg viewBox="0 0 100 100"><g fill="currentColor"><rect x="12" y="22" width="76" height="68" rx="6"/></g><g fill="#F5F1E8" opacity="0.92"><rect x="18" y="38" width="64" height="48" rx="3"/></g><g fill="currentColor"><rect x="22" y="14" width="8" height="20" rx="2"/><rect x="70" y="14" width="8" height="20" rx="2"/></g><text x="50" y="76" text-anchor="middle" font-family="'New York', ui-serif, Georgia, serif" font-weight="800" font-size="30" fill="currentColor">30</text></svg>`,

    // Trophy — bold silhouette
    trophy: `<svg viewBox="0 0 100 100"><g fill="currentColor"><path d="M30 14 L70 14 L70 40 Q70 58 50 58 Q30 58 30 40 Z"/><path d="M30 22 L18 22 Q14 22 14 28 Q14 42 30 44 Z"/><path d="M70 22 L82 22 Q86 22 86 28 Q86 42 70 44 Z"/><rect x="42" y="58" width="16" height="12"/><rect x="30" y="70" width="40" height="8" rx="2"/><rect x="34" y="78" width="32" height="10" rx="2"/></g></svg>`,

    // Star — solid
    star: `<svg viewBox="0 0 100 100"><path d="M50 10 L61 39 L92 41 L67 60 L76 90 L50 73 L24 90 L33 60 L8 41 L39 39 Z" fill="currentColor"/></svg>`,

    // Football with classic pentagon pattern
    football: `<svg viewBox="0 0 100 100"><rect x="0" y="90" width="100" height="5" fill="currentColor"/><rect x="4" y="83" width="92" height="5" fill="#F5F1E8" opacity="0.92"/><rect x="8" y="76" width="84" height="5" fill="currentColor"/><rect x="12" y="69" width="76" height="5" fill="#F5F1E8" opacity="0.92"/><rect x="16" y="62" width="68" height="5" fill="currentColor"/><rect x="20" y="55" width="60" height="5" fill="#F5F1E8" opacity="0.92"/><rect x="24" y="48" width="52" height="5" fill="currentColor"/><rect x="28" y="41" width="44" height="5" fill="#F5F1E8" opacity="0.92"/><rect x="32" y="34" width="36" height="5" fill="currentColor"/><rect x="36" y="27" width="28" height="5" fill="#F5F1E8" opacity="0.92"/></svg>`,

    // Football pitch with halfway line and circle
    pitch: `<svg viewBox="0 0 100 100"><g fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"><rect x="12" y="14" width="76" height="72" rx="2"/><line x1="12" y1="50" x2="88" y2="50"/><circle cx="50" cy="50" r="11"/><rect x="32" y="14" width="36" height="14"/><rect x="32" y="72" width="36" height="14"/></g><circle cx="50" cy="50" r="2.5" fill="currentColor"/></svg>`,

    // Magnifying glass with question mark
    magnify: `<svg viewBox="0 0 100 100"><g fill="currentColor"><circle cx="42" cy="42" r="24"/><rect x="60" y="60" width="28" height="10" rx="3" transform="rotate(45 74 65)"/></g><g fill="#F5F1E8" opacity="0.92"><circle cx="42" cy="42" r="17"/></g><text x="42" y="50" text-anchor="middle" font-family="'New York', ui-serif, Georgia, serif" font-weight="800" font-size="24" fill="currentColor">?</text></svg>`,

    // Football boot — sharp silhouette
    boot: `<svg viewBox="0 0 100 100"><g fill="currentColor"><path d="M18 60 Q18 48 28 46 L42 42 Q48 40 52 36 L62 24 Q66 20 72 22 L82 28 Q88 32 88 40 L88 62 Q88 70 80 70 L26 70 Q18 70 18 62 Z"/></g><g fill="#F5F1E8" opacity="0.55"><circle cx="32" cy="76" r="2.5"/><circle cx="44" cy="76" r="2.5"/><circle cx="56" cy="76" r="2.5"/><circle cx="68" cy="76" r="2.5"/><circle cx="80" cy="76" r="2.5"/></g></svg>`,

    // Medal with ribbon
    medal: `<svg viewBox="0 0 100 100"><g fill="currentColor"><path d="M32 10 L44 42 L56 42 L68 10 L58 10 L50 30 L42 10 Z"/><circle cx="50" cy="62" r="26"/></g><g fill="#F5F1E8" opacity="0.92"><circle cx="50" cy="62" r="18"/></g><text x="50" y="70" text-anchor="middle" font-family="'New York', ui-serif, Georgia, serif" font-weight="800" font-size="22" fill="currentColor">1</text></svg>`,

    // Stopwatch
    stopwatch: `<svg viewBox="0 0 100 100"><g fill="currentColor"><rect x="40" y="8" width="20" height="10" rx="2"/><rect x="46" y="12" width="8" height="8"/><circle cx="50" cy="58" r="32"/></g><g fill="#F5F1E8" opacity="0.92"><circle cx="50" cy="58" r="24"/></g><g fill="currentColor"><rect x="48" y="38" width="4" height="22" rx="1"/><rect x="48" y="56" width="22" height="4" rx="1" transform="rotate(30 50 58)"/><circle cx="50" cy="58" r="3"/></g></svg>`,
};

/**
 * All achievements. Each has a number, football-themed name, big art,
 * and uses a color from the existing app palette with matching shadow.
 */
export const ACHIEVEMENTS = [
    // ─── Streak ───
    {
        id: 'first_matchday',
        num: 1,
        name: 'Kick-off',
        description: 'Play your first matchday',
        category: 'streak',
        art: ART.flag,
        color: 'var(--player)',
        shadow: 'var(--player-dark)',
        check: (ctx) => ctx.lifetimeStats.days >= 1
    },
    {
        id: 'week_warrior',
        num: 2,
        name: 'Full Week',
        description: '7-day streak',
        category: 'streak',
        art: ART.calendar7,
        color: 'var(--player)',
        shadow: 'var(--player-dark)',
        check: (ctx) => ctx.lifetimeStats.streak >= 7
    },
    {
        id: 'month_master',
        num: 3,
        name: 'Season Regular',
        description: '30-day streak',
        category: 'streak',
        art: ART.calendar30,
        color: 'var(--player-dark)',
        shadow: '#0F3E22',
        check: (ctx) => ctx.lifetimeStats.streak >= 30
    },

    // ─── Score ───
    {
        id: 'perfect_matchday',
        num: 4,
        name: 'Clean Sheet',
        description: 'Score a perfect 25 / 25',
        category: 'score',
        art: ART.trophy,
        color: 'var(--accent)',
        shadow: 'var(--accent-dark)',
        check: (ctx) => totalScore(ctx.state) === 25 && countPlayed(ctx.state) === 4
    },
    {
        id: 'high_scorer',
        num: 5,
        name: 'Top of the Table',
        description: 'Score 20 or more in a day',
        category: 'score',
        art: ART.star,
        color: 'var(--warn)',
        shadow: '#9E681F',
        check: (ctx) => totalScore(ctx.state) >= 20 && countPlayed(ctx.state) === 4
    },
    {
        id: 'tenable_ace',
        num: 6,
        name: 'All Ten',
        description: 'Name all 10 in Tenable',
        category: 'score',
        art: ART.football,
        color: 'var(--tenable)',
        shadow: 'var(--tenable-dark)',
        check: (ctx) => ctx.state.tenable?.played && ctx.state.tenable?.score === 10
    },

    // ─── Per-game firsts ───
    {
        id: 'pitch_perfect',
        num: 7,
        name: 'Read the Pitch',
        description: 'Guess the Club first try',
        category: 'game',
        art: ART.pitch,
        color: 'var(--club)',
        shadow: 'var(--club-dark)',
        check: (ctx) => ctx.state.guessClub?.played && ctx.state.guessClub?.score === 5
    },
    {
        id: 'mystery_solver',
        num: 8,
        name: 'Detective',
        description: 'Who Am I first try',
        category: 'game',
        art: ART.magnify,
        color: 'var(--whoami)',
        shadow: 'var(--whoami-dark)',
        check: (ctx) => ctx.state.whoAmI?.played && ctx.state.whoAmI?.score === 5
    },
    {
        id: 'career_tracker',
        num: 9,
        name: 'Scout',
        description: 'Guess the Player first try',
        category: 'game',
        art: ART.boot,
        color: 'var(--player)',
        shadow: 'var(--player-dark)',
        check: (ctx) => ctx.state.guessPlayer?.played && ctx.state.guessPlayer?.score === 5
    },

    // ─── Meta ───
    {
        id: 'ten_matchdays',
        num: 10,
        name: 'Regular',
        description: 'Play 10 matchdays',
        category: 'meta',
        art: ART.medal,
        color: 'var(--ink)',
        shadow: 'var(--ink-shadow)',
        check: (ctx) => ctx.lifetimeStats.days >= 10
    },
    {
        id: 'fifty_matchdays',
        num: 11,
        name: 'Veteran',
        description: 'Play 50 matchdays',
        category: 'meta',
        art: ART.stopwatch,
        color: 'var(--ink)',
        shadow: 'var(--ink-shadow)',
        check: (ctx) => ctx.lifetimeStats.days >= 50
    }
];

export function formatNum(n) {
    return `№ ${String(n).padStart(2, '0')}`;
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
