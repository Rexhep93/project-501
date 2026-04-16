// Flags via flagcdn.com - free, no API key.
// Supports ISO 3166-1 alpha-2 AND UK home nations (via flagcdn's special codes).
// Fallback: generic grey globe SVG for unknown codes.

// UK home nations don't have ISO codes but flagcdn supports them via 'gb-xxx' format
const UK_NATIONS = {
    EN: 'gb-eng', // England
    SC: 'gb-sct', // Scotland
    WL: 'gb-wls', // Wales
    NI: 'gb-nir'  // Northern Ireland
};

/**
 * Returns a flag URL for the given country code, or null if unknown.
 * For known codes (ISO 3166-1 alpha-2 or UK nations) returns a flagcdn URL.
 */
export function flagUrl(countryCode) {
    if (!countryCode || typeof countryCode !== 'string') return null;
    const code = countryCode.trim().toUpperCase();

    // UK home nation?
    if (UK_NATIONS[code]) {
        return `https://flagcdn.com/w80/${UK_NATIONS[code]}.png`;
    }

    // Standard ISO 3166-1 alpha-2
    if (code.length === 2 && /^[A-Z]{2}$/.test(code)) {
        return `https://flagcdn.com/w80/${code.toLowerCase()}.png`;
    }

    return null;
}

export const COUNTRY_NAMES = {
    // Europe
    NL: 'Netherlands', BE: 'Belgium', DE: 'Germany', FR: 'France',
    ES: 'Spain', PT: 'Portugal', IT: 'Italy', GB: 'United Kingdom',
    EN: 'England', SC: 'Scotland', WL: 'Wales', NI: 'Northern Ireland',
    IE: 'Ireland', HR: 'Croatia', RS: 'Serbia', PL: 'Poland',
    CZ: 'Czechia', SK: 'Slovakia', HU: 'Hungary', AT: 'Austria',
    CH: 'Switzerland', SE: 'Sweden', NO: 'Norway', DK: 'Denmark',
    FI: 'Finland', IS: 'Iceland', RU: 'Russia', UA: 'Ukraine',
    TR: 'Turkey', GR: 'Greece', BG: 'Bulgaria', RO: 'Romania',
    AL: 'Albania', MK: 'North Macedonia', BA: 'Bosnia and Herzegovina',
    ME: 'Montenegro', XK: 'Kosovo',
    // Americas
    BR: 'Brazil', AR: 'Argentina', UY: 'Uruguay', CL: 'Chile',
    CO: 'Colombia', MX: 'Mexico', US: 'United States', CA: 'Canada',
    CR: 'Costa Rica', CU: 'Cuba', EC: 'Ecuador', PE: 'Peru',
    VE: 'Venezuela', PY: 'Paraguay', BO: 'Bolivia',
    TT: 'Trinidad and Tobago',
    // Asia
    JP: 'Japan', KR: 'South Korea', CN: 'China', IR: 'Iran',
    IQ: 'Iraq', SA: 'Saudi Arabia',
    // Oceania
    AU: 'Australia',
    // Africa
    NG: 'Nigeria', GH: 'Ghana', SN: 'Senegal', CI: 'Ivory Coast',
    MA: 'Morocco', EG: 'Egypt', DZ: 'Algeria', TN: 'Tunisia',
    CM: 'Cameroon', ZA: 'South Africa'
};

export function countryName(code) {
    if (!code || typeof code !== 'string') return '';
    return COUNTRY_NAMES[code.trim().toUpperCase()] || code;
}
