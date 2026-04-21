// Share feature — renders a shareable card using native Canvas API.
// No html2canvas dependency. Works offline. Designed for iOS/Capacitor.
//
// Share flow priority:
//   1. Capacitor Share plugin with file (best on iOS — native share sheet)
//   2. Web Share API with file (iOS Safari 15+)
//   3. Download image (fallback)
//   4. Text + clipboard (ultimate fallback)

import { toast } from './toast.js';
import { todayKey } from './date-key.js';

// ═══════════════════════════════════════════════════════════════
// DESIGN TOKENS — match the app's Daily Paper aesthetic
// ═══════════════════════════════════════════════════════════════
const TOKENS = {
    // 1080x1350 = Instagram portrait ratio, scales well for stories
    width: 1080,
    height: 1350,

    base: '#F5F1E8',
    ink: '#1C1815',
    ink2: '#6B6560',
    ink3: '#A39D96',
    divider: 'rgba(28, 24, 21, 0.10)',

    accent: '#D64933',
    tenable: '#0E4D3A',
    player: '#2E7D4B',
    whoami: '#4A6B3E',
    club: '#0A7F7F',

    sunken: '#EFEAE0',

    fontSerif: 'Georgia, "Times New Roman", serif',
    fontSans: '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif'
};

const GAME_LABELS = {
    tenable: 'Tenable',
    guessPlayer: 'Guess the Player',
    whoAmI: 'Who Am I',
    guessClub: 'Guess the Club'
};
const GAME_MAX = { tenable: 10, guessPlayer: 5, whoAmI: 5, guessClub: 5 };
const GAME_COLORS = {
    tenable: TOKENS.tenable,
    guessPlayer: TOKENS.player,
    whoAmI: TOKENS.whoami,
    guessClub: TOKENS.club
};

// ═══════════════════════════════════════════════════════════════
// Canvas text helpers
// ═══════════════════════════════════════════════════════════════

