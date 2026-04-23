import { kvGet, kvSet } from './kv-store.js';

const SETTINGS_KEY = 'voetbalquiz_settings_v1';
const DEFAULT_SETTINGS = { theme: 'light' };
let cached = null;

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
    return cached;
}

export function getSettings() {
    return cached || { ...DEFAULT_SETTINGS };
}

export function saveSettings(patch) {
    cached = { ...getSettings(), ...patch };
    // Fire-and-forget persist — UI doesn't need to await.
    kvSet(SETTINGS_KEY, JSON.stringify(cached)).catch(() => {});
    return cached;
}

export function applyTheme() {
    document.documentElement.dataset.theme = 'light';
}
export function initThemeListener() { applyTheme(); }
export function resolveTheme() { return 'light'; }
