// Wordle-style share feature.
// Produces a spoiler-free emoji grid summarising today's Matchday.
// Uses Web Share API when available (iOS Safari supports it in standalone PWA),
// falls back to clipboard copy with a toast confirmation.

import { toast } from './toast.js';
import { todayKey } from './date-key.js';

const GAME_MAX = {
    tenable: 10,
    guessPlayer: 5,
    whoAmI: 5,
    guessClub: 5
};

/**
 * Build a spoiler-free emoji grid showing per-game performance.
 * Tenable uses 🟩 (got) / ⬜ (missed) for each of 10 ranks.
 * Other games use a single pill showing score fraction.
 */
export function buildShareText(state) {
    const dateStr = formatDateForShare(todayKey());
    const lines = [`Matchday · ${dateStr}`];

    const total = (state.tenable?.score || 0)
                + (state.guessPlayer?.score || 0)
                + (state.whoAmI?.score || 0)
                + (state.guessClub?.score || 0);
    lines.push(`${total}/25`);
    lines.push('');

    // Tenable: 10-cell row showing which ranks were revealed
    if (state.tenable?.played) {
        const revealed = new Set(state.tenable.revealedRanks || []);
        let row = '1⃣ ';
        for (let r = 1; r <= 10; r++) {
            row += revealed.has(r) ? '🟩' : '⬜';
        }
        lines.push(row);
    } else {
        lines.push('1⃣ ⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛');
    }

    // Other games: score out of 5 as filled circles
    lines.push(formatGameRow('2⃣', state.guessPlayer));
    lines.push(formatGameRow('3⃣', state.whoAmI));
    lines.push(formatGameRow('4⃣', state.guessClub));

    lines.push('');
    lines.push('matchday.app'); // Change this to your actual URL

    return lines.join('\n');
}

function formatGameRow(label, gameState) {
    if (!gameState?.played) {
        return `${label} ⬛⬛⬛⬛⬛`;
    }
    const score = gameState.score || 0;
    let row = label + ' ';
    for (let i = 0; i < 5; i++) {
        row += i < score ? '🟩' : '⬜';
    }
    return row;
}

function formatDateForShare(dateKey) {
    const [y, m, d] = dateKey.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short'
    });
}

/**
 * Share today's result. Uses Web Share API if available (native share sheet),
 * otherwise falls back to clipboard with a toast.
 */
export async function shareResult(state) {
    const text = buildShareText(state);

    // Try Web Share API first — this gives the native iOS share sheet
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'My Matchday',
                text: text
            });
            return true;
        } catch (e) {
            // User cancelled, or share failed — fall through to clipboard
            if (e.name === 'AbortError') return false;
        }
    }

    // Clipboard fallback
    try {
        await navigator.clipboard.writeText(text);
        toast('Copied to clipboard', 'success');
        return true;
    } catch (e) {
        // Last-resort fallback for very old browsers
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            toast('Copied to clipboard', 'success');
            return true;
        } catch (e2) {
            toast('Could not share', 'error');
            return false;
        }
    }
}
