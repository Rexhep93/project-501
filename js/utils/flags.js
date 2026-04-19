const UK_NATIONS = {
    EN: 'gb-eng', SC: 'gb-sct', WL: 'gb-wls', NI: 'gb-nir'
};

export function flagUrl(countryCode) {
    if (!countryCode || typeof countryCode !== 'string') return null;
    const code = countryCode.trim().toUpperCase();
    if (UK_NATIONS[code]) return `https://flagcdn.com/w80/${UK_NATIONS[code]}.png`;
    if (code.length === 2 && /^[A-Z]{2}$/.test(code)) return `https://flagcdn.com/w80/${code.toLowerCase()}.png`;
    return null;
}

export const COUNTRY_NAMES = {
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
    BR: 'Brazil', AR: 'Argentina', UY: 'Uruguay', CL: 'Chile',
    CO: 'Colombia', MX: 'Mexico', US: 'United States', CA: 'Canada',
    CR: 'Costa Rica', CU: 'Cuba', EC: 'Ecuador', PE: 'Peru',
    VE: 'Venezuela', PY: 'Paraguay', BO: 'Bolivia', TT: 'Trinidad and Tobago',
    JP: 'Japan', KR: 'South Korea', CN: 'China', IR: 'Iran',
    IQ: 'Iraq', SA: 'Saudi Arabia', AU: 'Australia',
    NG: 'Nigeria', GH: 'Ghana', SN: 'Senegal', CI: 'Ivory Coast',
    MA: 'Morocco', EG: 'Egypt', DZ: 'Algeria', TN: 'Tunisia',
    CM: 'Cameroon', ZA: 'South Africa'
};

export function countryName(code) {
    if (!code || typeof code !== 'string') return '';
    return COUNTRY_NAMES[code.trim().toUpperCase()] || code;
}
