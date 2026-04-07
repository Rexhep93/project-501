// api/player.js
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

  const id = parseInt(req.query.id, 10);
  if (!id) return res.status(400).json({ error: 'Missing id' });

  try {
    const url = `https://www.transfermarkt.com/-/leistungsdaten/spieler/${id}/plus/0?saison=ges`;
    const response = await fetch(url, { headers: HEADERS });

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Transfermarkt blocked request',
        status: response.status,
      });
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const name = $('h1.data-header__headline-wrapper').text().trim() || $('h1').first().text().trim();
    const clubs = [];

    $('div.responsive-table').each((i, container) => {
      const $container = $(container);
      const $table = $container.find('table').first();
      if (!$table.length) return;

      const sectionTitle = $container.prev('h2').text().trim() || $container.parent().prev('h2').text().trim();

      const competitions = [];
      $table.find('tbody tr').each((j, row) => {
        const $row = $(row);
        const cells = $row.find('td');
        const compName = $row.find('td a').first().text().trim() || $row.find('td').eq(1).text().trim();
        if (!compName) return;
        const stats = [];
        cells.each((k, cell) => stats.push($(cell).text().trim()));
        competitions.push({ competition: compName, raw: stats });
      });

      if (competitions.length) clubs.push({ section: sectionTitle, competitions });
    });

    return res.status(200).json({ id, name, clubs, source_url: url });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
