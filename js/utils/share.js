// Share feature — renders the celebration screen as an image and shares it.
// Uses html2canvas (lazy-loaded from CDN on first use).
// Falls back to text-emoji share if canvas/Web Share API with files isn't
// supported, OR if html2canvas fails to load (offline etc).

import { toast } from './toast.js';
import { todayKey } from './date-key.js';

const HTML2CANVAS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
let html2canvasPromise = null;

function loadHtml2Canvas() {
    if (window.html2canvas) return Promise.resolve(window.html2canvas);
    if (html2canvasPromise) return html2canvasPromise;
    html2canvasPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = HTML2CANVAS_URL;
        script.async = true;
        script.onload = () => resolve(window.html2canvas);
        script.onerror = () => {
            html2canvasPromise = null;
            reject(new Error('Could not load html2canvas'));
        };
        document.head.appendChild(script);
    });
    return html2canvasPromise;
}

/**
 * Build the fallback emoji-text share (used when image-share isn't possible).
 */
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

function formatDateForShare(dateKey) {
    const [y, m, d] = dateKey.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/**
 * Render a given DOM element to a PNG Blob.
 */
async function elementToBlob(el) {
    const html2canvas = await loadHtml2Canvas();
    const bgColor = getComputedStyle(document.documentElement)
        .getPropertyValue('--base').trim() || '#F5F1E8';
    const canvas = await html2canvas(el, {
        backgroundColor: bgColor,
        scale: 2,                 // retina quality
        useCORS: true,
        logging: false,
        // Mobile fix: force known viewport size (html2canvas misreads 100vh on iOS)
        windowWidth: el.offsetWidth,
        windowHeight: el.offsetHeight
    });
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png', 0.95));
}

/**
 * Share today's result as an image of the celebration screen.
 * Falls back to emoji-text if anything fails.
 */
export async function shareResult(state) {
    const celebEl = document.getElementById('celebration-share-card');
    const text = buildShareText(state);

    // Attempt image share if celebration DOM is available
    if (celebEl) {
        try {
            const blob = await elementToBlob(celebEl);
            if (blob) {
                const file = new File([blob], `matchday-${todayKey()}.png`, { type: 'image/png' });

                // Web Share API with files
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                    try {
                        await navigator.share({
                            title: 'My Matchday',
                            text: `Matchday · ${formatDateForShare(todayKey())}`,
                            files: [file]
                        });
                        return true;
                    } catch (e) {
                        if (e.name === 'AbortError') return false;
                        // share failed for other reasons, fall through to download
                    }
                }

                // Fallback: trigger download of the image
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `matchday-${todayKey()}.png`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
                toast('Image downloaded', 'success');
                return true;
            }
        } catch (e) {
            console.warn('[Share] Image generation failed, falling back to text:', e);
            // fall through to text share below
        }
    }

    // Text fallback (no celebration DOM, or html2canvas unavailable)
    if (navigator.share) {
        try {
            await navigator.share({ title: 'My Matchday', text });
            return true;
        } catch (e) {
            if (e.name === 'AbortError') return false;
        }
    }
    try {
        await navigator.clipboard.writeText(text);
        toast('Copied to clipboard', 'success');
        return true;
    } catch (e) {
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
            toast('Copied to clipboard', 'success');
            return true;
        } catch (e2) {
            toast('Could not share', 'error');
            return false;
        }
    }
}
