// api/national.js
// GET /api/national?id=8198
// Returns national team caps + goals per country

import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const id = parseInt(req.query.id, 10);
  if (!id) return res.status(400).json({ error: 'Missing or invalid id' });

  try {
    const url = `https://www.transfermarkt.com/-/nationalmannschaft/spieler/${id}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Blocked', status: response.status });
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Per nationaal team is er een sectie/box. We zoeken alle headers/labels
    // die een team-naam bevatten en de bijbehorende stats.
    // Transfermarkt toont per nationaal team een table met "Detailed stats" die
    // totalen heeft voor caps + goals.

    const teams = [];

    // Aanpak: zoek alle tabellen met header info die "matches" en "goals" kolommen hebben
    // De pagina heeft per team een box met h2/h3 voor de teamnaam en daaronder de stats
    $('div.box').each((i, box) => {
      const $box = $(box);
      const header = $box.find('h2.content-box-headline, h2, h3').first().text().trim();

      // Zoek tabel binnen de box
      const $table = $box.find('table.items, table').first();
      if (!$table.length) return;

      // Pak de footer/totaal row
      const $tfoot = $table.find('tfoot tr').first();
      let totalCaps = 0, totalGoals = 0;

      if ($tfoot.length) {
        const cells = $tfoot.find('td');
        cells.each((j, cell) => {
          const txt = $(cell).text().trim();
          if (/^\d+$/.test(txt)) {
            const n = parseInt(txt, 10);
            if (totalCaps === 0) totalCaps = n;
            else if (totalGoals === 0) totalGoals = n;
          }
        });
      }

      if (totalCaps > 0 && header) {
        teams.push({ team: header, caps: totalCaps, goals: totalGoals });
      }
    });

    // Fallback: parse uit data-header-style sectie als boven niks oplevert
    if (teams.length === 0) {
      // Transfermarkt heeft soms een "Players in his/her current squad" infobox
      // met direct caps/goals erin
      $('span.data-header__content').each((i, el) => {
        const $el = $(el);
        const text = $el.text().trim();
        // Zoek patronen zoals "Caps: 226" / "Goals: 143"
        const capsMatch = text.match(/(\d+)\s*caps?/i);
        const goalsMatch = text.match(/(\d+)\s*goals?/i);
        if (capsMatch || goalsMatch) {
          teams.push({
            team: 'Senior',
            caps: capsMatch ? parseInt(capsMatch[1], 10) : 0,
            goals: goalsMatch ? parseInt(goalsMatch[1], 10) : 0,
          });
        }
      });
    }

    return res.status(200).json({ id, teams, source_url: url });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
