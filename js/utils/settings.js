// User settings — theme toggle etc.
// Stored in localStorage (no need for Capacitor Preferences here — small,
// not critical, survives reinstalls irrelevant).

const SETTINGS_KEY = 'voetbalquiz_settings_v1';

const DEFAULT_SETTINGS = {
    theme: 'auto'  // 'auto' | 'light' | 'dark'
};

let cached = null;

export function getSettings() {
    if (cached) return cached;
    try {
        const raw = localStorage.getItem(SETTINGS_KEY);
        if (raw) {
            cached = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
            return cached;
        }
    } catch (e) { /* ignore */ }
    cached = { ...DEFAULT_SETTINGS };
    return cached;
}

export function saveSettings(patch) {
    const current = getSettings();
    cached = { ...current, ...patch };
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(cached));
    } catch (e) { /* ignore */ }
    applyTheme();
    return cached;
}

/**
 * Resolve current theme given setting + system preference.
 */
export function resolveTheme() {
    const s = getSettings();
    if (s.theme === 'light' || s.theme === 'dark') return s.theme;
    // auto → follow system
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
    }
    return 'light';
}

/**
 * Apply theme to document root. Called on boot and when theme changes.
 */
export function applyTheme() {
    const theme = resolveTheme();
    document.documentElement.dataset.theme = theme;
    // Also update meta theme-color for status bar
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
        meta.content = theme === 'dark' ? '#14110E' : '#F5F1E8';
    }
}

/**
 * Listen for system theme changes when user is on 'auto'.
 */
export function initThemeListener() {
    applyTheme();
    if (window.matchMedia) {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const handler = () => {
            if (getSettings().theme === 'auto') applyTheme();
        };
        if (mq.addEventListener) mq.addEventListener('change', handler);
        else if (mq.addListener) mq.addListener(handler);
    }
}
