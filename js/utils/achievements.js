// Achievements v2 — 33 football-themed badges, tiered + hidden
// Categories: streak, score, game, mastery, hidden
// Tiered achievements unlock in sequence and use the same icon with different tints.

import { toast } from './toast.js';
import { hapticSuccess } from './haptics.js';
import { getLifetimeStats, getAggregateStats } from './history.js';
import { countPlayed, totalScore } from './storage.js';

const STORAGE_KEY = 'voetbalquiz_achievements_v1';

// ═══════════════════════════════════════════════════════════════
// Expressive SVG art — drawn at 100x100. Silhouette style.
// ═══════════════════════════════════════════════════════════════

const ART = {
    flag: `<svg viewBox="0 0 100 100"><g fill="currentColor"><rect x="22" y="12" width="7" height="78" rx="2"/><path d="M29 14 L78 14 L66 34 L78 54 L29 54 Z"/></g></svg>`,

    calendar: (label, fontSize) => `<svg viewBox="0 0 100 100"><g fill="currentColor"><rect x="12" y="22" width="76" height="68" rx="6"/></g><g fill="#F5F1E8" opacity="0.92"><rect x="18" y="38" width="64" height="48" rx="3"/></g><g fill="currentColor"><rect x="22" y="14" width="8" height="20" rx="2"/><rect x="70" y="14" width="8" height="20" rx="2"/></g><text x="50" y="76" text-anchor="middle" font-family="'New York', ui-serif, Georgia, serif" font-weight="800" font-size="${fontSize}" fill="currentColor">${label}</text></svg>`,

    trophy: `<svg viewBox="0 0 100 100"><g fill="currentColor"><path d="M30 14 L70 14 L70 40 Q70 58 50 58 Q30 58 30 40 Z"/><path d="M30 22 L18 22 Q14 22 14 28 Q14 42 30 44 Z"/><path d="M70 22 L82 22 Q86 22 86 28 Q86 42 70 44 Z"/><rect x="42" y="58" width="16" height="12"/><rect x="30" y="70" width="40" height="8" rx="2"/><rect x="34" y="78" width="32" height="10" rx="2"/></g></svg>`,

    star: `<svg viewBox="0 0 100 100"><path d="M50 10 L61 39 L92 41 L67 60 L76 90 L50 73 L24 90 L33 60 L8 41 L39 39 Z" fill="currentColor"/></svg>`,

    football: `<svg viewBox="0 0 100 100"><rect x="0" y="90" width="100" height="5" fill="currentColor"/><rect x="4" y="83" width="92" height="5" fill="#F5F1E8" opacity="0.92"/><rect x="8" y="76" width="84" height="5" fill="currentColor"/><rect x="12" y="69" width="76" height="5" fill="#F5F1E8" opacity="0.92"/><rect x="16" y="62" width="68" height="5" fill="currentColor"/><rect x="20" y="55" width="60" height="5" fill="#F5F1E8" opacity="0.92"/><rect x="24" y="48" width="52" height="5" fill="currentColor"/><rect x="28" y="41" width="44" height="5" fill="#F5F1E8" opacity="0.92"/><rect x="32" y="34" width="36" height="5" fill="currentColor"/><rect x="36" y="27" width="28" height="5" fill="#F5F1E8" opacity="0.92"/></svg>`,

    pitch: `<svg viewBox="0 0 100 100"><g fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round"><rect x="12" y="14" width="76" height="72" rx="2"/><line x1="12" y1="50" x2="88" y2="50"/><circle cx="50" cy="50" r="11"/><rect x="32" y="14" width="36" height="14"/><rect x="32" y="72" width="36" height="14"/></g><circle cx="50" cy="50" r="2.5" fill="currentColor"/></svg>`,

    magnify: `<svg viewBox="0 0 100 100"><g fill="currentColor"><circle cx="42" cy="42" r="24"/><rect x="60" y="60" width="28" height="10" rx="3" transform="rotate(45 74 65)"/></g><g fill="#F5F1E8" opacity="0.92"><circle cx="42" cy="42" r="17"/></g><text x="42" y="50" text-anchor="middle" font-family="'New York', ui-serif, Georgia, serif" font-weight="800" font-size="24" fill="currentColor">?</text></svg>`,

    boot: `<svg viewBox="0 0 100 100"><g fill="currentColor"><path d="M18 60 Q18 48 28 46 L42 42 Q48 40 52 36 L62 24 Q66 20 72 22 L82 28 Q88 32 88 40 L88 62 Q88 70 80 70 L26 70 Q18 70 18 62 Z"/></g><g fill="#F5F1E8" opacity="0.55"><circle cx="32" cy="76" r="2.5"/><circle cx="44" cy="76" r="2.5"/><circle cx="56" cy="76" r="2.5"/><circle cx="68" cy="76" r="2.5"/><circle cx="80" cy="76" r="2.5"/></g></svg>`,

    medal: `<svg viewBox="0 0 100 100"><g fill="currentColor"><path d="M32 10 L44 42 L56 42 L68 10 L58 10 L50 30 L42 10 Z"/><circle cx="50" cy="62" r="26"/></g><g fill="#F5F1E8" opacity="0.92"><circle cx="50" cy="62" r="18"/></g><text x="50" y="70" text-anchor="middle" font-family="'New York', ui-serif, Georgia, serif" font-weight="800" font-size="22" fill="currentColor">1</text></svg>`,

    stopwatch: `<svg viewBox="0 0 100 100"><g fill="currentColor"><rect x="40" y="8" width="20" height="10" rx="2"/><rect x="46" y="12" width="8" height="8"/><circle cx="50" cy="58" r="32"/></g><g fill="#F5F1E8" opacity="0.92"><circle cx="50" cy="58" r="24"/></g><g fill="currentColor"><rect x="48" y="38" width="4" height="22" rx="1"/><rect x="48" y="56" width="22" height="4" rx="1" transform="rotate(30 50 58)"/><circle cx="50" cy="58" r="3"/></g></svg>`,

    // Chart bar — for cumulative scores
    chart: `<svg viewBox="0 0 100 100"><g fill="currentColor"><rect x="16" y="60" width="14" height="30" rx="2"/><rect x="36" y="45" width="14" height="45" rx="2"/><rect x="56" y="30" width="14" height="60" rx="2"/><rect x="76" y="15" width="14" height="75" rx="2"/></g></svg>`,

    // Sun — early bird
    sunrise: `<svg viewBox="0 0 100 100"><g fill="currentColor"><circle cx="50" cy="55" r="16"/><rect x="47" y="20" width="6" height="14" rx="2"/><rect x="47" y="78" width="6" height="14" rx="2"/><rect x="14" y="52" width="14" height="6" rx="2"/><rect x="72" y="52" width="14" height="6" rx="2"/><rect x="24" y="26" width="14" height="6" rx="2" transform="rotate(-45 31 29)"/><rect x="62" y="26" width="14" height="6" rx="2" transform="rotate(45 69 29)"/><rect x="24" y="78" width="14" height="6" rx="2" transform="rotate(45 31 81)"/><rect x="62" y="78" width="14" height="6" rx="2" transform="rotate(-45 69 81)"/></g></svg>`,

    // Moon — night owl
    moon: `<svg viewBox="0 0 100 100"><path d="M68 50 Q68 32 50 24 Q76 22 88 48 Q92 78 62 86 Q36 90 22 64 Q38 80 54 76 Q70 70 68 50 Z" fill="currentColor"/></svg>`,

    // Lightning — speedrun
    bolt: `<svg viewBox="0 0 100 100"><path d="M55 8 L22 58 L44 58 L40 92 L78 38 L54 38 Z" fill="currentColor"/></svg>`,

    // Crossed bat-like for no-hints purist
    shield: `<svg viewBox="0 0 100 100"><g fill="currentColor"><path d="M50 8 L18 18 L18 52 Q18 78 50 92 Q82 78 82 52 L82 18 Z"/></g><g fill="#F5F1E8" opacity="0.92"><path d="M50 20 L30 26 L30 52 Q30 72 50 82 Q70 72 70 52 L70 26 Z"/></g><text x="50" y="62" text-anchor="middle" font-family="'New York', ui-serif, Georgia, serif" font-weight="800" font-size="28" fill="currentColor">!</text></svg>`,

    // Whistle — referee/weekend warrior
    whistle: `<svg viewBox="0 0 100 100"><g fill="currentColor"><path d="M20 44 Q20 30 34 30 L66 30 L82 46 Q82 70 60 70 L34 70 Q20 70 20 56 Z"/><rect x="48" y="14" width="6" height="20" rx="2"/></g><g fill="#F5F1E8" opacity="0.92"><circle cx="40" cy="50" r="7"/></g></svg>`,
};