function drawText(ctx, text, x, y, opts = {}) {
    const {
        font = TOKENS.fontSans,
        size = 24,
        weight = 'normal',
        color = TOKENS.ink,
        align = 'left',
        baseline = 'alphabetic',
        letterSpacing = 0,
        uppercase = false
    } = opts;

    ctx.save();
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.font = `${weight} ${size}px ${font}`;

    const finalText = uppercase ? String(text).toUpperCase() : String(text);

    if (letterSpacing > 0 && ctx.letterSpacing !== undefined) {
        ctx.letterSpacing = `${letterSpacing}px`;
        ctx.fillText(finalText, x, y);
    } else if (letterSpacing > 0) {
        // Manual letter-spacing for browsers without ctx.letterSpacing
        const chars = finalText.split('');
        let cursorX = x;
        if (align === 'center') {
            const totalW = chars.reduce((w, c) => w + ctx.measureText(c).width, 0)
                         + letterSpacing * (chars.length - 1);
            cursorX = x - totalW / 2;
        } else if (align === 'right') {
            const totalW = chars.reduce((w, c) => w + ctx.measureText(c).width, 0)
                         + letterSpacing * (chars.length - 1);
            cursorX = x - totalW;
        }
        ctx.textAlign = 'left';
        for (const c of chars) {
            ctx.fillText(c, cursorX, y);
            cursorX += ctx.measureText(c).width + letterSpacing;
        }
    } else {
        ctx.fillText(finalText, x, y);
    }

    ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

// ═══════════════════════════════════════════════════════════════
// Logo drawing (matches the Matchday SVG logo)
// ═══════════════════════════════════════════════════════════════

function drawLogo(ctx, cx, cy, size) {
    // Black rounded rect background
    const rectSize = size * 0.83;
    const rectX = cx - rectSize / 2;
    const rectY = cy - size / 2 + size * 0.1;
    ctx.save();
    ctx.fillStyle = TOKENS.ink;
    roundRect(ctx, rectX, rectY, rectSize, rectSize * 0.93, size * 0.08);
    ctx.fill();

    // White M path
    const mLeftX  = rectX + rectSize * 0.20;
    const mRightX = rectX + rectSize * 0.80;
    const mTopY   = rectY + rectSize * 0.26;
    const mBotY   = rectY + rectSize * 0.75;
    const mMidY   = rectY + rectSize * 0.55;
    const mMidX   = rectX + rectSize * 0.50;

    ctx.strokeStyle = TOKENS.base;
    ctx.lineWidth = size * 0.06;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(mLeftX, mBotY);
    ctx.lineTo(mLeftX, mTopY);
    ctx.lineTo(mMidX, mMidY);
    ctx.lineTo(mRightX, mTopY);
    ctx.lineTo(mRightX, mBotY);
    ctx.stroke();

    // Red dot
    ctx.fillStyle = TOKENS.accent;
    ctx.beginPath();
    ctx.arc(mMidX, mBotY, size * 0.045, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

// ═══════════════════════════════════════════════════════════════
// MAIN: build the share card
// ═══════════════════════════════════════════════════════════════

function formatDateForShare(dateKey) {
    const [y, m, d] = dateKey.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric'
    });
}

function getVerdict(total) {
    if (total === 25) return 'Perfect score.';
    if (total >= 16)  return 'Elite ball knowledge.';
    if (total >= 10)  return 'Well played.';
    if (total >= 5)   return 'Below average.';
    return 'Rough day.';
}

function drawShareCard(state) {
    const { width: W, height: H } = TOKENS;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // ─── Background ───
    ctx.fillStyle = TOKENS.base;
    ctx.fillRect(0, 0, W, H);

    const total = (state.tenable?.score || 0)
                + (state.guessPlayer?.score || 0)
                + (state.whoAmI?.score || 0)
                + (state.guessClub?.score || 0);

    const pad = 80;

    // ─── Header: logo + wordmark + date ───
    const logoSize = 100;
    const logoY = 140;
    drawLogo(ctx, pad + logoSize / 2, logoY, logoSize);

    drawText(ctx, 'Matchday', pad + logoSize + 28, logoY - 10, {
        font: TOKENS.fontSerif, size: 56, weight: '600', color: TOKENS.ink,
        baseline: 'middle'
    });
    drawText(ctx, formatDateForShare(todayKey()), pad + logoSize + 28, logoY + 38, {
        font: TOKENS.fontSans, size: 22, weight: '700', color: TOKENS.ink3,
        baseline: 'middle', letterSpacing: 2, uppercase: true
    });

    // Divider under header
    ctx.fillStyle = TOKENS.divider;
    ctx.fillRect(pad, logoY + 110, W - pad * 2, 2);

    // ─── Eyebrow ───
    drawText(ctx, 'Matchday complete', pad, 360, {
        font: TOKENS.fontSans, size: 22, weight: '700', color: TOKENS.accent,
        letterSpacing: 3, uppercase: true
    });

    // ─── Verdict headline ───
    drawText(ctx, getVerdict(total), pad, 430, {
        font: TOKENS.fontSerif, size: 72, weight: '600', color: TOKENS.ink
    });

    // ─── Recap bars ───
    const recapY = 560;
    const rowH = 60;
    const rowGap = 16;
    const labelW = 260;
    const scoreW = 120;
    const barX = pad + labelW;
    const barW = W - pad * 2 - labelW - scoreW - 20;

    const games = ['tenable', 'guessPlayer', 'whoAmI', 'guessClub'];
    games.forEach((g, i) => {
        const y = recapY + i * (rowH + rowGap);

        // Label
        drawText(ctx, GAME_LABELS[g], pad, y + rowH / 2, {
            font: TOKENS.fontSans, size: 26, weight: '600',
            color: TOKENS.ink2, baseline: 'middle'
        });

        // Bar background
        ctx.fillStyle = TOKENS.sunken;
        roundRect(ctx, barX, y + rowH / 2 - 8, barW, 16, 8);
        ctx.fill();

        // Bar fill
        const s = state[g];
        const score = s?.score || 0;
        const max = GAME_MAX[g];
        const frac = Math.min(1, score / max);
        if (frac > 0) {
            ctx.fillStyle = GAME_COLORS[g];
            roundRect(ctx, barX, y + rowH / 2 - 8, barW * frac, 16, 8);
            ctx.fill();
        }

        // Score
        drawText(ctx, `${score}/${max}`, W - pad, y + rowH / 2, {
            font: TOKENS.fontSans, size: 26, weight: '700', color: TOKENS.ink,
            baseline: 'middle', align: 'right'
        });
    });

    // ─── Big total score ───
    const bigY = 960;
    const totalStr = String(total);
    const maxStr = '/ 25';

    ctx.save();
    ctx.font = `600 280px ${TOKENS.fontSerif}`;
    const totalW = ctx.measureText(totalStr).width;
    ctx.font = `500 96px ${TOKENS.fontSerif}`;
    const maxW = ctx.measureText(maxStr).width;
    ctx.restore();

    const blockW = totalW + 20 + maxW;
    const blockX = W / 2 - blockW / 2;

    drawText(ctx, totalStr, blockX, bigY, {
        font: TOKENS.fontSerif, size: 280, weight: '600', color: TOKENS.ink
    });
    drawText(ctx, maxStr, blockX + totalW + 20, bigY, {
        font: TOKENS.fontSerif, size: 96, weight: '500', color: TOKENS.ink3
    });

    // ─── Footer ───
    drawText(ctx, 'matchday.app', W / 2, H - 80, {
        font: TOKENS.fontSans, size: 24, weight: '600', color: TOKENS.ink3,
        align: 'center', letterSpacing: 1
    });

    return canvas;
}

function canvasToBlob(canvas, type = 'image/png', quality = 0.95) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => {
            if (blob) resolve(blob);
            else reject(new Error('Canvas toBlob returned null'));
        }, type, quality);
    });
}

