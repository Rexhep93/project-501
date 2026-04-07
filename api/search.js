// api/search.js
import * as cheerio from 'cheerio';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,nl;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Cache-Control': 'no-cache',
  'Pragma': 'no-cache',
  'Sec-Ch-Ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"macOS"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
  'Referer': 'https://www.google.com/',
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const query = (req.query.q || '').trim();
  if (query.length < 2) return res.status(400).json({ error: 'Query too short' });

  try {
    const searchUrl = `https://www.transfermarkt.com/schnellsuche/ergebnis/schnellsuche?query=${encodeURIComponent(query)}`;
    const response = await fetch(searchUrl, { headers: HEADERS });

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

    $('table.items').first().find('tbody > tr').each((i, row) => {
      const $row = $(row);
      const portrait = $row.find('img.bilderrahmen-fixed').first();
      if (!portrait.length) return;

      const portraitSrc = portrait.attr('data-src') || portrait.attr('src') || '';
      const idMatch = portraitSrc.match(/\/(\d+)-/);
      let id = idMatch ? parseInt(idMatch[1], 10) : null;

      if (!id) {
        const linkHref = $row.find('a[href*="/profil/spieler/"]').first().attr('href') || '';
        const altMatch = linkHref.match(/\/spieler\/(\d+)/);
        if (altMatch) id = parseInt(altMatch[1], 10);
      }

      if (!id || seenIds.has(id)) return;
      seenIds.add(id);

      const nameLink = $row.find('a[href*="/profil/spieler/"]').first();
      const name = nameLink.text().trim();
      if (!name) return;

      const nationality = $row.find('img.flaggenrahmen').first().attr('title') || '';

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

      players.push({ id, name, nationality, club });
    });

    return res.status(200).json({ query, players: players.slice(0, 15) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