// Palette
const C_PLAYER = 'var(--player)', C_PLAYER_D = 'var(--player-dark)';
const C_TEN = 'var(--tenable)', C_TEN_D = 'var(--tenable-dark)';
const C_CLUB = 'var(--club)', C_CLUB_D = 'var(--club-dark)';
const C_WHOAMI = 'var(--whoami)', C_WHOAMI_D = 'var(--whoami-dark)';
const C_ACCENT = 'var(--accent)', C_ACCENT_D = 'var(--accent-dark)';
const C_WARN = 'var(--warn)', C_WARN_D = '#9E681F';
const C_INK = 'var(--ink)', C_INK_D = 'var(--ink-shadow)';
const C_GOLD = '#C89D3D', C_GOLD_D = '#8E6E22';  // for ultra-rare tiers

// Helpers
let num = 0;
const N = () => ++num;

/**
 * Tier factory: generates a sequence of tiered achievements sharing the same
 * theme/icon but different thresholds and colors. Colors progress from muted
 * to accent to gold for ultra-rare tiers.
 */
function tierColors(i, total) {
    // i = 0..total-1
    // Progress: early tiers use neutral ink, middle uses theme, late uses gold
    if (i === total - 1) return [C_GOLD, C_GOLD_D];            // ultra-rare
    if (i >= total - 2)  return [C_ACCENT, C_ACCENT_D];        // rare
    return [C_INK, C_INK_D];                                    // common
}

