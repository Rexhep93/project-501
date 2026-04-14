// Fuzzy name matching voor voetbalspelers / coaches / clubs
// Design principes:
// 1. Diakriet-tolerant (Iniesta = Iniésta)
// 2. Case-insensitive
// 3. Typefouten via Levenshtein distance (tolerant proportioneel aan lengte)
// 4. Match tegen array van aliases zodat jij controle houdt over acceptabele varianten

/**
 * Normaliseer een string: lowercase, geen diakriet, geen dubbele spaties
 */
export function normalize(str) {
    if (!str) return '';
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Verwijder diakriet
        .replace(/[^\w\s-]/g, ' ')        // Verwijder speciale tekens (behalve - en _)
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Levenshtein distance tussen twee strings
 * Efficiente implementatie met single-array memory
 */
function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    let prev = new Array(b.length + 1);
    let curr = new Array(b.length + 1);

    for (let j = 0; j <= b.length; j++) prev[j] = j;

    for (let i = 1; i <= a.length; i++) {
        curr[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            curr[j] = Math.min(
                curr[j - 1] + 1,      // insertion
                prev[j] + 1,          // deletion
                prev[j - 1] + cost    // substitution
            );
        }
        [prev, curr] = [curr, prev];
    }

    return prev[b.length];
}

/**
 * Bereken maximale toegestane "afstand" op basis van lengte van target
 * - Korte strings (≤4): geen typefouten toegestaan
 * - 5-7 chars: 1 typefout
 * - 8-11 chars: 2 typefouten
 * - 12+ chars: 3 typefouten
 * Dit voorkomt false positives bij korte namen zoals "Kane"
 */
function maxDistance(target) {
    const len = target.length;
    if (len <= 4) return 0;
    if (len <= 7) return 1;
    if (len <= 11) return 2;
    return 3;
}

/**
 * Check of input matcht met één target string (strict niveau met fuzzy marge)
 */
function matchSingle(input, target) {
    if (!input || !target) return false;
    const normInput = normalize(input);
    const normTarget = normalize(target);

    if (normInput === normTarget) return true;

    // Bij korte input (< 4 chars) geen fuzzy — te gevaarlijk
    if (normInput.length < 4) return false;

    // Levenshtein check
    const dist = levenshtein(normInput, normTarget);
    return dist <= maxDistance(normTarget);
}

/**
 * Nederlandse/Europese tussenvoegsels die we als onderdeel van achternaam behandelen
 */
const PARTICLES = new Set([
    'de', 'van', 'der', 'den', 'du', 'la', 'le', 'da', 'do', 'dos',
    'di', 'del', 'della', 'ten', 'ter', 'op', 'in', 't', 'al', 'bin',
    'von', 'zu', 'mac', 'mc', 'o'
]);

/**
 * Extract achternaam uit volledige naam, incl. tussenvoegsels
 * "Louis van Gaal" -> "van Gaal"
 * "Ronald Koeman" -> "Koeman"
 * "Frank de Boer" -> "de Boer"
 * "Xavi Hernández" -> "Hernández"
 */
function extractLastName(fullName) {
    const words = fullName.split(' ').filter(Boolean);
    if (words.length <= 1) return fullName;

    // Loop van rechts naar links, verzamel achternaam + alle voorafgaande tussenvoegsels
    const result = [words[words.length - 1]];
    for (let i = words.length - 2; i >= 1; i--) {
        const lower = words[i].toLowerCase();
        if (PARTICLES.has(lower)) {
            result.unshift(words[i]);
        } else {
            break;
        }
    }
    return result.join(' ');
}

/**
 * Strip achternaam-only check: match input tegen de achternaam van de target
 * (inclusief tussenvoegsels zoals "van Gaal", "de Boer")
 */
function matchLastName(input, target) {
    const normInput = normalize(input);
    const normTarget = normalize(target);

    if (!normTarget.includes(' ')) return false;

    // Extract achternaam (met tussenvoegsels)
    const lastName = extractLastName(normTarget);

    if (lastName === normTarget) return false; // hele naam, geen partial match

    // Direct match op achternaam
    if (normInput === lastName) return true;

    // Match zonder spaties ("vangaal" = "van gaal")
    const lastNameNoSpace = lastName.replace(/\s+/g, '');
    const inputNoSpace = normInput.replace(/\s+/g, '');
    if (inputNoSpace === lastNameNoSpace) return true;

    // Fuzzy match op achternaam (min 4 chars zonder spaties)
    if (lastNameNoSpace.length >= 4) {
        const dist = levenshtein(inputNoSpace, lastNameNoSpace);
        if (dist <= maxDistance(lastNameNoSpace)) return true;
    }

    return false;
}

/**
 * MAIN: Check of een user input matcht met een antwoord
 *
 * @param {string} input - Wat de gebruiker typt
 * @param {string[]} aliases - Array van acceptabele varianten (eerste = display name)
 * @returns {boolean}
 */
export function isMatch(input, aliases) {
    if (!input || !aliases || !aliases.length) return false;
    const trimmedInput = input.trim();
    if (!trimmedInput) return false;

    for (const alias of aliases) {
        if (matchSingle(trimmedInput, alias)) return true;
        if (matchLastName(trimmedInput, alias)) return true;
    }

    return false;
}

/**
 * Check tegen een hele lijst met antwoorden (voor Tenable)
 * Returnt de index van het matchende antwoord, of -1
 *
 * @param {string} input
 * @param {Array<{aliases: string[]}>} answers
 * @returns {number} index van match, of -1
 */
export function findMatchIndex(input, answers) {
    for (let i = 0; i < answers.length; i++) {
        if (isMatch(input, answers[i].aliases)) return i;
    }
    return -1;
}
