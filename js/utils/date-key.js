// Date key voor daily rotation (NL tijdzone, middernacht lokaal)

/**
 * Geeft de datum-sleutel voor vandaag in YYYY-MM-DD formaat
 * Gebruikt lokale tijd (NL default zoals Wordle)
 */
export function todayKey() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/**
 * Format voor display in de UI
 * "Dinsdag 14 april 2026"
 */
export function formatDisplayDate() {
    const now = new Date();
    return now.toLocaleDateString('nl-NL', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

/**
 * Seconden tot middernacht (voor eventuele timer UI)
 */
export function secondsUntilMidnight() {
    const now = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    return Math.floor((midnight - now) / 1000);
}
