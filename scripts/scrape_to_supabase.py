"""
scrape_to_supabase.py

Scraped een lijst van bekende voetballers van Transfermarkt en pusht ze naar Supabase.
Run dit eenmalig in Codespace om de database te vullen.

Gebruik:
    pip install requests beautifulsoup4 supabase
    python scripts/scrape_to_supabase.py
"""

import os
import re
import time
import requests
from bs4 import BeautifulSoup
from supabase import create_client

# ============================================================
# CONFIG — vul jouw Supabase secret key in
# ============================================================
SUPABASE_URL = "https://hcwbscithijjrajadqko.supabase.co"
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.google.com/',
}

DELAY = 2  # seconden tussen requests om Transfermarkt niet te overbelasten

# ============================================================
# TEST BATCH: 20 bekende spelers
# ============================================================
TEST_PLAYERS = [
    8198,    # Cristiano Ronaldo
    28003,   # Lionel Messi
    342229,  # Erling Haaland
    418560,  # Kylian Mbappé
    406625,  # Vinicius Junior
    27992,   # Karim Benzema
    27580,   # Luka Modric
    44352,   # Neymar
    44352,   # Robert Lewandowski (test dup)
    132098,  # Mohamed Salah
    132098,  # Harry Kane
    314353,  # Bruno Fernandes
    16306,   # Sergio Ramos
    21908,   # Manuel Neuer
    7607,    # Memphis Depay
    65230,   # Virgil van Dijk
    207927,  # Frenkie de Jong
    433177,  # Matthijs de Ligt
    383787,  # Donyell Malen
    548336,  # Cody Gakpo
]

# Dedupe
TEST_PLAYERS = list(set(TEST_PLAYERS))

# ============================================================
# SCRAPE FUNCTIES
# ============================================================

def scrape_player_profile(player_id):
    """Haal basisinfo op (naam, nationaliteit, positie, geboortedatum)"""
    url = f"https://www.transfermarkt.com/-/profil/spieler/{player_id}"
    r = requests.get(url, headers=HEADERS)
    if r.status_code != 200:
        print(f"  ❌ Profile {player_id}: HTTP {r.status_code}")
        return None

    soup = BeautifulSoup(r.text, 'html.parser')

    # Naam
    name_el = soup.select_one('h1.data-header__headline-wrapper')
    name = name_el.get_text(strip=True) if name_el else ''
    name = re.sub(r'^#\d+\s*', '', name).strip()

    # Info uit data-header
    info = {}
    for li in soup.select('span.info-table__content'):
        pass  # complex parsen, voor nu simpel

    # Nationaliteit uit vlaggetjes
    flag = soup.select_one('span.data-header__content img.flaggenrahmen')
    nationality = flag.get('title', '') if flag else ''

    # Positie
    pos_el = soup.select_one('dd.detail-position__position')
    position = pos_el.get_text(strip=True) if pos_el else ''

    # Geboortedatum
    dob = None
    for span in soup.select('span.info-table__content--bold'):
        text = span.get_text(strip=True)
        m = re.match(r'(\w+)\s+(\d+),\s*(\d{4})', text)
        if m:
            try:
                from datetime import datetime
                dob = datetime.strptime(text.split('(')[0].strip(), '%b %d, %Y').date().isoformat()
                break
            except:
                pass

    # Huidige club uit header
    club_el = soup.select_one('span.data-header__club a')
    current_club = club_el.get_text(strip=True) if club_el else ''

    # Image
    img_el = soup.select_one('img.data-header__profile-image')
    image_url = img_el.get('src', '') if img_el else ''

    return {
        'id': player_id,
        'name': name,
        'nationality': nationality,
        'position': position,
        'date_of_birth': dob,
        'current_club': current_club,
        'image_url': image_url,
        'popularity': 0,
    }


def scrape_player_stats(player_id):
    """Haal carrière stats per competitie op"""
    url = f"https://www.transfermarkt.com/-/leistungsdaten/spieler/{player_id}/plus/0?saison=ges"
    r = requests.get(url, headers=HEADERS)
    if r.status_code != 200:
        print(f"  ❌ Stats {player_id}: HTTP {r.status_code}")
        return []

    soup = BeautifulSoup(r.text, 'html.parser')
    competitions = []

    for container in soup.select('div.responsive-table'):
        table = container.select_one('table')
        if not table:
            continue
        for row in table.select('tbody tr'):
            cells = row.find_all('td')
            if len(cells) < 8:
                continue
            link = row.select_one('td a')
            if not link:
                continue
            comp_name = link.get_text(strip=True)
            if not comp_name:
                continue

            def parse_int(s):
                if not s or s == '-':
                    return 0
                cleaned = re.sub(r"[.']", '', str(s)).strip()
                try:
                    return int(cleaned)
                except:
                    return 0

            stats = [c.get_text(strip=True) for c in cells]
            # Layout: [icon, name, apps, goals, assists, yellow, 2nd_yellow, red, minutes]
            # Maar varieert per type speler. We pakken op index.
            try:
                competitions.append({
                    'competition': comp_name,
                    'appearances': parse_int(stats[2]) if len(stats) > 2 else 0,
                    'goals': parse_int(stats[3]) if len(stats) > 3 else 0,
                    'assists': parse_int(stats[4]) if len(stats) > 4 else 0,
                    'yellow_cards': parse_int(stats[5]) if len(stats) > 5 else 0,
                    'red_cards': parse_int(stats[7]) if len(stats) > 7 else 0,
                    'minutes': parse_int(stats[8]) if len(stats) > 8 else 0,
                })
            except Exception as e:
                print(f"  ⚠️  Parse error: {e}")

    return competitions


# ============================================================
# MAIN
# ============================================================
def main():
    print(f"🔌 Connecting to Supabase...")
    sb = create_client(SUPABASE_URL, SUPABASE_KEY)

    success = 0
    failed = 0

    for i, pid in enumerate(TEST_PLAYERS):
        print(f"\n[{i+1}/{len(TEST_PLAYERS)}] Player ID {pid}")

        # Profile
        profile = scrape_player_profile(pid)
        if not profile or not profile['name']:
            print(f"  ❌ Geen profile data")
            failed += 1
            continue
        print(f"  ✓ {profile['name']} ({profile['nationality']})")

        # Insert player
        try:
            sb.table('players').upsert(profile).execute()
        except Exception as e:
            print(f"  ❌ Insert player failed: {e}")
            failed += 1
            continue

        time.sleep(DELAY)

        # Stats
        stats = scrape_player_stats(pid)
        print(f"  ✓ {len(stats)} competities")

        if stats:
            rows = [{'player_id': pid, **s} for s in stats]
            try:
                sb.table('player_competition_stats').upsert(rows).execute()
            except Exception as e:
                print(f"  ⚠️  Stats insert failed: {e}")

        success += 1
        time.sleep(DELAY)

    print(f"\n{'='*50}")
    print(f"✅ Klaar: {success} success, {failed} failed")


if __name__ == '__main__':
    main()
