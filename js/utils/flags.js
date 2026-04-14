// ISO 3166-1 alpha-2 country code → flag emoji
// Werkt op alle moderne devices, geen externe assets nodig

/**
 * "NL" -> "🇳🇱"
 * Flag emoji's zijn opgebouwd uit 2 regional indicator symbols.
 * Code point A = U+1F1E6, dus "N"=1F1F3, "L"=1F1F1
 */
export function flagEmoji(countryCode) {
    if (!countryCode || countryCode.length !== 2) return '🏳️';
    const base = 0x1F1E6;
    const chars = countryCode.toUpperCase().split('');
    const codePoints = chars.map(c => base + (c.charCodeAt(0) - 'A'.charCodeAt(0)));
    return String.fromCodePoint(...codePoints);
}

/**
 * Mapping van ISO code naar NL landnaam (voor accessibility/tooltips)
 * Alleen de meest voorkomende voetbalnaties
 */
export const COUNTRY_NAMES_NL = {
    NL: 'Nederland', BE: 'België', DE: 'Duitsland', FR: 'Frankrijk',
    ES: 'Spanje', PT: 'Portugal', IT: 'Italië', GB: 'Verenigd Koninkrijk',
    EN: 'Engeland', SC: 'Schotland', WL: 'Wales', NI: 'Noord-Ierland',
    IE: 'Ierland', BR: 'Brazilië', AR: 'Argentinië', UY: 'Uruguay',
    CL: 'Chili', CO: 'Colombia', MX: 'Mexico', US: 'Verenigde Staten',
    CA: 'Canada', JP: 'Japan', KR: 'Zuid-Korea', CN: 'China',
    AU: 'Australië', NG: 'Nigeria', GH: 'Ghana', SN: 'Senegal',
    CI: 'Ivoorkust', MA: 'Marokko', EG: 'Egypte', DZ: 'Algerije',
    TN: 'Tunesië', CM: 'Kameroen', HR: 'Kroatië', RS: 'Servië',
    PL: 'Polen', CZ: 'Tsjechië', SK: 'Slowakije', HU: 'Hongarije',
    AT: 'Oostenrijk', CH: 'Zwitserland', SE: 'Zweden', NO: 'Noorwegen',
    DK: 'Denemarken', FI: 'Finland', IS: 'IJsland', RU: 'Rusland',
    UA: 'Oekraïne', TR: 'Turkije', GR: 'Griekenland', BG: 'Bulgarije',
    RO: 'Roemenië', AL: 'Albanië', MK: 'Noord-Macedonië', BA: 'Bosnië',
    ME: 'Montenegro', XK: 'Kosovo', CR: 'Costa Rica', CU: 'Cuba',
    EC: 'Ecuador', PE: 'Peru', VE: 'Venezuela', PY: 'Paraguay',
    BO: 'Bolivia', ZA: 'Zuid-Afrika', IR: 'Iran', IQ: 'Irak',
    SA: 'Saoedi-Arabië'
};

/**
 * Een paar veelgebruikte "landen" die ISO-codes missen of bijzonder zijn:
 * EN = Engeland, SC = Schotland, WL = Wales (binnen GB).
 * Deze bestaan NIET als officiële flag emoji (Unicode 10 tag sequences
 * worden niet overal gerenderd). Fallback: witte vlag + label.
 */
export function displayFlag(countryCode) {
    // Speciale gevallen zonder universele emoji support
    if (!countryCode) return '🏳️';
    const code = countryCode.toUpperCase();
    if (['EN', 'SC', 'WL'].includes(code)) {
        // Fallback voor britse landen: toon GB met label
        // Alternatief: embedded SVG gebruiken, maar dat vergroot bundle
        return flagEmoji('GB');
    }
    return flagEmoji(code);
}
