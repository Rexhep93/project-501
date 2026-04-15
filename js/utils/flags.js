// Flags via flagcdn.com - free, no API key, SVG circle flags
// ISO 3166-1 alpha-2 codes
export function flagUrl(countryCode) {
    if (!countryCode || countryCode.length !== 2) return null;
    const code = countryCode.toLowerCase();
    return `https://flagcdn.com/w80/${code}.png`;
}

export const COUNTRY_NAMES = {
    NL: 'Netherlands', BE: 'Belgium', DE: 'Germany', FR: 'France',
    ES: 'Spain', PT: 'Portugal', IT: 'Italy', GB: 'United Kingdom',
    EN: 'England', SC: 'Scotland', WL: 'Wales', NI: 'Northern Ireland',
    IE: 'Ireland', BR: 'Brazil', AR: 'Argentina', UY: 'Uruguay',
    CL: 'Chile', CO: 'Colombia', MX: 'Mexico', US: 'United States',
    CA: 'Canada', JP: 'Japan', KR: 'South Korea', CN: 'China',
    AU: 'Australia', NG: 'Nigeria', GH: 'Ghana', SN: 'Senegal',
    CI: "Ivory Coast", MA: 'Morocco', EG: 'Egypt', DZ: 'Algeria',
    TN: 'Tunisia', CM: 'Cameroon', HR: 'Croatia', RS: 'Serbia',
    PL: 'Poland', CZ: 'Czechia', SK: 'Slovakia', HU: 'Hungary',
    AT: 'Austria', CH: 'Switzerland', SE: 'Sweden', NO: 'Norway',
    DK: 'Denmark', FI: 'Finland', IS: 'Iceland', RU: 'Russia',
    UA: 'Ukraine', TR: 'Turkey', GR: 'Greece', BG: 'Bulgaria',
    RO: 'Romania', AL: 'Albania', MK: 'North Macedonia', BA: 'Bosnia',
    ME: 'Montenegro', XK: 'Kosovo', CR: 'Costa Rica', CU: 'Cuba',
    EC: 'Ecuador', PE: 'Peru', VE: 'Venezuela', PY: 'Paraguay',
    BO: 'Bolivia', ZA: 'South Africa', IR: 'Iran', IQ: 'Iraq',
    SA: 'Saudi Arabia', FI_: 'Finland', TT: 'Trinidad and Tobago'
};

export function countryName(code) {
    if (!code) return '';
    return COUNTRY_NAMES[code.toUpperCase()] || code;
}
