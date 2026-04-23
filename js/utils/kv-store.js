// Key/value storage abstraction.
//
// Uses Capacitor's Preferences plugin when available (the iOS/Android
// native-preferences backend), falling back to the browser's localStorage
// when running as a plain web app. Every caller in the app (scores, streaks,
// achievements, settings, day-scoped celebration flag) goes through here so
// that the iOS build automatically picks up durable, OS-managed storage
// instead of relying on the WebView's localStorage, which iOS can evict
// under storage pressure.

let prefs = null;
try {
    if (typeof window !== 'undefined' && window.Capacitor?.Plugins?.Preferences) {
        prefs = window.Capacitor.Plugins.Preferences;
    }
} catch (e) { /* ignore */ }

export function isNative() {
    return !!prefs;
}

export async function kvGet(key) {
    if (prefs) {
        const { value } = await prefs.get({ key });
        return value;
    }
    try { return localStorage.getItem(key); } catch (e) { return null; }
}

export async function kvSet(key, value) {
    if (prefs) {
        await prefs.set({ key, value });
        return;
    }
    try { localStorage.setItem(key, value); } catch (e) { /* quota */ }
}

export async function kvRemove(key) {
    if (prefs) {
        await prefs.remove({ key });
        return;
    }
    try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
}

/**
 * List all keys in the store. On web this iterates localStorage directly;
 * on iOS/Android via Capacitor it uses Preferences.keys().
 */
export async function kvKeys() {
    if (prefs) {
        try {
            const { keys } = await prefs.keys();
            return keys || [];
        } catch (e) {
            return [];
        }
    }
    const out = [];
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (k) out.push(k);
        }
    } catch (e) { /* ignore */ }
    return out;
}
