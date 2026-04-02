"""
data_pipeline/scrapers/transfermarkt_scraper.py

Haalt spelersprofielen en interlandstatistieken op van Transfermarkt.
Dit is de beste gratis bron voor:
  - Interland caps (aantal gespeelde interlandwedstrijden)
  - Interlandgoals
  - Spelersprofiel (geboortedatum, nationaliteit, positie)
  - Marktwaarde (bonus — leuk voor extra categorie)

Aanpak:
  1. Zoek spelers op via naam (vanuit FBref data)
  2. Haal profiel + interland stats op
  3. Match met bestaande spelers in database via naam

Rate limiting: 4 seconden tussen requests — Transfermarkt is streng.
"""

import time
import logging
import os
import re
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger(__name__)

DELAY = float(os.getenv("TRANSFERMARKT_DELAY_SECONDS", 4))

BASE_URL = "https://www.transfermarkt.com"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Referer": "https://www.transfermarkt.com/",
}


def search_player(name: str) -> list[dict]:
    """
    Zoek een speler op Transfermarkt via naam.
    Retourneert een lijst van resultaten met url, naam, club, nationaliteit.
    """
    url = f"{BASE_URL}/schnellsuche/ergebnis/schnellsuche"
    params = {"query": name, "Spieler_page": "0"}

    try:
        response = requests.get(url, params=params, headers=HEADERS, timeout=15)
        response.raise_for_status()
    except requests.RequestException as e:
        logger.error(f"  Zoekfout voor '{name}': {e}")
        return []

    soup = BeautifulSoup(response.text, "lxml")
    results = []

    # Zoekresultaten staan in een tabel met class "items"
    table = soup.find("table", class_="items")
    if not table:
        return []

    rows = table.find_all("tr", class_=["odd", "even"])
    for row in rows:
        cells = row.find_all("td")
        if len(cells) < 3:
            continue

        name_cell = row.find("td", class_="hauptlink")
        if not name_cell:
            continue

        link = name_cell.find("a")
        if not link:
            continue

        player_url = BASE_URL + link.get("href", "")
        player_name = link.get_text(strip=True)

        # Nationaliteit
        nat_img = row.find("img", class_="flagge")
        nationality = nat_img.get("title", "") if nat_img else ""

        results.append({
            "name": player_name,
            "url": player_url,
            "nationality": nationality,
        })

    return results


def get_player_profile(player_url: str) -> dict | None:
    """
    Haal het volledige spelersprofiel op van Transfermarkt.
    Inclusief interland caps en goals.
    
    Returns dict met:
    - name, full_name, birth_date, nationality, position
    - transfermarkt_id
    - international_caps, international_goals, national_team
    - market_value (bonus)
    """
    try:
        response = requests.get(player_url, headers=HEADERS, timeout=15)
        response.raise_for_status()
    except requests.RequestException as e:
        logger.error(f"  Profielfout voor {player_url}: {e}")
        return None

    soup = BeautifulSoup(response.text, "lxml")

    profile = {
        "transfermarkt_url": player_url,
        "transfermarkt_id": _extract_tm_id(player_url),
    }

    # --- Naam ---
    name_el = soup.find("h1", class_="data-header__headline-wrapper")
    if name_el:
        profile["name"] = name_el.get_text(strip=True)

    # --- Profiel info box ---
    info_table = soup.find("div", class_="info-table")
    if info_table:
        rows = info_table.find_all("span", class_="info-table__content")
        labels = info_table.find_all("span", class_="info-table__content--bold")

        # Parse key-value pairs
        items = {}
        label_els = info_table.find_all("span", class_=["info-table__content--regular"])
        for el in info_table.find_all("li", class_="info-table__list-item"):
            label_el = el.find("span", class_="info-table__content--regular")
            value_el = el.find("span", class_="info-table__content--bold")
            if label_el and value_el:
                items[label_el.get_text(strip=True)] = value_el.get_text(strip=True)

        if "Date of birth:" in items:
            profile["birth_date_str"] = items["Date of birth:"]
        if "Position:" in items:
            profile["position"] = _normalize_position(items.get("Position:", ""))
        if "Citizenship:" in items:
            profile["nationality"] = items["Citizenship:"]

    # --- Interland statistieken ---
    # Transfermarkt toont een "National team career" sectie
    intl_section = soup.find("div", {"id": "national-career"})
    if intl_section:
        intl_data = _parse_international_stats(intl_section)
        profile.update(intl_data)

    # Alternatief: zoek in de "career stats" tabel
    if "international_caps" not in profile:
        intl_data = _parse_career_stats_for_intl(soup)
        profile.update(intl_data)

    return profile


def _extract_tm_id(url: str) -> str | None:
    """Extract Transfermarkt speler-ID uit URL."""
    match = re.search(r"/spieler/(\d+)", url)
    return match.group(1) if match else None


