// Date utilities — YYYY-MM-DD keys in local time

export function todayKey() {
    return dateToKey(new Date());
}

export function dateToKey(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export function keyToDate(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
}

export function formatDisplayDate() {
    return new Date().toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
}

export function secondsUntilMidnight() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    return Math.floor((midnight - now) / 1000);
}

/**
 * Returns last 7 date keys, oldest first, ending with today.
 */
export function last7DateKeys() {
    const keys = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        keys.push(dateToKey(d));
    }
    return keys;
}

export function isToday(key) {
    return key === todayKey();
}

/**
 * Returns true if key is within last 7 days (inclusive of today, 6 days back).
 */
export function isWithinLast7Days(key) {
    return last7DateKeys().includes(key);
}

/**
 * Days between two keys (b - a), positive if b is later.
 */
export function daysBetween(a, b) {
    const da = keyToDate(a);
    const db = keyToDate(b);
    return Math.round((db - da) / (1000 * 60 * 60 * 24));
}
