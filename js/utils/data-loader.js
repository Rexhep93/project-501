// Data loader: haalt CSV's van Google Sheets, parsed ze, vindt vandaag's rij
import { todayKey } from './date-key.js';

const SHEET_URLS = {
    tenable:     'https://docs.google.com/spreadsheets/d/e/2PACX-1vQvl7s2DII14-BJY0x5XSXsgGT847CH2BPkXAx3qGpBFdRN6hFzp2Yu--ra8S8CQXwKreUyCA7yzH6p/pub?gid=0&single=true&output=csv',
    guessPlayer: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQvl7s2DII14-BJY0x5XSXsgGT847CH2BPkXAx3qGpBFdRN6hFzp2Yu--ra8S8CQXwKreUyCA7yzH6p/pub?gid=1712109612&single=true&output=csv',
    whoAmI:      'https://docs.google.com/spreadsheets/d/e/2PACX-1vQvl7s2DII14-BJY0x5XSXsgGT847CH2BPkXAx3qGpBFdRN6hFzp2Yu--ra8S8CQXwKreUyCA7yzH6p/pub?gid=1874756698&single=true&output=csv',
    guessClub:   'https://docs.google.com/spreadsheets/d/e/2PACX-1vQvl7s2DII14-BJY0x5XSXsgGT847CH2BPkXAx3qGpBFdRN6hFzp2Yu--ra8S8CQXwKreUyCA7yzH6p/pub?gid=1260064264&single=true&output=csv',
    onThisDay:   'https://docs.google.com/spreadsheets/d/e/2PACX-1vQvl7s2DII14-BJY0x5XSXsgGT847CH2BPkXAx3qGpBFdRN6hFzp2Yu--ra8S8CQXwKreUyCA7yzH6p/pub?gid=1976129747&single=true&output=csv'
};

const CACHE_KEY = 'voetbalquiz_data_cache';
const CACHE_TTL = 6 * 60 * 60 * 1000;

function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        const next = text[i + 1];

        if (inQuotes) {
            if (c === '"' && next === '"') { field += '"'; i++; }
            else if (c === '"') { inQuotes = false; }
            else { field += c; }
        } else {
            if (c === '"') { inQuotes = true; }
            else if (c === ',') { row.push(field); field = ''; }
            else if (c === '\n' || c === '\r') {
                if (c === '\r' && next === '\n') i++;
                row.push(field);
                rows.push(row);
                row = [];
                field = '';
            } else { field += c; }
        }
    }
    if (field.length > 0 || row.length > 0) {
        row.push(field);
        rows.push(row);
    }
    return rows.filter(r => r.some(cell => cell.trim().length > 0));
}

function toObjects(rows) {
    if (rows.length < 2) return [];
    const headers = rows[0].map(h => h.trim());
    return rows.slice(1).map(row => {
        const obj = {};
        headers.forEach((h, i) => { obj[h] = (row[i] || '').trim(); });
        return obj;
    });
}

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

function findTodayRow(rows) {
    const today = todayKey();
    return rows.find(r => r.date === today) || null;
}