def _normalize_position(raw: str) -> str:
    """Normaliseer Transfermarkt positie naar GK/DF/MF/FW."""
    raw = raw.lower()
    if "goalkeeper" in raw or "keeper" in raw:
        return "GK"
    elif any(x in raw for x in ["back", "defender", "centre-back", "libero"]):
        return "DF"
    elif any(x in raw for x in ["midfield", "midfielder"]):
        return "MF"
    elif any(x in raw for x in ["forward", "winger", "striker", "attack"]):
        return "FW"
    return "MF"  # Default


def _parse_international_stats(section) -> dict:
    """
    Parse de interland-sectie van een Transfermarkt spelerspagina.
    Geeft caps en goals terug voor het nationaal team.
    """
    result = {
        "international_caps": 0,
        "international_goals": 0,
        "national_team": None,
    }

    rows = section.find_all("tr")
    for row in rows:
        cells = row.find_all("td")
        if len(cells) < 4:
            continue

        # Zoek naar 'total' rij of gewoon de eerste nationale ploeg
        team_cell = cells[0].get_text(strip=True)
        if not team_cell or team_cell.lower() in ["", "national team"]:
            continue

        try:
            # Kolom volgorde: team | jaar | wedstrijden | goals
            apps_text = cells[2].get_text(strip=True).replace("-", "0")
            goals_text = cells[3].get_text(strip=True).replace("-", "0")
            apps = int(apps_text) if apps_text.isdigit() else 0
            goals = int(goals_text) if goals_text.isdigit() else 0

            # Neem het hoogste (= eerste, meestal hoofdnationaal team)
            if apps > result["international_caps"]:
                result["international_caps"] = apps
                result["international_goals"] = goals
                result["national_team"] = team_cell
        except (ValueError, IndexError):
            continue

    return result


def _parse_career_stats_for_intl(soup) -> dict:
    """
    Fallback: zoek interland info in de algemene career stats tabel.
    """
    result = {}

    # Zoek naar de stats tabel met nationalteam rijen
    career_table = soup.find("div", class_="grid-view")
    if not career_table:
        return result

    # Zoek rijen met "national" in de tekst
    for row in career_table.find_all("tr"):
        cells = row.find_all("td")
        if not cells:
            continue
        row_text = row.get_text().lower()
        if "national" in row_text or "international" in row_text:
            # Laatste kolommen zijn doorgaans apps en goals
            nums = []
            for cell in cells:
                text = cell.get_text(strip=True).replace("-", "0")
                if text.isdigit():
                    nums.append(int(text))
            if len(nums) >= 2:
                result["international_caps"] = nums[-2]
                result["international_goals"] = nums[-1]
            break

    return result


def scrape_players_batch(player_names: list[str], max_players: int = None) -> list[dict]:
    """
    Haal profielen op voor een lijst van spelernamen.
    
    Voor elke naam:
    1. Zoek op Transfermarkt
    2. Neem het eerste resultaat (beste match)
    3. Haal profiel op
    
    Args:
        player_names: lijst van spelernamen (uit FBref data)
        max_players: optioneel limiet (handig voor testen)
    
    Returns:
        lijst van spelersprofielen
    """
    if max_players:
        player_names = player_names[:max_players]

    profiles = []
    total = len(player_names)

    logger.info(f"🚀 Start Transfermarkt scrape: {total} spelers")
    logger.info(f"   Geschatte tijd: ~{total * DELAY * 2 / 60:.0f} minuten")

    for i, name in enumerate(player_names, 1):
        logger.info(f"[{i}/{total}] {name}")

        # Stap 1: Zoek
        time.sleep(DELAY)
        results = search_player(name)

        if not results:
            logger.warning(f"  Niet gevonden: {name}")
            continue

        # Neem het eerste resultaat
        best_match = results[0]
        logger.debug(f"  Match: {best_match['name']} ({best_match['url']})")

        # Stap 2: Profiel ophalen
        time.sleep(DELAY)
        profile = get_player_profile(best_match["url"])

        if profile:
            profile["search_name"] = name  # Oorspronkelijke naam voor matching
            profiles.append(profile)
            logger.info(f"  ✅ Caps: {profile.get('international_caps', 0)}, Goals: {profile.get('international_goals', 0)}")
        else:
            logger.warning(f"  Profiel ophalen mislukt voor: {name}")

    logger.info(f"\n✅ Transfermarkt scrape klaar. {len(profiles)} profielen opgehaald.")
    return profiles


if __name__ == "__main__":
    # Test met een paar bekende spelers
    test_players = ["Virgil van Dijk", "Memphis Depay", "Frenkie de Jong"]
    logger.info("Test run Transfermarkt scraper...")
    profiles = scrape_players_batch(test_players, max_players=3)
    for p in profiles:
        print(f"\n{p.get('name')}: {p.get('international_caps')} caps, {p.get('international_goals')} goals")
