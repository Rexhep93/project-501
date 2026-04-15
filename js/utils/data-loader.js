// Data loader: haalt CSV's van Google Sheets, parsed ze, vindt vandaag's rij
import { todayKey } from './date-key.js';

// Jouw Google Sheet URLs (pub?output=csv) - invullen voor deploy
// Per spel één sheet, of alles in één sheet met meerdere tabs
const SHEET_URLS = {
    tenable:     'REPLACE_WITH_YOUR_TENABLE_CSV_URL',
    guessPlayer: 'REPLACE_WITH_YOUR_GUESS_PLAYER_CSV_URL',
    whoAmI:      'REPLACE_WITH_YOUR_WHO_AM_I_CSV_URL',
    guessClub:   'REPLACE_WITH_YOUR_GUESS_CLUB_CSV_URL'
};

const CACHE_KEY = 'voetbalquiz_data_cache';
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 uur

/**
 * Simpele CSV parser die quoted strings en newlines binnen quotes ondersteunt
 * Geen dependency op PapaParse om bundle klein te houden
 */
function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        const next = text[i + 1];

        if (inQuotes) {
            if (c === '"' && next === '"') {
                field += '"';
                i++;
            } else if (c === '"') {
                inQuotes = false;
            } else {
                field += c;
            }
        } else {
            if (c === '"') {
                inQuotes = true;
            } else if (c === ',') {
                row.push(field);
                field = '';
            } else if (c === '\n' || c === '\r') {
                if (c === '\r' && next === '\n') i++;
                row.push(field);
                rows.push(row);
                row = [];
                field = '';
            } else {
                field += c;
            }
        }
    }
    if (field.length > 0 || row.length > 0) {
        row.push(field);
        rows.push(row);
    }

    // Filter lege rijen
    return rows.filter(r => r.some(cell => cell.trim().length > 0));
}

/**
 * Zet CSV array om naar object-array op basis van header-rij
 */
function toObjects(rows) {
    if (rows.length < 2) return [];
    const headers = rows[0].map(h => h.trim());
    return rows.slice(1).map(row => {
        const obj = {};
        headers.forEach((h, i) => {
            obj[h] = (row[i] || '').trim();
        });
        return obj;
    });
}

/**
 * Fetch één CSV, parse naar objecten
 */
