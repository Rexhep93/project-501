// Fuzzy name matching voor voetbalspelers / coaches / clubs
// Design principes:
// 1. Diakriet-tolerant (Iniesta = Iniésta)
// 2. Case-insensitive
// 3. Typefouten via Levenshtein distance (tolerant proportioneel aan lengte)
// 4. Match tegen array van aliases zodat jij controle houdt over acceptabele varianten
// 5. Achternaam auto-accept: single-word input matcht achternaam van target,
//    ook als die niet als alias staat ("Messi" voor "Lionel Messi" zonder alias)

export function normalize(str) {
    if (!str) return '';
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

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
            curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
        }
        [prev, curr] = [curr, prev];
    }
    return prev[b.length];
}

function maxDistance(target) {
    const len = target.length;
    if (len <= 4) return 0;
    if (len <= 7) return 1;
    if (len <= 11) return 2;
    return 3;
}

function matchSingle(input, target) {
    if (!input || !target) return false;
    const normInput = normalize(input);
    const normTarget = normalize(target);
    if (normInput === normTarget) return true;
    if (normInput.length < 4) return false;
    const dist = levenshtein(normInput, normTarget);
    return dist <= maxDistance(normTarget);
}

const PARTICLES = new Set([
    'de', 'van', 'der', 'den', 'du', 'la', 'le', 'da', 'do', 'dos',
    'di', 'del', 'della', 'ten', 'ter', 'op', 'in', 't', 'al', 'bin',
    'von', 'zu', 'mac', 'mc', 'o'
]);

function extractLastName(fullName) {
    const words = normalize(fullName).split(' ').filter(Boolean);
    if (words.length <= 1) return normalize(fullName);
    const result = [words[words.length - 1]];
    for (let i = words.length - 2; i >= 1; i--) {
        const lower = words[i];
        if (PARTICLES.has(lower)) {
            result.unshift(words[i]);
        } else {
            break;
        }
    }
    return result.join(' ');
}

/**
 * Match input tegen de achternaam van target.
 * "Messi" → "Lionel Messi" ✓
 * "Van Gaal" → "Louis van Gaal" ✓
 * "Cruyff" → "Johan Cruyff" ✓
 * Werkt ook wanneer target single-word is (dan is het de hele naam).
 */
function matchLastName(input, target) {
    const normInput = normalize(input);
    const normTarget = normalize(target);
    if (!normInput || !normTarget) return false;

    const lastName = extractLastName(normTarget);

    // Direct match op achternaam
    if (normInput === lastName) return true;

    // Match zonder spaties ("vangaal" = "van gaal")
    const lastNameNoSpace = lastName.replace(/\s+/g, '');
    const inputNoSpace = normInput.replace(/\s+/g, '');
    if (inputNoSpace === lastNameNoSpace) return true;

    // Fuzzy match op achternaam (min 4 chars)
    if (lastNameNoSpace.length >= 4) {
        const dist = levenshtein(inputNoSpace, lastNameNoSpace);
        if (dist <= maxDistance(lastNameNoSpace)) return true;
    }
    return false;
}

/**
 * MAIN: matcht input tegen een lijst van geldige varianten.
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

export function findMatchIndex(input, answers) {
    for (let i = 0; i < answers.length; i++) {
        if (isMatch(input, answers[i].aliases)) return i;
    }
    return -1;
}

/**
 * Returns ALL matching answer indices (for Football 10 when an input like
 * "Müller" matches multiple answers).
 */
export function findAllMatchIndices(input, answers) {
    const indices = [];
    for (let i = 0; i < answers.length; i++) {
        if (isMatch(input, answers[i].aliases)) indices.push(i);
    }
    return indices;
}
