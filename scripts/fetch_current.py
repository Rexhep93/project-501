"""
fetch_current.py

Haal seizoen 25/26 data op via API-Football en voeg toe aan game_data.json.
Draait als GitHub Action (wekelijks) of handmatig.

Gebruik:
    export API_FOOTBALL_KEY="jouw_key"
    python scripts/fetch_current.py

Gratis plan: 100 requests/dag, 20 spelers per pagina.
Strategie: verspreid over meerdere dagen via GitHub Actions.
"""

import os
import json
import time
import requests
import unicodedata
from pathlib import Path

# ============================================================
# CONFIG
# ============================================================

API_KEY = os.environ.get("API_FOOTBALL_KEY", "")
BASE_URL = "https://v3.football.api-sports.io"
SEASON = 2025  # API-Football gebruikt het startjaar (2025 = seizoen 25/26)

DATA_DIR = Path(__file__).parent.parent / "data"
GAME_DATA_FILE = DATA_DIR / "game_data.json"
CURRENT_SEASON_FILE = DATA_DIR / "current_season.json"
MERGE_LOG_FILE = DATA_DIR / "merge_log.json"

# Competities om op te halen (API-Football league IDs)
# We doen max 2-3 per dag om binnen 100 calls te blijven
LEAGUES = {
    39:  {"name": "Premier League",       "tm_id": "GB1"},
    140: {"name": "LaLiga",               "tm_id": "ES1"},
    78:  {"name": "Bundesliga",           "tm_id": "L1"},
    135: {"name": "Serie A",              "tm_id": "IT1"},
    61:  {"name": "Ligue 1",             "tm_id": "FR1"},
    88:  {"name": "Eredivisie",           "tm_id": "NL1"},
    2:   {"name": "Champions League",     "tm_id": "CL"},
    3:   {"name": "Europa League",        "tm_id": "EL"},
    179: {"name": "Scottish Premiership", "tm_id": "SC1"},
    94:  {"name": "Primeira Liga",        "tm_id": "PO1"},
    144: {"name": "Jupiler Pro League",   "tm_id": "BE1"},
    203: {"name": "Süper Lig",            "tm_id": "TR1"},
    40:  {"name": "Championship",         "tm_id": "GB2"},
}

# Hoeveel competities per run (past binnen 100 calls/dag)
LEAGUES_PER_RUN = 2

# ============================================================
# API HELPERS
# ============================================================

call_count = 0

def api_get(endpoint, params):
    """Doe een API-Football request met rate limiting."""
    global call_count

    if not API_KEY:
        print("❌ API_FOOTBALL_KEY niet gezet!")
        exit(1)

    headers = {"x-apisports-key": API_KEY}
    url = f"{BASE_URL}/{endpoint}"

    time.sleep(1)  # Rate limit: max 10 requests/minuut op gratis plan
    resp = requests.get(url, headers=headers, params=params)
    call_count += 1

    if resp.status_code != 200:
        print(f"  ❌ HTTP {resp.status_code}: {resp.text[:200]}")
        return None

    data = resp.json()

    # Check voor API errors
    if data.get("errors"):
        print(f"  ❌ API error: {data['errors']}")
        return None

    remaining = resp.headers.get("x-ratelimit-remaining", "?")
    print(f"  [Call #{call_count}, remaining: {remaining}]", end="")

    return data


def fetch_league_players(league_id, season):
    """Haal alle spelers op voor een competitie. Pagineert automatisch."""
    all_players = []
    page = 1

    while True:
        print(f"  Pagina {page}...", end="")
        data = api_get("players", {"league": league_id, "season": season, "page": page})

        if not data:
            break

        players = data.get("response", [])
        if not players:
            print(" (leeg)")
            break

        all_players.extend(players)
        total_pages = data.get("paging", {}).get("total", 1)
        print(f" ({len(players)} spelers, pagina {page}/{total_pages})")

        if page >= total_pages:
            break
        page += 1

    return all_players


# ============================================================
# NAME MATCHING (API-Football ↔ Transfermarkt)
# ============================================================

def normalize_name(name):
    """Normaliseer naam voor matching: lowercase, geen accenten, geen extra spaties."""
    if not name:
        return ""
    # NFD normalisatie: split accenten van basisletter
    normalized = unicodedata.normalize("NFD", name)
    # Verwijder accent-tekens
    stripped = "".join(c for c in normalized if unicodedata.category(c) != "Mn")
    # Lowercase, strip whitespace
    return stripped.lower().strip()


