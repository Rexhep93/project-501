const SETTINGS_KEY = 'voetbalquiz_settings_v1';
const DEFAULT_SETTINGS = { theme: 'light' };
let cached = null;

export function getSettings() {
    if (cached) return cached;
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (raw) { cached = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }; return cached; }
    } catch (e) {}
    cached = { ...DEFAULT_SETTINGS };
    return cached;
}
export function saveSettings(patch) {
    cached = { ...getSettings(), ...patch };
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(cached)); } catch (e) {}
    return cached;
}
export function applyTheme() {
    document.documentElement.dataset.theme = 'light';
}
export function initThemeListener() { applyTheme(); }
export function resolveTheme() { return 'light'; }