// ═══════════════════════════════════════════════════════════════
// Text fallback (when image can't be shared)
// ═══════════════════════════════════════════════════════════════

export function buildShareText(state) {
    const dateStr = formatDateForShare(todayKey());
    const lines = [`Matchday · ${dateStr}`];
    const total = (state.tenable?.score || 0) + (state.guessPlayer?.score || 0)
                + (state.whoAmI?.score || 0) + (state.guessClub?.score || 0);
    lines.push(`${total}/25`);
    lines.push('');
    if (state.tenable?.played) {
        const revealed = new Set(state.tenable.revealedRanks || []);
        let row = '1⃣ ';
        for (let r = 1; r <= 10; r++) row += revealed.has(r) ? '🟩' : '⬜';
        lines.push(row);
    } else {
        lines.push('1⃣ ⬛⬛⬛⬛⬛⬛⬛⬛⬛⬛');
    }
    lines.push(formatGameRow('2⃣', state.guessPlayer));
    lines.push(formatGameRow('3⃣', state.whoAmI));
    lines.push(formatGameRow('4⃣', state.guessClub));
    lines.push('');
    lines.push('matchday.app');
    return lines.join('\n');
}

function formatGameRow(label, gameState) {
    if (!gameState?.played) return `${label} ⬛⬛⬛⬛⬛`;
    const score = gameState.score || 0;
    let row = label + ' ';
    for (let i = 0; i < 5; i++) row += i < score ? '🟩' : '⬜';
    return row;
}

// ═══════════════════════════════════════════════════════════════
// Native share strategies (iOS/Capacitor-first)
// ═══════════════════════════════════════════════════════════════

/**
 * Try Capacitor Share plugin with file. Works great on iOS native.
 * Returns true if share was invoked, false if not supported.
 */
async function tryCapacitorShare(blob, title, text) {
    const Capacitor = window.Capacitor;
    if (!Capacitor?.Plugins) return false;

    const { Filesystem, Share } = Capacitor.Plugins;
    if (!Filesystem || !Share) return false;

    try {
        // Convert blob to base64
        const base64 = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result;
                const comma = result.indexOf(',');
                resolve(comma >= 0 ? result.slice(comma + 1) : result);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });

        const filename = `matchday-${todayKey()}.png`;

        // Write to cache directory
        const writeResult = await Filesystem.writeFile({
            path: filename,
            data: base64,
            directory: 'CACHE'
        });

        // Share the file URI
        await Share.share({
            title,
            text,
            url: writeResult.uri,
            dialogTitle: 'Share your matchday'
        });
        return true;
    } catch (e) {
        if (e?.message?.includes('cancel') || e?.message?.includes('Canceled')) return false;
        console.warn('[Share] Capacitor share failed:', e);
        return false;
    }
}

/**
 * Web Share API with files — iOS Safari 15+, Chrome Android.
 */
async function tryWebShareFile(blob, title, text) {
    if (!navigator.canShare || !navigator.share) return false;
    const file = new File([blob], `matchday-${todayKey()}.png`, { type: 'image/png' });
    if (!navigator.canShare({ files: [file] })) return false;

    try {
        await navigator.share({ title, text, files: [file] });
        return true;
    } catch (e) {
        if (e?.name === 'AbortError') return false;
        console.warn('[Share] Web Share file failed:', e);
        return false;
    }
}

/**
 * Download fallback — creates an <a> tag, triggers click, revokes URL.
 */
function triggerDownload(blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `matchday-${todayKey()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ═══════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════

/**
 * Share today's result. Builds a native Canvas image, then tries in order:
 *   1. Capacitor Share plugin (iOS native share sheet)
 *   2. Web Share API with file (mobile browsers)
 *   3. Download image (desktop fallback)
 *   4. Copy text to clipboard (last resort)
 */
export async function shareResult(state) {
    const title = 'My Matchday';
    const text = `Matchday · ${formatDateForShare(todayKey())}`;

    let blob = null;
    try {
        const canvas = drawShareCard(state);
        blob = await canvasToBlob(canvas);
    } catch (e) {
        console.error('[Share] Canvas render failed:', e);
    }

    if (blob) {
        // 1. Capacitor (iOS native)
        if (await tryCapacitorShare(blob, title, text)) return true;

        // 2. Web Share API with file
        if (await tryWebShareFile(blob, title, text)) return true;

        // 3. Download fallback
        try {
            triggerDownload(blob);
            toast('Image saved', 'success');
            return true;
        } catch (e) {
            console.warn('[Share] Download failed:', e);
        }
    }

    // 4. Text fallback (clipboard or Web Share)
    const fallbackText = buildShareText(state);
    if (navigator.share) {
        try {
            await navigator.share({ title, text: fallbackText });
            return true;
        } catch (e) {
            if (e.name === 'AbortError') return false;
        }
    }
    try {
        await navigator.clipboard.writeText(fallbackText);
        toast('Copied to clipboard', 'success');
        return true;
    } catch (e) {
        toast('Could not share', 'error');
        return false;
    }
}
