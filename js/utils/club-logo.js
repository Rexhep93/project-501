// Club logo lookup via TheSportsDB free tier (no API key required)
const CACHE_KEY = 'club_logo_cache_v1';
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000;

let cache = null;
function loadCache() {
    if (cache) return cache;
    try { cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); }
    catch (e) { cache = {}; }
    return cache;
}
function saveCache() {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch (e) {}
}
function normalizeKey(name) {
    return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

export async function getClubLogo(clubName) {
    if (!clubName) return null;
    const key = normalizeKey(clubName);
    const c = loadCache();
    if (c[key] && (Date.now() - c[key].t) < CACHE_TTL) {
        return c[key].url || null;
    }
    try {
        const url = `https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(clubName)}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('fetch fail');
        const data = await res.json();
        const team = data.teams && data.teams[0];
        const logo = team ? (team.strBadge || team.strLogo || team.strTeamBadge) : null;
        c[key] = { url: logo, t: Date.now() };
        saveCache();
        return logo;
    } catch (e) {
        c[key] = { url: null, t: Date.now() };
        saveCache();
        return null;
    }
}
