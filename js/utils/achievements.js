// Achievements v2 — 33 football-themed badges, tiered + hidden
// Categories: streak, score, game, mastery, hidden
// Tiered achievements unlock in sequence and use the same icon with different tints.

import { toast } from './toast.js';
import { hapticSuccess } from './haptics.js';
import { getLifetimeStats, getAggregateStats } from './history.js';
import { countPlayed, totalScore } from './storage.js';
import { kvGet, kvSet } from './kv-store.js';

const STORAGE_KEY = 'voetbalquiz_achievements_v1';

// ═══════════════════════════════════════════════════════════════
// Expressive SVG art — drawn at 100x100.
// Each shape uses `currentColor` so colors can be themed from the
// parent, layered with soft highlights (rgba white) and per-icon
// gradients for depth. Gradient IDs are prefixed per-icon so multiple
// icons can coexist on the same page without collision.
// ═══════════════════════════════════════════════════════════════

const ART = {
    flag: `<svg viewBox="15 5 70 92"><defs><linearGradient id="g-flag" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="currentColor" stop-opacity="1"/><stop offset="1" stop-color="currentColor" stop-opacity="0.72"/></linearGradient></defs><g><rect x="22" y="10" width="7" height="82" rx="2.5" fill="currentColor"/><circle cx="25.5" cy="10" r="4.5" fill="currentColor"/><path d="M29 14 L78 14 L66 34 L78 54 L29 54 Z" fill="url(#g-flag)"/><path d="M29 14 L78 14 L74 20 L29 20 Z" fill="#ffffff" opacity="0.18"/><path d="M29 48 L70 48 L66 54 L29 54 Z" fill="#000000" opacity="0.12"/></g></svg>`,

    calendar: (label, fontSize) => `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-cal-${label}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity="1"/><stop offset="1" stop-color="currentColor" stop-opacity="0.82"/></linearGradient></defs><rect x="12" y="22" width="76" height="68" rx="8" fill="url(#g-cal-${label})"/><rect x="12" y="22" width="76" height="14" rx="8" fill="currentColor"/><rect x="12" y="30" width="76" height="6" fill="#000000" opacity="0.18"/><rect x="18" y="40" width="64" height="48" rx="4" fill="#F5F1E8" opacity="0.96"/><g fill="none" stroke="currentColor" stroke-opacity="0.18" stroke-width="1"><line x1="22" y1="50" x2="78" y2="50"/><line x1="22" y1="60" x2="78" y2="60"/><line x1="22" y1="70" x2="78" y2="70"/></g><rect x="22" y="10" width="8" height="20" rx="3" fill="currentColor"/><rect x="70" y="10" width="8" height="20" rx="3" fill="currentColor"/><rect x="22" y="10" width="8" height="4" rx="2" fill="#ffffff" opacity="0.35"/><rect x="70" y="10" width="8" height="4" rx="2" fill="#ffffff" opacity="0.35"/><text x="50" y="78" text-anchor="middle" font-family="'New York', ui-serif, Georgia, serif" font-weight="800" font-size="${fontSize}" fill="currentColor">${label}</text></svg>`,

    trophy: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-trophy" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity="1"/><stop offset="1" stop-color="currentColor" stop-opacity="0.78"/></linearGradient></defs><path d="M30 14 L70 14 L70 40 Q70 58 50 58 Q30 58 30 40 Z" fill="url(#g-trophy)"/><path d="M30 22 L18 22 Q14 22 14 28 Q14 42 30 44 Z" fill="currentColor"/><path d="M70 22 L82 22 Q86 22 86 28 Q86 42 70 44 Z" fill="currentColor"/><path d="M34 18 L38 18 L38 42 Q38 52 48 54 L46 56 Q34 52 34 40 Z" fill="#ffffff" opacity="0.22"/><ellipse cx="50" cy="16" rx="18" ry="3" fill="#ffffff" opacity="0.28"/><rect x="42" y="58" width="16" height="12" fill="currentColor"/><rect x="30" y="70" width="40" height="8" rx="2" fill="currentColor"/><rect x="34" y="78" width="32" height="10" rx="2" fill="url(#g-trophy)"/><rect x="34" y="78" width="32" height="3" rx="1.5" fill="#ffffff" opacity="0.25"/></svg>`,

    star: `<svg viewBox="0 0 100 100"><defs><radialGradient id="g-star" cx="0.4" cy="0.35" r="0.75"><stop offset="0" stop-color="#ffffff" stop-opacity="0.45"/><stop offset="0.4" stop-color="currentColor" stop-opacity="1"/><stop offset="1" stop-color="currentColor" stop-opacity="0.78"/></radialGradient></defs><path d="M50 10 L61 39 L92 41 L67 60 L76 90 L50 73 L24 90 L33 60 L8 41 L39 39 Z" fill="url(#g-star)"/><path d="M50 18 L58 40 L44 42 Z" fill="#ffffff" opacity="0.35"/></svg>`,

    football: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-pyr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity="1"/><stop offset="1" stop-color="currentColor" stop-opacity="0.72"/></linearGradient></defs><g><rect x="45" y="12" width="10" height="5" rx="1" fill="url(#g-pyr)"/><rect x="41" y="20" width="18" height="5" rx="1" fill="url(#g-pyr)"/><rect x="37" y="28" width="26" height="5" rx="1" fill="url(#g-pyr)"/><rect x="33" y="36" width="34" height="5" rx="1" fill="url(#g-pyr)"/><rect x="29" y="44" width="42" height="5" rx="1" fill="url(#g-pyr)"/><rect x="25" y="52" width="50" height="5" rx="1" fill="url(#g-pyr)"/><rect x="21" y="60" width="58" height="5" rx="1" fill="url(#g-pyr)"/><rect x="17" y="68" width="66" height="5" rx="1" fill="url(#g-pyr)"/><rect x="13" y="76" width="74" height="5" rx="1" fill="url(#g-pyr)"/><rect x="9"  y="84" width="82" height="5" rx="1" fill="url(#g-pyr)"/><g fill="#ffffff" opacity="0.3"><rect x="45" y="12" width="10" height="1.5" rx="0.75"/><rect x="41" y="20" width="18" height="1.5" rx="0.75"/><rect x="37" y="28" width="26" height="1.5" rx="0.75"/><rect x="33" y="36" width="34" height="1.5" rx="0.75"/><rect x="29" y="44" width="42" height="1.5" rx="0.75"/><rect x="25" y="52" width="50" height="1.5" rx="0.75"/><rect x="21" y="60" width="58" height="1.5" rx="0.75"/><rect x="17" y="68" width="66" height="1.5" rx="0.75"/><rect x="13" y="76" width="74" height="1.5" rx="0.75"/><rect x="9"  y="84" width="82" height="1.5" rx="0.75"/></g></g></svg>`,
    
    pitch: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-pitch" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity="0.85"/><stop offset="0.5" stop-color="currentColor" stop-opacity="1"/><stop offset="1" stop-color="currentColor" stop-opacity="0.85"/></linearGradient></defs><rect x="10" y="12" width="80" height="76" rx="4" fill="url(#g-pitch)"/><g stroke="#F5F1E8" stroke-width="2.2" stroke-linejoin="round" fill="none" opacity="0.95"><rect x="14" y="16" width="72" height="68" rx="2"/><line x1="14" y1="50" x2="86" y2="50"/><circle cx="50" cy="50" r="11"/><rect x="32" y="16" width="36" height="14"/><rect x="32" y="70" width="36" height="14"/><rect x="42" y="16" width="16" height="6"/><rect x="42" y="78" width="16" height="6"/></g><circle cx="50" cy="50" r="2.5" fill="#F5F1E8"/><g fill="#F5F1E8" opacity="0.95"><circle cx="50" cy="26" r="1.4"/><circle cx="50" cy="74" r="1.4"/></g><rect x="14" y="16" width="72" height="12" fill="#ffffff" opacity="0.12"/></svg>`,

    magnify: `<svg viewBox="0 0 100 100"><defs><radialGradient id="g-lens" cx="0.35" cy="0.35" r="0.75"><stop offset="0" stop-color="#ffffff" stop-opacity="0.6"/><stop offset="0.55" stop-color="#F5F1E8" stroke-opacity="0.95"/><stop offset="1" stop-color="#F5F1E8" stop-opacity="0.96"/></radialGradient></defs><rect x="58" y="58" width="30" height="12" rx="4" transform="rotate(45 73 64)" fill="currentColor"/><rect x="58" y="58" width="30" height="4" rx="2" transform="rotate(45 73 64)" fill="#ffffff" opacity="0.25"/><circle cx="42" cy="42" r="26" fill="currentColor"/><circle cx="42" cy="42" r="19" fill="url(#g-lens)"/><path d="M30 34 Q36 28 46 30" stroke="#ffffff" stroke-width="2.4" stroke-linecap="round" fill="none" opacity="0.65"/><text x="42" y="50" text-anchor="middle" font-family="'New York', ui-serif, Georgia, serif" font-weight="800" font-size="22" fill="currentColor">?</text></svg>`,

    boot: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-bino" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity="1"/><stop offset="1" stop-color="currentColor" stop-opacity="0.75"/></linearGradient><radialGradient id="g-lens" cx="0.35" cy="0.35" r="0.75"><stop offset="0" stop-color="#F5F1E8" stop-opacity="0.4"/><stop offset="0.5" stop-color="#F5F1E8" stop-opacity="0.12"/><stop offset="1" stop-color="#F5F1E8" stop-opacity="0"/></radialGradient></defs><g><rect x="24" y="26" width="20" height="14" rx="3" fill="url(#g-bino)"/><rect x="56" y="26" width="20" height="14" rx="3" fill="url(#g-bino)"/><rect x="40" y="30" width="20" height="8" rx="1" fill="currentColor"/><rect x="24" y="26" width="20" height="4" rx="3" fill="#ffffff" opacity="0.22"/><rect x="56" y="26" width="20" height="4" rx="3" fill="#ffffff" opacity="0.22"/><circle cx="30" cy="62" r="20" fill="url(#g-bino)"/><circle cx="70" cy="62" r="20" fill="url(#g-bino)"/><ellipse cx="26" cy="52" rx="10" ry="5" fill="#ffffff" opacity="0.22"/><ellipse cx="66" cy="52" rx="10" ry="5" fill="#ffffff" opacity="0.22"/><circle cx="30" cy="62" r="12" fill="#F5F1E8" opacity="0.95"/><circle cx="70" cy="62" r="12" fill="#F5F1E8" opacity="0.95"/><circle cx="30" cy="62" r="12" fill="url(#g-lens)"/><circle cx="70" cy="62" r="12" fill="url(#g-lens)"/><circle cx="30" cy="62" r="6" fill="currentColor"/><circle cx="70" cy="62" r="6" fill="currentColor"/><circle cx="27" cy="59" r="2" fill="#ffffff" opacity="0.55"/><circle cx="67" cy="59" r="2" fill="#ffffff" opacity="0.55"/></g></svg>`,    

    medal: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-ribbon" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity="0.9"/><stop offset="1" stop-color="currentColor" stop-opacity="0.65"/></linearGradient><radialGradient id="g-medal" cx="0.38" cy="0.38" r="0.7"><stop offset="0" stop-color="#ffffff" stop-opacity="0.5"/><stop offset="0.35" stop-color="currentColor" stop-opacity="1"/><stop offset="1" stop-color="currentColor" stop-opacity="0.78"/></radialGradient></defs><path d="M32 10 L44 42 L56 42 L68 10 L58 10 L50 30 L42 10 Z" fill="url(#g-ribbon)"/><path d="M36 10 L50 32 L64 10" stroke="#ffffff" stroke-width="1.4" fill="none" opacity="0.3"/><circle cx="50" cy="64" r="28" fill="url(#g-medal)"/><circle cx="50" cy="64" r="22" fill="#F5F1E8" opacity="0.96"/><g fill="none" stroke="currentColor" stroke-opacity="0.25" stroke-width="1.2"><circle cx="50" cy="64" r="20"/></g><path d="M40 48 Q50 42 60 50" stroke="#ffffff" stroke-width="3" fill="none" opacity="0.35" stroke-linecap="round"/><text x="50" y="72" text-anchor="middle" font-family="'New York', ui-serif, Georgia, serif" font-weight="800" font-size="22" fill="currentColor">1</text></svg>`,

    stopwatch: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-watch" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity="1"/><stop offset="1" stop-color="currentColor" stop-opacity="0.78"/></linearGradient></defs><rect x="40" y="8" width="20" height="10" rx="2" fill="currentColor"/><rect x="46" y="12" width="8" height="10" fill="currentColor"/><rect x="46" y="12" width="8" height="3" fill="#ffffff" opacity="0.35"/><circle cx="50" cy="60" r="34" fill="url(#g-watch)"/><circle cx="50" cy="60" r="26" fill="#F5F1E8" opacity="0.96"/><g stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="50" y1="38" x2="50" y2="42"/><line x1="50" y1="78" x2="50" y2="82"/><line x1="28" y1="60" x2="32" y2="60"/><line x1="68" y1="60" x2="72" y2="60"/></g><g stroke="currentColor" stroke-opacity="0.4" stroke-width="1"><line x1="50" y1="44" x2="50" y2="46"/><line x1="50" y1="74" x2="50" y2="76"/><line x1="34" y1="60" x2="36" y2="60"/><line x1="64" y1="60" x2="66" y2="60"/></g><rect x="48" y="40" width="4" height="22" rx="2" fill="currentColor"/><rect x="48" y="58" width="22" height="4" rx="2" transform="rotate(30 50 60)" fill="currentColor"/><circle cx="50" cy="60" r="3" fill="currentColor"/><circle cx="40" cy="48" r="2" fill="#ffffff" opacity="0.55"/></svg>`,

    chart: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-bar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity="1"/><stop offset="1" stop-color="currentColor" stop-opacity="0.72"/></linearGradient></defs><g stroke="currentColor" stroke-opacity="0.14" stroke-width="1"><line x1="10" y1="92" x2="96" y2="92"/><line x1="10" y1="72" x2="96" y2="72"/><line x1="10" y1="52" x2="96" y2="52"/><line x1="10" y1="32" x2="96" y2="32"/></g><rect x="16" y="60" width="14" height="32" rx="3" fill="url(#g-bar)"/><rect x="36" y="45" width="14" height="47" rx="3" fill="url(#g-bar)"/><rect x="56" y="30" width="14" height="62" rx="3" fill="url(#g-bar)"/><rect x="76" y="15" width="14" height="77" rx="3" fill="url(#g-bar)"/><g fill="#ffffff" opacity="0.3"><rect x="16" y="60" width="14" height="5" rx="2"/><rect x="36" y="45" width="14" height="5" rx="2"/><rect x="56" y="30" width="14" height="5" rx="2"/><rect x="76" y="15" width="14" height="5" rx="2"/></g><path d="M23 62 L43 47 L63 32 L83 17" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.55"/><g fill="currentColor"><circle cx="23" cy="62" r="2.4"/><circle cx="43" cy="47" r="2.4"/><circle cx="63" cy="32" r="2.4"/><circle cx="83" cy="17" r="2.4"/></g></svg>`,

    sunrise: `<svg viewBox="0 0 100 100"><defs><radialGradient id="g-sun" cx="0.5" cy="0.45" r="0.55"><stop offset="0" stop-color="#ffffff" stop-opacity="0.7"/><stop offset="0.45" stop-color="currentColor" stop-opacity="1"/><stop offset="1" stop-color="currentColor" stop-opacity="0.78"/></radialGradient></defs><g stroke="currentColor" stroke-width="5" stroke-linecap="round" opacity="0.95"><line x1="50" y1="14" x2="50" y2="26"/><line x1="50" y1="74" x2="50" y2="86"/><line x1="14" y1="50" x2="26" y2="50"/><line x1="74" y1="50" x2="86" y2="50"/><line x1="24" y1="24" x2="33" y2="33"/><line x1="67" y1="33" x2="76" y2="24"/><line x1="24" y1="76" x2="33" y2="67"/><line x1="67" y1="67" x2="76" y2="76"/></g><circle cx="50" cy="50" r="18" fill="url(#g-sun)"/><path d="M36 50 Q42 42 50 43 Q58 44 64 50" stroke="#ffffff" stroke-width="2" fill="none" opacity="0.5" stroke-linecap="round"/></svg>`,

    moon: `<svg viewBox="0 0 100 100"><defs><radialGradient id="g-moon" cx="0.32" cy="0.35" r="0.8"><stop offset="0" stop-color="#ffffff" stop-opacity="0.35"/><stop offset="0.5" stop-color="currentColor" stop-opacity="1"/><stop offset="1" stop-color="currentColor" stop-opacity="0.78"/></radialGradient></defs><path d="M68 50 Q68 32 50 24 Q76 22 88 48 Q92 78 62 86 Q36 90 22 64 Q38 80 54 76 Q70 70 68 50 Z" fill="url(#g-moon)"/><g fill="#F5F1E8" opacity="0.32"><circle cx="55" cy="48" r="3"/><circle cx="68" cy="62" r="2.2"/><circle cx="48" cy="64" r="1.8"/></g><g fill="#F5F1E8"><circle cx="24" cy="26" r="1.8"/><circle cx="86" cy="20" r="1.4"/><circle cx="14" cy="60" r="1.2"/></g></svg>`,

    bolt: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-bolt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.45"/><stop offset="0.45" stop-color="currentColor" stop-opacity="1"/><stop offset="1" stop-color="currentColor" stop-opacity="0.78"/></linearGradient></defs><path d="M55 8 L22 58 L44 58 L40 92 L78 38 L54 38 Z" fill="url(#g-bolt)"/><path d="M55 10 L28 56 L44 56 L42 78" stroke="#ffffff" stroke-width="2" fill="none" opacity="0.35" stroke-linecap="round"/></svg>`,

    shield: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-shield" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity="1"/><stop offset="1" stop-color="currentColor" stop-opacity="0.72"/></linearGradient></defs><path d="M50 8 L18 18 L18 52 Q18 78 50 92 Q82 78 82 52 L82 18 Z" fill="url(#g-shield)"/><path d="M50 20 L30 26 L30 52 Q30 72 50 82 Q70 72 70 52 L70 26 Z" fill="#F5F1E8" opacity="0.96"/><path d="M30 26 L50 20 L50 54 Q38 62 30 52 Z" fill="currentColor" opacity="0.08"/><path d="M22 22 Q40 14 50 14 L50 18 Q36 18 22 26 Z" fill="#ffffff" opacity="0.3"/><g stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none"><line x1="50" y1="36" x2="50" y2="60"/><circle cx="50" cy="68" r="2"/></g></svg>`,

    whistle: `<svg viewBox="0 0 100 100"><defs><linearGradient id="g-whistle" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity="1"/><stop offset="1" stop-color="currentColor" stop-opacity="0.78"/></linearGradient></defs><path d="M20 44 Q20 30 34 30 L66 30 L82 46 Q82 70 60 70 L34 70 Q20 70 20 56 Z" fill="url(#g-whistle)"/><path d="M24 36 Q28 32 36 32 L62 32" stroke="#ffffff" stroke-width="2" fill="none" opacity="0.4" stroke-linecap="round"/><circle cx="40" cy="50" r="9" fill="#F5F1E8" opacity="0.98"/><circle cx="40" cy="50" r="9" fill="none" stroke="currentColor" stroke-opacity="0.25" stroke-width="1"/><circle cx="37" cy="47" r="2.5" fill="#ffffff" opacity="0.6"/><rect x="48" y="12" width="6" height="20" rx="3" fill="currentColor"/><circle cx="51" cy="10" r="4" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>`,
};

// Palette
const C_PLAYER = 'var(--player)', C_PLAYER_D = 'var(--player-dark)';
const C_F10 = 'var(--football10)', C_F10_D = 'var(--football10-dark)';
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
        id: 'football10_ace_1', num: N(),
        name: 'All Ten', description: 'Name all 10 in Football 10',
        category: 'mastery', art: ART.football, color: C_F10, shadow: C_F10_D,
        check: (ctx) => ctx.agg.football10AllTen >= 1
    },
    {
        id: 'football10_ace_25', num: N(),
        name: 'Football 10 Expert', description: 'All 10 in Football 10 · 25x',
        category: 'mastery', art: ART.football, color: C_F10, shadow: C_F10_D,
        check: (ctx) => ctx.agg.football10AllTen >= 25
    },
    {
        id: 'football10_ace_100', num: N(),
        name: 'Football 10 Master', description: 'All 10 in Football 10 · 100x',
        category: 'mastery', art: ART.football, color: C_GOLD, shadow: C_GOLD_D,
        check: (ctx) => ctx.agg.football10AllTen >= 100
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
        name: 'Purist', description: 'Get 10/10 in Football 10 without using any hints',
        category: 'hidden', art: ART.shield, color: C_F10_D, shadow: '#062018',
        check: (ctx) => ctx.agg.football10PerfectNoHints >= 1
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

// Unlocked achievements are persisted via the shared kv-store (localStorage
// on web, Capacitor Preferences on iOS). We warm an in-memory cache on boot
// so that the render code — which runs in synchronous contexts — can still
// read without awaiting.
let unlockedCache = null;

async function loadUnlockedFromStore() {
    try {
        const raw = await kvGet(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (e) {
        return {};
    }
}

async function saveUnlocked(data) {
    unlockedCache = data;
    try {
        await kvSet(STORAGE_KEY, JSON.stringify(data));
    } catch (e) { /* ignore */ }
}

/**
 * Must be awaited once at app boot before any sync getters are used.
 * Safe to call multiple times — subsequent calls are a no-op.
 */
export async function initAchievements() {
    if (unlockedCache) return unlockedCache;
    unlockedCache = await loadUnlockedFromStore();
    return unlockedCache;
}

export function getUnlocked() {
    return unlockedCache || {};
}

export function isUnlocked(id) {
    return !!(unlockedCache || {})[id];
}

export function getRecentUnlocked(limit = 3) {
    return Object.entries(unlockedCache || {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([id]) => id);
}

export async function checkAchievements(state) {
    // Re-read from disk so that any changes made from other tabs/sessions are
    // picked up; merge with in-memory cache as a defensive default.
    const persisted = await loadUnlockedFromStore();
    const unlocked = { ...persisted, ...(unlockedCache || {}) };
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
        await saveUnlocked(unlocked);
        newlyUnlocked.forEach((ach, i) => {
            setTimeout(() => {
                hapticSuccess();
                toast(`Unlocked · ${ach.name}`, 'success');
            }, 300 + i * 1800);
        });
    } else {
        unlockedCache = unlocked;
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
    const unlocked = unlockedCache || {};
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
    const unlocked = unlockedCache || {};
    const allHidden = ACHIEVEMENTS.filter(a => a.category === 'hidden');
    const unlockedHidden = allHidden.filter(a => unlocked[a.id]);
    return {
        total: allHidden.length,
        unlocked: unlockedHidden.length,
        remaining: allHidden.length - unlockedHidden.length
    };
}
