import { kvGet, kvSet } from './kv-store.js';

const SETTINGS_KEY = 'voetbalquiz_settings_v1';
const DEFAULT_SETTINGS = { theme: 'system' };

let cached = null;
let mediaQuery = null;

/**
 * Must be awaited once at app boot. Sync `getSettings()` is safe after.
 */
export async function initSettings() {
    if (cached) return cached;
    try {
        const raw = await kvGet(SETTINGS_KEY);
        cached = raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
    } catch (e) {
        cached = { ...DEFAULT_SETTINGS };
    }
    // Apply the theme immediately on boot so the user doesn't see a flash
    applyTheme();
    return cached;
}

export function getSettings() {
    return cached || { ...DEFAULT_SETTINGS };
}

/**
 * Save a settings patch and immediately apply the theme.
 * Fire-and-forget persistence — the UI doesn't need to await.
 */
export function saveSettings(patch) {
    cached = { ...getSettings(), ...patch };
    kvSet(SETTINGS_KEY, JSON.stringify(cached)).catch(() => {});
    applyTheme();
    return cached;
}

/**
 * Resolve what theme should actually be applied to the document.
 * - 'system' → read OS preference
 * - 'light' | 'dark' → that exact theme
 */
export function resolveTheme() {
    const setting = getSettings().theme;
    if (setting === 'light' || setting === 'dark') return setting;
    // system
    if (typeof window !== 'undefined' && window.matchMedia) {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
}

/**
 * Apply the resolved theme to the root <html> element via data-theme.
 * Also updates the theme-color meta tag so the iOS status bar matches.
 */
export function applyTheme() {
    const theme = resolveTheme();
    document.documentElement.dataset.theme = theme;

    // Sync <meta name="theme-color"> for iOS status bar + PWA chrome
    const metaColor = theme === 'dark' ? '#141414' : '#F5F5F2';
    document.querySelectorAll('meta[name="theme-color"]').forEach(m => {
        // Only touch the non-media-qualified one, if present; otherwise update all
        if (!m.hasAttribute('media')) {
            m.setAttribute('content', metaColor);
        }
    });
    // Also emit a custom event so other parts of the app can react if they want
    try {
        window.dispatchEvent(new CustomEvent('themechange', { detail: { theme } }));
    } catch (e) { /* ignore */ }
}

/**
 * Listen to OS color-scheme changes so that when the user picks "system"
 * we automatically follow their device.
 */
export function initThemeListener() {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    if (mediaQuery) return; // already wired
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
        if (getSettings().theme === 'system') applyTheme();
    };
    // Modern API, falls back to deprecated addListener for older webviews
    if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handler);
    } else if (mediaQuery.addListener) {
        mediaQuery.addListener(handler);
    }
}