function parseTenableRow(row) {
    if (!row) return null;
    const answers = [];
    for (let rank = 1; rank <= 10; rank++) {
        const name = row[`answer${rank}`];
        const aliasStr = row[`aliases${rank}`] || '';
        if (!name) continue;
        const aliases = [name, ...aliasStr.split('|').map(a => a.trim()).filter(Boolean)];
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
 * On this day: date, year, headline, story
 */
function parseOnThisDayRow(row) {
    if (!row) return null;
    const year = row.year ? parseInt(row.year, 10) : null;
    return {
        date: row.date,
        year: isNaN(year) ? null : year,
        headline: row.headline || '',
        story: row.story || ''
    };
}

export async function loadTodayData() {
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

    try {
        // On this day is OPTIONAL — its fetch may fail (URL not configured yet)
        // without breaking the core 4 games.
        const onThisDayPromise = fetchSheet(SHEET_URLS.onThisDay)
            .catch(err => {
                console.warn('[DataLoader] onThisDay fetch skipped:', err.message);
                return null;
            });

        const [tenableRows, guessPlayerRows, whoAmIRows, guessClubRows, onThisDayRows] =
            await Promise.all([
                fetchSheet(SHEET_URLS.tenable),
                fetchSheet(SHEET_URLS.guessPlayer),
                fetchSheet(SHEET_URLS.whoAmI),
                fetchSheet(SHEET_URLS.guessClub),
                onThisDayPromise
            ]);

        const data = {
            tenable:     parseTenableRow(findTodayRow(tenableRows)),
            guessPlayer: parseGuessPlayerRow(findTodayRow(guessPlayerRows)),
            whoAmI:      parseWhoAmIRow(findTodayRow(whoAmIRows)),
            guessClub:   parseGuessClubRow(findTodayRow(guessClubRows)),
            onThisDay:   onThisDayRows ? parseOnThisDayRow(findTodayRow(onThisDayRows)) : getPlaceholderOnThisDay()
        };

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
        try {
            const raw = localStorage.getItem(CACHE_KEY);
            if (raw) {
                const stale = JSON.parse(raw);
                console.warn('[DataLoader] Fallback op stale cache');
                return stale.data;
            }
        } catch (e) { /* ignore */ }
        return loadSampleData();
    }
}

/**
 * Placeholder on-this-day for when sheet is not configured.
 * Rotates through a small built-in set based on day-of-year so users see
 * variety even before you've filled the sheet.
 */
function getPlaceholderOnThisDay() {
    const placeholders = [
        {
            year: 1999,
            headline: "Solskjær scores in the 93rd minute",
            story: "Manchester United completed the treble with a last-gasp winner against Bayern Munich in the Champions League final."
        },
        {
            year: 1986,
            headline: "The Hand of God",
            story: "Maradona punched the ball past Shilton, then ran half the pitch to score the Goal of the Century in the same match."
        },
        {
            year: 2005,
            headline: "The Miracle of Istanbul",
            story: "Liverpool came back from 3–0 down at half-time against AC Milan to win the Champions League on penalties."
        },
        {
            year: 1974,
            headline: "Cruyff's turn",
            story: "In a group stage match against Sweden, Johan Cruyff invented the move that would carry his name forever."
        },
        {
            year: 1950,
            headline: "The Maracanazo",
            story: "Uruguay silenced 200,000 Brazilians at the Maracanã, winning the World Cup final 2–1 on home soil."
        },
        {
            year: 2012,
            headline: "Agüerooooo",
            story: "Sergio Agüero's 94th-minute winner against QPR handed Manchester City their first league title in 44 years."
        },
        {
            year: 1970,
            headline: "The greatest team goal ever",
            story: "Brazil's fourth in the World Cup final: Clodoaldo, Rivellino, Jairzinho, Pelé, Carlos Alberto. Nine passes. One myth."
        }
    ];

    // Pick deterministically by day-of-year so it rotates daily
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now - start) / (1000 * 60 * 60 * 24));
    const item = placeholders[dayOfYear % placeholders.length];

    return {
        date: todayKey(),
        ...item
    };
}

export function loadSampleData() {
    return {
        tenable: {
            date: todayKey(),
            question: 'Most expensive signings by Premier League clubs',
            subtitle: 'From highest to lowest.',
            answers: [
                { rank: 1,  name: 'Alexander Isak',   aliases: ['Isak', 'A. Isak'] },
                { rank: 2,  name: 'Florian Wirtz',    aliases: ['Wirtz', 'F. Wirtz', 'Wirts'] },
                { rank: 3,  name: 'Moisés Caicedo',   aliases: ['Moises Caicedo', 'Caicedo', 'Moises'] },
                { rank: 4,  name: 'Enzo Fernández',   aliases: ['Enzo', 'Enzo Fernandez'] },
                { rank: 5,  name: 'Declan Rice',      aliases: ['Rice', 'Declan'] },
                { rank: 6,  name: 'Jack Grealish',    aliases: ['Grealish', 'J. Grealish'] },
                { rank: 7,  name: 'Romelu Lukaku',    aliases: ['Lukaku'] },
                { rank: 8,  name: 'Paul Pogba',       aliases: ['Pogba'] },
                { rank: 9,  name: 'Mykhailo Mudryk',  aliases: ['Mudryk', 'Mudrik'] },
                { rank: 10, name: 'Antony',           aliases: ['Antoni'] }
            ]
        },
        guessPlayer: {
            date: todayKey(),
            subtitle: 'The clubs are not in order.',
            player: 'Joao Cancelo',
            aliases: ['João Cancelo', 'Cancelo', 'J. Cancelo'],
            clubs: [
                { order: 1, name: 'Inter Milan' },
                { order: 2, name: 'Valencia' },
                { order: 3, name: 'Juventus' },
                { order: 4, name: 'Barcelona' },
                { order: 5, name: 'Manchester City' }
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
                { position: 'GK', country: 'DE' },
                { position: 'RB', country: 'BR' },
                { position: 'CB', country: 'ES' },
                { position: 'CB', country: 'AR' },
                { position: 'LB', country: 'ES' },
                { position: 'CM', country: 'HR' },
                { position: 'CM', country: 'ES' },
                { position: 'CM', country: 'ES' },
                { position: 'RW', country: 'AR' },
                { position: 'ST', country: 'UY' },
                { position: 'LW', country: 'BR' }
            ]
        },
        onThisDay: getPlaceholderOnThisDay()
    };
}
