// api/search.js
// Vercel serverless function: zoek voetballers op naam via Transfermarkt
// GET /api/search?q=ronaldo

import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  // CORS headers zodat je ook vanaf GitHub Pages kunt aanroepen
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const query = (req.query.q || '').trim();
  if (query.length < 2) {
    return res.status(400).json({ error: 'Query too short (min 2 chars)' });
  }

  try {
    const searchUrl = `https://www.transfermarkt.com/schnellsuche/ergebnis/schnellsuche?query=${encodeURIComponent(query)}`;

    const response = await fetch(searchUrl, {
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

    const players = [];

    // Transfermarkt zoekresultaten staan in een tabel met class "items"
    // Eerste tabel = spelers
    $('table.items').first().find('tbody tr').each((i, row) => {
      const $row = $(row);

      // Speler naam + URL staan in de eerste cell met class "hauptlink"
      const linkEl = $row.find('td.hauptlink a').first();
      const name = linkEl.text().trim();
      const href = linkEl.attr('href') || '';

      // Player ID extraheren uit URL: /naam/profil/spieler/12345
      const idMatch = href.match(/\/spieler\/(\d+)/);
      if (!idMatch) return;
      const id = parseInt(idMatch[1], 10);

      // Positie staat in dezelfde cell, op de tweede regel
      const position = $row.find('td.hauptlink').first().next('td').text().trim()
                    || $row.find('td').eq(1).text().trim();

      // Geboortedatum / leeftijd
      const birthInfo = $row.find('td').eq(2).text().trim();

      // Nationaliteit (vlag image alt text)
      const nationality = $row.find('img.flaggenrahmen').first().attr('title') || '';

      // Huidige club
      const clubImg = $row.find('td').eq(4).find('img').first();
      const club = clubImg.attr('alt') || '';

      if (name && id) {
        players.push({ id, name, position, birth: birthInfo, nationality, club });
      }
    });

    return res.status(200).json({ query, players: players.slice(0, 15) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