// ═══════════════════════════════════════════════════════════════
// ALL ACHIEVEMENTS
// ═══════════════════════════════════════════════════════════════

export const ACHIEVEMENTS = [
    // ─────────────── Streak ───────────────
    {
        id: 'first_matchday', num: N(),
        name: 'Kick-off', description: 'Play your first matchday',
        category: 'streak', art: ART.flag, color: C_PLAYER, shadow: C_PLAYER_D,
        check: (ctx) => ctx.lifetimeStats.days >= 1
    },
    {
        id: 'streak_7', num: N(),
        name: 'Full Week', description: '7-day streak',
        category: 'streak', art: ART.calendar('7', 36), color: C_PLAYER, shadow: C_PLAYER_D,
        check: (ctx) => ctx.lifetimeStats.streak >= 7
    },
    {
        id: 'streak_30', num: N(),
        name: 'Season Regular', description: '30-day streak',
        category: 'streak', art: ART.calendar('30', 30), color: C_PLAYER_D, shadow: '#0F3E22',
        check: (ctx) => ctx.lifetimeStats.streak >= 30
    },
    {
        id: 'streak_60', num: N(),
        name: 'Half-Season', description: '60-day streak',
        category: 'streak', art: ART.calendar('60', 30), color: C_INK, shadow: C_INK_D,
        check: (ctx) => ctx.lifetimeStats.streak >= 60
    },
    {
        id: 'streak_100', num: N(),
        name: 'Century', description: '100-day streak',
        category: 'streak', art: ART.calendar('100', 22), color: C_ACCENT, shadow: C_ACCENT_D,
        check: (ctx) => ctx.lifetimeStats.streak >= 100
    },
    {
        id: 'streak_365', num: N(),
        name: 'Full Season', description: '365-day streak',
        category: 'streak', art: ART.calendar('365', 22), color: C_GOLD, shadow: C_GOLD_D,
        check: (ctx) => ctx.lifetimeStats.streak >= 365
    },

    // ─────────────── Cumulative points ───────────────
    {
        id: 'points_100', num: N(),
        name: 'Warming Up', description: 'Reach 100 total points',
        category: 'score', art: ART.chart, color: C_INK, shadow: C_INK_D,
        check: (ctx) => ctx.lifetimeStats.total >= 100
    },
    {
        id: 'points_500', num: N(),
        name: 'On the Board', description: 'Reach 500 total points',
        category: 'score', art: ART.chart, color: C_INK, shadow: C_INK_D,
        check: (ctx) => ctx.lifetimeStats.total >= 500
    },
    {
        id: 'points_1000', num: N(),
        name: 'Four Figures', description: 'Reach 1,000 total points',
        category: 'score', art: ART.chart, color: C_INK, shadow: C_INK_D,
        check: (ctx) => ctx.lifetimeStats.total >= 1000
    },
    {
        id: 'points_5000', num: N(),
        name: 'Seasoned', description: 'Reach 5,000 total points',
        category: 'score', art: ART.chart, color: C_ACCENT, shadow: C_ACCENT_D,
        check: (ctx) => ctx.lifetimeStats.total >= 5000
    },
    {
        id: 'points_10000', num: N(),
        name: 'Five Figures', description: 'Reach 10,000 total points',
        category: 'score', art: ART.chart, color: C_ACCENT, shadow: C_ACCENT_D,
        check: (ctx) => ctx.lifetimeStats.total >= 10000
    },
    {
        id: 'points_25000', num: N(),
        name: 'Legend', description: 'Reach 25,000 total points',
        category: 'score', art: ART.chart, color: C_GOLD, shadow: C_GOLD_D,
        check: (ctx) => ctx.lifetimeStats.total >= 25000
    },
    {
        id: 'points_50000', num: N(),
        name: 'Immortal', description: 'Reach 50,000 total points',
        category: 'score', art: ART.chart, color: C_GOLD, shadow: C_GOLD_D,
        check: (ctx) => ctx.lifetimeStats.total >= 50000
    },

    // ─────────────── Perfect / High-score feats ───────────────
    {
        id: 'high_scorer_20', num: N(),
        name: 'Top of the Table', description: 'Score 20 or more in a day',
        category: 'score', art: ART.star, color: C_WARN, shadow: C_WARN_D,
        check: (ctx) => totalScore(ctx.state) >= 20 && countPlayed(ctx.state) === 4
    },
    {
        id: 'perfect_1', num: N(),
        name: 'Clean Sheet', description: 'Score a perfect 25 / 25',
        category: 'score', art: ART.trophy, color: C_ACCENT, shadow: C_ACCENT_D,
        check: (ctx) => totalScore(ctx.state) === 25 && countPlayed(ctx.state) === 4
    },
    {
        id: 'perfect_10', num: N(),
        name: '10x Perfect', description: 'Score a perfect 25 / 25 ten times',
        category: 'score', art: ART.trophy, color: C_ACCENT, shadow: C_ACCENT_D,
        check: (ctx) => ctx.agg.perfectMatchdays >= 10
    },
    {
        id: 'perfect_50', num: N(),
        name: '50x Perfect', description: 'Score a perfect 25 / 25 fifty times',
        category: 'score', art: ART.trophy, color: C_GOLD, shadow: C_GOLD_D,
        check: (ctx) => ctx.agg.perfectMatchdays >= 50
    },

    // ─────────────── Per-game mastery (tiered) ───────────────
    {
        id: 'tenable_ace_1', num: N(),
        name: 'All Ten', description: 'Name all 10 in Tenable',
        category: 'mastery', art: ART.football, color: C_TEN, shadow: C_TEN_D,
        check: (ctx) => ctx.agg.tenableAllTen >= 1
    },
    {
        id: 'tenable_ace_25', num: N(),
        name: 'Tenable Expert', description: 'All 10 in Tenable · 25x',
        category: 'mastery', art: ART.football, color: C_TEN, shadow: C_TEN_D,
        check: (ctx) => ctx.agg.tenableAllTen >= 25
    },
    {
        id: 'tenable_ace_100', num: N(),
        name: 'Tenable Master', description: 'All 10 in Tenable · 100x',
        category: 'mastery', art: ART.football, color: C_GOLD, shadow: C_GOLD_D,
        check: (ctx) => ctx.agg.tenableAllTen >= 100
    },
    {
        id: 'player_scout_1', num: N(),
        name: 'Scout', description: 'Guess the Player first try',
        category: 'mastery', art: ART.boot, color: C_PLAYER, shadow: C_PLAYER_D,
        check: (ctx) => ctx.agg.guessPlayerFirstTry >= 1
    },
    {
        id: 'player_scout_25', num: N(),
        name: 'Chief Scout', description: 'Guess the Player first try · 25x',
        category: 'mastery', art: ART.boot, color: C_PLAYER, shadow: C_PLAYER_D,
        check: (ctx) => ctx.agg.guessPlayerFirstTry >= 25
    },
    {
        id: 'whoami_detective_1', num: N(),
        name: 'Detective', description: 'Who Am I first try',
        category: 'mastery', art: ART.magnify, color: C_WHOAMI, shadow: C_WHOAMI_D,
        check: (ctx) => ctx.agg.whoAmIFirstTry >= 1
    },
    {
        id: 'whoami_detective_25', num: N(),
        name: 'Mastermind', description: 'Who Am I first try · 25x',
        category: 'mastery', art: ART.magnify, color: C_WHOAMI, shadow: C_WHOAMI_D,
        check: (ctx) => ctx.agg.whoAmIFirstTry >= 25
    },
    {
        id: 'club_reader_1', num: N(),
        name: 'Read the Pitch', description: 'Guess the Club first try',
        category: 'mastery', art: ART.pitch, color: C_CLUB, shadow: C_CLUB_D,
        check: (ctx) => ctx.agg.guessClubFirstTry >= 1
    },
    {
        id: 'club_reader_25', num: N(),
        name: 'Tactical Genius', description: 'Guess the Club first try · 25x',
        category: 'mastery', art: ART.pitch, color: C_CLUB, shadow: C_CLUB_D,
        check: (ctx) => ctx.agg.guessClubFirstTry >= 25
    },

    // ─────────────── Matchday milestones ───────────────
    {
        id: 'played_10', num: N(),
        name: 'Regular', description: 'Play 10 matchdays',
        category: 'meta', art: ART.medal, color: C_INK, shadow: C_INK_D,
        check: (ctx) => ctx.lifetimeStats.days >= 10
    },
    {
        id: 'played_50', num: N(),
        name: 'Veteran', description: 'Play 50 matchdays',
        category: 'meta', art: ART.stopwatch, color: C_INK, shadow: C_INK_D,
        check: (ctx) => ctx.lifetimeStats.days >= 50
    },
    {
        id: 'played_100', num: N(),
        name: 'Centurion', description: 'Play 100 matchdays',
        category: 'meta', art: ART.medal, color: C_ACCENT, shadow: C_ACCENT_D,
        check: (ctx) => ctx.lifetimeStats.days >= 100
    },
    {
        id: 'played_250', num: N(),
        name: 'Hall of Famer', description: 'Play 250 matchdays',
        category: 'meta', art: ART.medal, color: C_GOLD, shadow: C_GOLD_D,
        check: (ctx) => ctx.lifetimeStats.days >= 250
    },

    // ─────────────── Hidden (discovery) ───────────────
    {
        id: 'purist', num: N(),
        name: 'Purist', description: 'Get 10/10 in Tenable without using any hints',
        category: 'hidden', art: ART.shield, color: C_TEN_D, shadow: '#062018',
        check: (ctx) => ctx.agg.tenablePerfectNoHints >= 1
    },
    {
        id: 'weekend_warrior', num: N(),
        name: 'Weekend Warrior', description: 'Play all 12 weekends in a row',
        category: 'hidden', art: ART.whistle, color: C_WARN, shadow: C_WARN_D,
        check: (ctx) => ctx.agg.weekendStreak >= 12
    },
    {
        id: 'early_bird', num: N(),
        name: 'Early Bird', description: 'Finish a matchday before 8:00 AM',
        category: 'hidden', art: ART.sunrise, color: C_WARN, shadow: C_WARN_D,
        check: (ctx) => {
            if (countPlayed(ctx.state) !== 4) return false;
            const hour = new Date().getHours();
            return hour < 8;
        }
    },
    {
        id: 'night_owl', num: N(),
        name: 'Night Owl', description: 'Finish a matchday after midnight',
        category: 'hidden', art: ART.moon, color: C_INK, shadow: C_INK_D,
        check: (ctx) => {
            if (countPlayed(ctx.state) !== 4) return false;
            const hour = new Date().getHours();
            return hour >= 0 && hour < 4;
        }
    },
];

