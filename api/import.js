// api/import.js
import * as cheerio from 'cheerio';
import { createClient } from '@supabase/supabase-js';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.google.com/',
};

function parseInt2(s) {
  if (!s || s === '-') return 0;
  const n = parseInt(String(s).replace(/[.']/g, '').trim(), 10);
  return isNaN(n) ? 0 : n;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const id = parseInt(req.query.id, 10);
  if (!id) return res.status(400).json({ error: 'Missing id' });

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'Missing Supabase env vars' });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

  try {
    // 1. Profile
    const profileUrl = `https://www.transfermarkt.com/-/profil/spieler/${id}`;
    const pRes = await fetch(profileUrl, { headers: HEADERS });
    if (!pRes.ok) return res.status(pRes.status).json({ error: 'Profile blocked', status: pRes.status });
    const pHtml = await pRes.text();
    const $p = cheerio.load(pHtml);

    let name = $p('h1.data-header__headline-wrapper').text().trim();
    name = name.replace(/^#\d+\s*/, '').replace(/\s+/g, ' ').trim();

    // FIX: nationaliteit zoeken via "Citizenship" label, niet eerste vlaggetje
    // Transfermarkt heeft een info-table met labels "Date of birth/Age", "Place of birth", "Citizenship"
    let nationality = '';
    $p('span.info-table__content--regular').each((i, el) => {
      const label = $p(el).text().trim().toLowerCase();
      if (label.includes('citizenship')) {
        const valueEl = $p(el).next('span.info-table__content--bold');
        // Pak eerste vlag in die value
        const flagImg = valueEl.find('img.flaggenrahmen').first();
        if (flagImg.length) {
          nationality = flagImg.attr('title') || '';
        } else {
          nationality = valueEl.text().trim();
        }
      }
    });

    // Fallback: data-header__items label "Citizenship:"
    if (!nationality) {
      $p('li.data-header__label').each((i, el) => {
        const label = $p(el).text().trim().toLowerCase();
        if (label.includes('citizenship')) {
          const flagImg = $p(el).find('img.flaggenrahmen').first();
          if (flagImg.length) {
            nationality = flagImg.attr('title') || '';
          }
        }
      });
    }

    // Laatste fallback: alle vlaggen op de pagina, pak eerste die NIET de huidige club's land is
    if (!nationality) {
      const flags = $p('img.flaggenrahmen').toArray();
      if (flags.length > 0) {
        nationality = $p(flags[0]).attr('title') || '';
      }
    }

    const position = $p('dd.detail-position__position').first().text().trim();
    const currentClub = $p('span.data-header__club a').first().text().trim();
    const imageUrl = $p('img.data-header__profile-image').first().attr('src') || '';

    const profile = {
      id,
      name,
      nationality,
      position,
      current_club: currentClub,
      image_url: imageUrl,
      popularity: 0,
    };

    if (!name) return res.status(404).json({ error: 'No name parsed' });

    // 2. Stats
    const statsUrl = `https://www.transfermarkt.com/-/leistungsdaten/spieler/${id}/plus/0?saison=ges`;
    const sRes = await fetch(statsUrl, { headers: HEADERS });
    if (!sRes.ok) return res.status(sRes.status).json({ error: 'Stats blocked', status: sRes.status });
    const sHtml = await sRes.text();
    const $s = cheerio.load(sHtml);

    const compStats = [];
    $s('div.responsive-table').each((i, container) => {
      const $table = $s(container).find('table').first();
      $table.find('tbody tr').each((j, row) => {
        const $row = $s(row);
        const compName = $row.find('td a').first().text().trim();
        if (!compName) return;
        const cells = $row.find('td').toArray().map(c => $s(c).text().trim());
        compStats.push({
          player_id: id,
          competition: compName,
          appearances: parseInt2(cells[2]),
          goals: parseInt2(cells[3]),
          assists: parseInt2(cells[4]),
          yellow_cards: parseInt2(cells[5]),
          red_cards: parseInt2(cells[7]),
          minutes: parseInt2(cells[8]),
        });
      });
    });

    // Dedup + sommeer dubbele competities
    const seen = new Map();
    for (const s of compStats) {
      if (seen.has(s.competition)) {
        const ex = seen.get(s.competition);
        ex.appearances += s.appearances;
        ex.goals += s.goals;
        ex.assists += s.assists;
        ex.yellow_cards += s.yellow_cards;
        ex.red_cards += s.red_cards;
        ex.minutes += s.minutes;
      } else {
        seen.set(s.competition, { ...s });
      }
    }
    const uniqueStats = Array.from(seen.values());

    // 3. Push naar Supabase
    const { error: pErr } = await sb.from('players').upsert(profile);
    if (pErr) return res.status(500).json({ error: 'Supabase player insert', details: pErr });

    if (uniqueStats.length) {
      const { error: sErr } = await sb.from('player_competition_stats').upsert(uniqueStats);
      if (sErr) return res.status(500).json({ error: 'Supabase stats insert', details: sErr });
    }

    return res.status(200).json({
      success: true,
      player: profile,
      competitions: uniqueStats.length,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