def build_name_index(game_data):
    """Bouw een lookup index van Transfermarkt spelers op genormaliseerde naam."""
    index = {}
    for i, player in enumerate(game_data["players"]):
        key = normalize_name(player["n"])
        if key not in index:
            index[key] = []
        index[key].append(i)
    return index


def match_player(api_player, name_index, game_players):
    """Probeer een API-Football speler te matchen met een Transfermarkt speler."""
    api_name = api_player.get("player", {}).get("name", "")
    api_firstname = api_player.get("player", {}).get("firstname", "")
    api_lastname = api_player.get("player", {}).get("lastname", "")
    api_birth = api_player.get("player", {}).get("birth", {}).get("date", "")

    # Strategie 1: Exacte naam match
    key = normalize_name(api_name)
    if key in name_index:
        candidates = name_index[key]
        if len(candidates) == 1:
            return candidates[0]
        # Meerdere matches: gebruik geboortedatum als tiebreaker
        if api_birth:
            for idx in candidates:
                tm_player = game_players[idx]
                # Transfermarkt dob format: "1985-02-05" of "05.02.1985"
                if api_birth in str(tm_player.get("dob", "")):
                    return idx
        # Geef eerste terug als geen dob match
        return candidates[0]

    # Strategie 2: Voornaam + achternaam combinatie
    if api_firstname and api_lastname:
        full = normalize_name(f"{api_firstname} {api_lastname}")
        if full in name_index:
            return name_index[full][0]

    # Strategie 3: Alleen achternaam (met extra checks)
    if api_lastname:
        last_key = normalize_name(api_lastname)
        # Zoek in alle namen die eindigen op deze achternaam
        for name_key, indices in name_index.items():
            if name_key.endswith(last_key) and len(indices) == 1:
                return indices[0]

    return None  # Geen match gevonden


# ============================================================
# MERGE LOGIC
# ============================================================

def merge_current_season(game_data, current_data):
    """Voeg 25/26 seizoensdata toe aan game_data spelers."""
    name_index = build_name_index(game_data)
    game_players = game_data["players"]

    matched = 0
    unmatched = 0
    unmatched_names = []

    for league_id, league_data in current_data.items():
        league_name = LEAGUES.get(int(league_id), {}).get("name", f"League {league_id}")
        print(f"\n  Merging {league_name}...")

        for api_player in league_data:
            stats_list = api_player.get("statistics", [])
            if not stats_list:
                continue

            # Zoek de stats voor deze specifieke competitie
            stats = stats_list[0]
            games = stats.get("games", {})
            goals_data = stats.get("goals", {})
            cards = stats.get("cards", {})

            apps = games.get("appearences", 0) or 0
            goals = goals_data.get("total", 0) or 0
            assists = goals_data.get("assists", 0) or 0
            yellows = (cards.get("yellow", 0) or 0)
            reds = (cards.get("red", 0) or 0) + (cards.get("yellowred", 0) or 0)
            minutes = games.get("minutes", 0) or 0

            if apps == 0:
                continue

            # Match met Transfermarkt speler
            idx = match_player(api_player, name_index, game_players)

            if idx is not None:
                p = game_players[idx]

                # Voeg 25/26 stats toe aan career totals
                p["ca"] += apps
                p["cg"] += goals
                p["cas"] += assists
                p["cy"] += yellows
                p["cr"] += reds
                p["cm"] += minutes
                p["cla"] += apps
                p["clg"] += goals

                # Voeg toe aan per-competition stats
                if "comp" not in p:
                    p["comp"] = {}
                tm_comp = LEAGUES.get(int(league_id), {}).get("name", "")
                if tm_comp:
                    if tm_comp not in p["comp"]:
                        p["comp"][tm_comp] = {"a": 0, "g": 0, "as": 0, "y": 0, "r": 0, "cs": 0}
                    p["comp"][tm_comp]["a"] += apps
                    p["comp"][tm_comp]["g"] += goals
                    p["comp"][tm_comp]["as"] += assists
                    p["comp"][tm_comp]["y"] += yellows
                    p["comp"][tm_comp]["r"] += reds

                matched += 1
            else:
                unmatched += 1
                api_name = api_player.get("player", {}).get("name", "Unknown")
                if len(unmatched_names) < 50:
                    unmatched_names.append(f"{api_name} ({apps} apps, {goals} goals)")

    print(f"\n  ✅ Matched: {matched}")
    print(f"  ❌ Unmatched: {unmatched}")
    if unmatched_names:
        print(f"  Voorbeelden ongematchte spelers:")
        for name in unmatched_names[:10]:
            print(f"    - {name}")

    return {"matched": matched, "unmatched": unmatched, "unmatched_examples": unmatched_names}


