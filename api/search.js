// api/search.js
// Vercel serverless function: zoek voetballers op naam via Transfermarkt
// GET /api/search?q=ronaldo

import * as cheerio from 'cheerio';

export default async function handler(req, res) {
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

    const seenIds = new Set();
    const players = [];

    // Transfermarkt search results: eerste tabel.items bevat spelers
    // Elke speler heeft 1 hoofdrij + soms een uitklapbare detailrij
    // We willen alleen de hoofdrij (heeft een img.bilderrahmen-fixed met portrait)
    $('table.items').first().find('tbody > tr').each((i, row) => {
      const $row = $(row);

      // Skip detailrijen — die hebben geen portretfoto
      const portrait = $row.find('img.bilderrahmen-fixed').first();
      if (!portrait.length) return;

      // Player ID + naam uit de portret-image link
      // De img.bilderrahmen-fixed heeft data-src met /portrait/medium/{id}-...
      const portraitSrc = portrait.attr('data-src') || portrait.attr('src') || '';
      const idMatch = portraitSrc.match(/\/(\d+)-/);
      let id = idMatch ? parseInt(idMatch[1], 10) : null;

      // Fallback: zoek de eerste link naar /spieler/{id}
      if (!id) {
        const linkHref = $row.find('a[href*="/profil/spieler/"]').first().attr('href') || '';
        const altMatch = linkHref.match(/\/spieler\/(\d+)/);
        if (altMatch) id = parseInt(altMatch[1], 10);
      }

      if (!id || seenIds.has(id)) return;
      seenIds.add(id);

      // Naam: zoek de eerste link naar /profil/spieler/
      const nameLink = $row.find('a[href*="/profil/spieler/"]').first();
      const name = nameLink.text().trim();
      if (!name) return;

      // Positie: tabel kolom structuur is meestal:
      // [portret] [naam+positie] [leeftijd] [nationaliteit] [club]
      // De naam-cell bevat naam in een link en positie eronder als plain text
      const nameCell = nameLink.closest('td');
      let position = '';
      // Probeer position uit table.inline-table (typisch transfermarkt structuur)
      const inlineRow = nameCell.find('table.inline-table tr').eq(1);
      if (inlineRow.length) {
        position = inlineRow.text().trim();
      } else {
        // Fallback: pak alle text uit de cell, verwijder de naam
        const cellText = nameCell.text().trim();
        position = cellText.replace(name, '').trim();
      }

      // Leeftijd / geboortedatum (volgende cell na naam-cell, of zoek naar td met datum)
      const allCells = $row.find('td');
      let birth = '';
      allCells.each((idx, c) => {
        const txt = $(c).text().trim();
        // Geboortedatum patroon: "Mar 14, 2003 (22)" of "(22)"
        if (/\(\d{1,2}\)/.test(txt) && txt.length < 30) {
          birth = txt;
          return false;
        }
      });

      // Nationaliteit uit vlag-img title
      const nationality = $row.find('img.flaggenrahmen').first().attr('title') || '';

      // Huidige club: laatste img die geen vlag is
      let club = '';
      $row.find('img').each((idx, img) => {
        const $img = $(img);
        if ($img.hasClass('flaggenrahmen') || $img.hasClass('bilderrahmen-fixed')) return;
        const alt = $img.attr('title') || $img.attr('alt') || '';
        if (alt && !alt.toLowerCase().includes('flag')) {
          club = alt;
          return false;
        }
      });

      players.push({ id, name, position, birth, nationality, club });
    });

    return res.status(200).json({ query, players: players.slice(0, 15) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
