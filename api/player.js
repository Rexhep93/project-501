// api/player.js
// Vercel serverless function: haal carrière stats van een speler op
// GET /api/player?id=8198

import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const id = parseInt(req.query.id, 10);
  if (!id) {
    return res.status(400).json({ error: 'Missing or invalid id' });
  }

  try {
    // Transfermarkt "Performance Data" pagina heeft alle club + competitie stats
    // URL format: https://www.transfermarkt.com/-/leistungsdaten/spieler/{id}/plus/0?saison=ges
    // saison=ges = "all seasons" (totalen per competitie)
    const url = `https://www.transfermarkt.com/-/leistungsdaten/spieler/${id}/plus/0?saison=ges`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Transfermarkt blocked request',
        status: response.status,
      });
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Speler naam uit pagina header
    const name = $('h1.data-header__headline-wrapper').text().trim()
              || $('h1').first().text().trim();

    // De pagina bevat meerdere clubs/secties. Elke club heeft een tabel met
    // per competitie: appearances, goals, assists, yellow, red, minutes
    // We parsen alle tabellen en groeperen per club + competitie

    const clubs = [];

    // Zoek alle "responsive-table" containers met carrière data
    $('div.responsive-table').each((i, container) => {
      const $container = $(container);
      const $table = $container.find('table').first();
      if (!$table.length) return;

      // Header van de sectie staat boven de tabel
      const sectionTitle = $container.prev('h2').text().trim()
                        || $container.parent().prev('h2').text().trim();

      // Per rij: competitie + stats
      const competitions = [];
      $table.find('tbody tr').each((j, row) => {
        const $row = $(row);
        const cells = $row.find('td');

        // Competitie naam staat meestal in een link in de tweede cell
        const compName = $row.find('td a').first().text().trim()
                      || $row.find('td').eq(1).text().trim();

        if (!compName) return;

        // Stats kolommen (volgorde varieert per type speler):
        // appearances, goals, assists, OG, sub-on, sub-off, yellow, 2nd yellow, red, PK, minutes
        const stats = [];
        cells.each((k, cell) => {
          stats.push($(cell).text().trim());
        });

        competitions.push({ competition: compName, raw: stats });
      });

      if (competitions.length) {
        clubs.push({ section: sectionTitle, competitions });
      }
    });

    return res.status(200).json({
      id,
      name,
      clubs,
      source_url: url,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