# ============================================================
# MAIN: FETCH + MERGE
# ============================================================

def determine_leagues_to_fetch():
    """Bepaal welke competities we deze run ophalen (roulerend schema)."""
    state_file = DATA_DIR / "fetch_state.json"
    league_ids = list(LEAGUES.keys())

    if state_file.exists():
        state = json.loads(state_file.read_text())
        last_index = state.get("last_index", 0)
    else:
        last_index = 0

    start = last_index
    end = min(start + LEAGUES_PER_RUN, len(league_ids))
    selected = league_ids[start:end]

    # Wrap around als we aan het einde zijn
    if end >= len(league_ids):
        next_index = 0
    else:
        next_index = end

    # Sla state op
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    state_file.write_text(json.dumps({"last_index": next_index}))

    return selected


def main():
    print("⚽ Voetbal 501 — Current Season Fetcher")
    print("=" * 45)

    if not API_KEY:
        print("❌ Stel API_FOOTBALL_KEY in als environment variable")
        print("   export API_FOOTBALL_KEY='jouw_key'")
        exit(1)

    # Bepaal welke competities we ophalen
    leagues_to_fetch = determine_leagues_to_fetch()
    print(f"\n📋 Competities deze run: {[LEAGUES[lid]['name'] for lid in leagues_to_fetch]}")

    # Laad bestaande current season data (of start leeg)
    if CURRENT_SEASON_FILE.exists():
        current_data = json.loads(CURRENT_SEASON_FILE.read_text())
    else:
        current_data = {}

    # Fetch elke competitie
    for league_id in leagues_to_fetch:
        league_info = LEAGUES[league_id]
        print(f"\n🏆 {league_info['name']} (league_id={league_id})...")

        players = fetch_league_players(league_id, SEASON)
        current_data[str(league_id)] = players
        print(f"  ✅ {len(players)} spelers opgehaald")

    # Sla ruwe current season data op
    CURRENT_SEASON_FILE.parent.mkdir(parents=True, exist_ok=True)
    CURRENT_SEASON_FILE.write_text(json.dumps(current_data, ensure_ascii=False))
    print(f"\n💾 Current season data opgeslagen ({len(current_data)} competities)")

    # Check of alle competities opgehaald zijn voor merge
    fetched_leagues = set(current_data.keys())
    all_leagues = set(str(lid) for lid in LEAGUES.keys())
    missing = all_leagues - fetched_leagues

    if missing:
        missing_names = [LEAGUES[int(lid)]["name"] for lid in missing if int(lid) in LEAGUES]
        print(f"\n⏳ Nog niet alle competities opgehaald. Missend: {missing_names}")
        print(f"   Draai het script opnieuw morgen voor de volgende batch.")
        print(f"   (Of voeg --merge flag toe om toch te mergen met wat er is)")

        # Merge toch als --merge flag of als we al genoeg data hebben
        import sys
        if "--merge" not in sys.argv and len(fetched_leagues) < len(all_leagues) * 0.5:
            print(f"\n📊 API calls gebruikt: {call_count}")
            return

    # Merge met game_data.json
    print(f"\n🔧 Merging current season data met game_data.json ...")

    if not GAME_DATA_FILE.exists():
        print("❌ game_data.json niet gevonden! Draai eerst build_db.py")
        exit(1)

    game_data = json.loads(GAME_DATA_FILE.read_text())
    merge_result = merge_current_season(game_data, current_data)

    # Update version en schrijf terug
    game_data["version"] = game_data.get("version", 1) + 1
    game_data["last_api_update"] = time.strftime("%Y-%m-%dT%H:%M:%SZ")

    json_str = json.dumps(game_data, ensure_ascii=False)
    GAME_DATA_FILE.write_text(json_str, encoding="utf-8")

    size_mb = len(json_str.encode("utf-8")) / 1024 / 1024
    print(f"\n💾 game_data.json bijgewerkt ({size_mb:.1f} MB)")

    # Sla merge log op
    MERGE_LOG_FILE.write_text(json.dumps(merge_result, ensure_ascii=False, indent=2))

    print(f"\n{'=' * 45}")
    print(f"📊 Samenvatting:")
    print(f"  API calls:    {call_count}")
    print(f"  Matched:      {merge_result['matched']}")
    print(f"  Unmatched:    {merge_result['unmatched']}")
    print(f"{'=' * 45}")


if __name__ == "__main__":
    main()