export function formatNum(n) {
    return `№ ${String(n).padStart(2, '0')}`;
}

// ═══════════════════════════════════════════════════════════════
// Storage + unlock logic
// ═══════════════════════════════════════════════════════════════

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
    const agg = await getAggregateStats();
    const ctx = { state, lifetimeStats, agg };
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

/**
 * Achievements grouped for the full screen. "Hidden" category ONLY shows
 * achievements the user has already unlocked — surprise preservation.
 */
export function getAchievementsGrouped() {
    const unlocked = loadUnlocked();
    const groups = {
        streak: [],
        score: [],
        mastery: [],
        meta: [],
        hidden: []
    };
    for (const ach of ACHIEVEMENTS) {
        if (ach.category === 'hidden' && !unlocked[ach.id]) continue;
        if (groups[ach.category]) groups[ach.category].push(ach);
    }
    return groups;
}

/**
 * Count hidden achievements that exist (for showing "X hidden remaining" hint).
 */
export function getHiddenStats() {
    const unlocked = loadUnlocked();
    const allHidden = ACHIEVEMENTS.filter(a => a.category === 'hidden');
    const unlockedHidden = allHidden.filter(a => unlocked[a.id]);
    return {
        total: allHidden.length,
        unlocked: unlockedHidden.length,
        remaining: allHidden.length - unlockedHidden.length
    };
}