async function fetchSheet(url) {
    if (!url || url.startsWith('REPLACE_')) {
        throw new Error('Sheet URL niet geconfigureerd');
    }
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Sheet fetch faalde: ${res.status}`);
    const text = await res.text();
    const rows = parseCSV(text);
    return toObjects(rows);
}

/**
 * Zoek de rij voor vandaag op basis van de 'date' kolom (YYYY-MM-DD)
 */
function findTodayRow(rows) {
    const today = todayKey();
    return rows.find(r => r.date === today) || null;
}

/**
 * Parse een Tenable-rij uit Google Sheet
 * Verwachte kolommen: date, question, subtitle, answer1..answer10, aliases1..aliases10
 * aliases zijn pipe-separated: "Ronald Koeman|Koeman|R. Koeman"
 */
function parseTenableRow(row) {
    if (!row) return null;
    const answers = [];
    for (let rank = 1; rank <= 10; rank++) {
        const name = row[`answer${rank}`];
        const aliasStr = row[`aliases${rank}`] || '';
        if (!name) continue;
        const aliases = [name, ...aliasStr.split('|').map(a => a.trim()).filter(Boolean)];
        // Dedupe
        const unique = [...new Set(aliases)];
        answers.push({ rank, name, aliases: unique });
    }
    return {
        date: row.date,
        question: row.question,
        subtitle: row.subtitle || '',
        answers
    };
}

/**
 * Guess the Player: date, player, aliases, club1..club5, years1..years5
 */
function parseGuessPlayerRow(row) {
    if (!row) return null;
    const aliases = [row.player, ...(row.aliases || '').split('|').map(a => a.trim()).filter(Boolean)];
    const clubs = [];
    for (let i = 1; i <= 5; i++) {
        const name = row[`club${i}`];
        const years = row[`years${i}`] || '';
        if (!name) continue;
        clubs.push({ order: i, name, years });
    }
    return {
        date: row.date,
        player: row.player,
        aliases: [...new Set(aliases)],
        clubs
    };
}

/**
 * Who Am I: date, player, aliases, hint1, hint2, hint3
 */
function parseWhoAmIRow(row) {
    if (!row) return null;
    const aliases = [row.player, ...(row.aliases || '').split('|').map(a => a.trim()).filter(Boolean)];
    const hints = [row.hint1, row.hint2, row.hint3].filter(Boolean);
    return {
        date: row.date,
        player: row.player,
        aliases: [...new Set(aliases)],
        hints
    };
}

/**
 * Guess the Club: date, club, aliases, year, formation, lineup
 * lineup format: "GK:DE:1|RB:BR:22|CB:ES:3|..." (11x, position:country:shirt)
 */
function parseGuessClubRow(row) {
    if (!row) return null;
    const aliases = [row.club, ...(row.aliases || '').split('|').map(a => a.trim()).filter(Boolean)];
    const lineup = (row.lineup || '').split('|').map(entry => {
        const [position, country, shirt] = entry.split(':').map(s => s.trim());
        return { position, country, shirt: shirt || '' };
    }).filter(p => p.position && p.country);

    return {
        date: row.date,
        club: row.club,
        aliases: [...new Set(aliases)],
        year: row.year || '',
        formation: row.formation || '4-3-3',
        lineup
    };
}

/**
 * Haal alle 4 de games' data op en parse vandaag's rij
 * Met cache fallback als fetch faalt
 */
export async function loadTodayData() {
    // Probeer cache
    let cached = null;
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (raw) {
            cached = JSON.parse(raw);
            if (cached.date !== todayKey()) cached = null;
            else if (Date.now() - cached.timestamp > CACHE_TTL) cached = null;
        }
    } catch (e) { /* ignore */ }

    if (cached) return cached.data;

    // Fetch parallel
    try {
        const [tenableRows, guessPlayerRows, whoAmIRows, guessClubRows] =
            await Promise.all([
                fetchSheet(SHEET_URLS.tenable),
                fetchSheet(SHEET_URLS.guessPlayer),
                fetchSheet(SHEET_URLS.whoAmI),
                fetchSheet(SHEET_URLS.guessClub)
            ]);

        const data = {
            tenable:     parseTenableRow(findTodayRow(tenableRows)),
            guessPlayer: parseGuessPlayerRow(findTodayRow(guessPlayerRows)),
            whoAmI:      parseWhoAmIRow(findTodayRow(whoAmIRows)),
            guessClub:   parseGuessClubRow(findTodayRow(guessClubRows))
        };

        // Cache
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                date: todayKey(),
                timestamp: Date.now(),
                data
            }));
        } catch (e) { /* ignore */ }

        return data;
    } catch (err) {
        console.error('[DataLoader] Fetch faalde:', err);
        // Fallback naar stale cache als die er is
        try {
            const raw = localStorage.getItem(CACHE_KEY);
            if (raw) {
                const stale = JSON.parse(raw);
                console.warn('[DataLoader] Fallback op stale cache');
                return stale.data;
            }
        } catch (e) { /* ignore */ }
        // Ultimate fallback: dev sample data
        return loadSampleData();
    }
}

/**
 * Built-in sample data for development/testing
 * Works without Google Sheet config
 */
export function loadSampleData() {
    return {
        tenable: {
            date: todayKey(),
            question: 'The 10 most recent managers of the Netherlands national team',
            subtitle: 'Rank 1 = most recent, Rank 10 = oldest',
            answers: [
                { rank: 1,  name: 'Ronald Koeman',   aliases: ['Ronald Koeman', 'Koeman'] },
                { rank: 2,  name: 'Louis van Gaal',  aliases: ['Louis van Gaal', 'van Gaal', 'Van Gaal'] },
                { rank: 3,  name: 'Frank de Boer',   aliases: ['Frank de Boer', 'de Boer', 'De Boer'] },
                { rank: 4,  name: 'Dick Advocaat',   aliases: ['Dick Advocaat', 'Advocaat'] },
                { rank: 5,  name: 'Danny Blind',     aliases: ['Danny Blind', 'Blind'] },
                { rank: 6,  name: 'Guus Hiddink',    aliases: ['Guus Hiddink', 'Hiddink'] },
                { rank: 7,  name: 'Bert van Marwijk',aliases: ['Bert van Marwijk', 'van Marwijk', 'Van Marwijk'] },
                { rank: 8,  name: 'Marco van Basten',aliases: ['Marco van Basten', 'van Basten', 'Van Basten'] },
                { rank: 9,  name: 'Foppe de Haan',   aliases: ['Foppe de Haan', 'de Haan'] },
                { rank: 10, name: 'Dick Advocaat',   aliases: ['Dick Advocaat'] }
            ]
        },
        guessPlayer: {
            date: todayKey(),
            player: 'Andrés Iniesta',
            aliases: ['Andrés Iniesta', 'Iniesta', 'Andres Iniesta'],
            clubs: [
                { order: 1, name: 'FC Barcelona B', years: '2000–2002' },
                { order: 2, name: 'FC Barcelona',   years: '2002–2018' },
                { order: 3, name: 'Vissel Kobe',    years: '2018–2023' },
                { order: 4, name: 'Emirates Club',  years: '2023–2024' }
            ]
        },
        whoAmI: {
            date: todayKey(),
            player: 'Frenkie de Jong',
            aliases: ['Frenkie de Jong', 'de Jong', 'Frenkie'],
            hints: [
                'I was born in Arkel, a small village in the Netherlands',
                'I made my breakthrough at an Amsterdam club before moving to Spain',
                'I played the Nations League final in 2019 against Portugal'
            ]
        },
        guessClub: {
            date: todayKey(),
            club: 'FC Barcelona 2014/15',
            aliases: ['FC Barcelona 2014/15', 'Barcelona 2014', 'FC Barcelona', 'Barcelona', 'Barça', 'Barca'],
            year: '2014/15',
            formation: '4-3-3',
            lineup: [
                { position: 'GK', country: 'DE', shirt: '1' },
                { position: 'RB', country: 'BR', shirt: '22' },
                { position: 'CB', country: 'ES', shirt: '3' },
                { position: 'CB', country: 'AR', shirt: '14' },
                { position: 'LB', country: 'ES', shirt: '18' },
                { position: 'CM', country: 'HR', shirt: '4' },
                { position: 'CM', country: 'ES', shirt: '5' },
                { position: 'CM', country: 'ES', shirt: '8' },
                { position: 'RW', country: 'AR', shirt: '10' },
                { position: 'ST', country: 'UY', shirt: '9' },
                { position: 'LW', country: 'BR', shirt: '11' }
            ]
        }
    };
}
