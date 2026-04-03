"""
build_db.py

Download de Transfermarkt dataset via Kaggle en verwerk tot game_data.json.

Gebruik (in Codespace terminal):
    pip install kagglehub pandas
    python scripts/build_db.py

Vereist Kaggle credentials:
    export KAGGLE_USERNAME="jouw_username"
    export KAGGLE_KEY="jouw_key"
"""

import os
import json
import time
import kagglehub
import pandas as pd
from pathlib import Path

# ============================================================
# CONFIG
# ============================================================

KAGGLE_DATASET = "xfkzujqjvx97n/football-datasets"
OUTPUT_FILE = Path(__file__).parent.parent / "data" / "game_data.json"

# Competities die we opnemen (competition_id → leesbare naam)
COMPETITIONS = {
    "GB1": "Premier League",
    "ES1": "LaLiga",
    "L1":  "Bundesliga",
    "IT1": "Serie A",
    "FR1": "Ligue 1",
    "NL1": "Eredivisie",
    "CL":  "Champions League",
    "EL":  "Europa League",
    "SC1": "Scottish Premiership",
    "PO1": "Primeira Liga",
    "BE1": "Jupiler Pro League",
    "TR1": "Süper Lig",
    "RU1": "Russian Premier Liga",
    "GB2": "Championship",
    "WM":  "World Cup",
    "EM":  "European Championship",
}

MIN_APPEARANCES = 10  # Minimum wedstrijden om in de database te komen


# ============================================================
# STAP 1: Download dataset via Kaggle
# ============================================================

def download_dataset():
    print("\n📥 Stap 1: Dataset downloaden van Kaggle ...")
    dataset_path = kagglehub.dataset_download(KAGGLE_DATASET)
    print(f"  ✅ Gedownload naar: {dataset_path}")
    return Path(dataset_path)


def find_csv(base_path, name):
    """Zoek een CSV bestand recursief in de dataset map."""
    for f in base_path.rglob(f"*{name}*"):
        if f.suffix == ".csv":
            return f
    for f in base_path.rglob("*.csv"):
        if name in f.stem:
            return f
    raise FileNotFoundError(f"❌ Kan '{name}.csv' niet vinden in {base_path}")


# ============================================================
# STAP 2: Laad en verwerk profielen
# ============================================================

def load_profiles(base_path):
    print("\n📋 Stap 2: Laden van player_profiles ...")
    csv_path = find_csv(base_path, "player_profiles")
    print(f"  Bestand: {csv_path}")

    df = pd.read_csv(csv_path, dtype=str, low_memory=False)
    print(f"  ✅ {len(df):,} profielen geladen")

    profiles = {}
    for _, row in df.iterrows():
        pid = str(row.get("player_id", ""))
        if not pid:
            continue
        name = str(row.get("player_name", "Unknown"))
        # Strip "(123)" suffix van naam
        if "(" in name and name.endswith(")"):
            name = name[:name.rfind("(")].strip()

        profiles[pid] = {
            "name": name,
            "nationality": str(row.get("citizenship", "") or ""),
            "position": str(row.get("main_position", "") or row.get("position", "") or ""),
            "club": str(row.get("current_club_name", "") or ""),
            "image": str(row.get("player_image_url", "") or ""),
            "dob": str(row.get("date_of_birth", "") or ""),
        }
    return profiles


# ============================================================
# STAP 3: Laad en aggregeer performances
# ============================================================

def safe_int(val):
    """Parse int, behandel '-', nan, lege strings als 0."""
    try:
        if pd.isna(val) or str(val).strip() in ("-", "", "nan"):
            return 0
        return int(float(str(val).strip()))
    except (ValueError, TypeError):
        return 0


def load_performances(base_path):
    print("\n⚽ Stap 3: Laden van player_performances ...")
    csv_path = find_csv(base_path, "player_performances")
    print(f"  Bestand: {csv_path}")

    players = {}
    chunk_size = 100_000
    total_rows = 0

    for chunk in pd.read_csv(csv_path, dtype=str, low_memory=False, chunksize=chunk_size):
        chunk = chunk[chunk['season_name'] != '25/26']
        total_rows += len(chunk)
        print(f"  ... {total_rows:,} rijen verwerkt", end="\r")

        for _, row in chunk.iterrows():
            pid = str(row.get("player_id", ""))
            if not pid:
                continue

            comp_id = str(row.get("competition_id", ""))
            team_name = str(row.get("team_name", "") or "")
            apps = safe_int(row.get("nb_in_group"))
            goals = safe_int(row.get("goals"))
            assists = safe_int(row.get("assists"))
            yellows = safe_int(row.get("yellow_cards"))
            reds = safe_int(row.get("direct_red_cards")) + safe_int(row.get("second_yellow_cards"))
            minutes = safe_int(row.get("minutes_played"))
            clean_sheets = safe_int(row.get("clean_sheets"))

            if apps == 0:
                continue

            if pid not in players:
                players[pid] = {
                    "byComp": {},
                    "byTeam": {},
                    "career": {"apps": 0, "goals": 0, "assists": 0, "yellows": 0, "reds": 0, "minutes": 0, "cs": 0},
                }
            p = players[pid]

            # Career totals
            p["career"]["apps"] += apps
            p["career"]["goals"] += goals
            p["career"]["assists"] += assists
            p["career"]["yellows"] += yellows
            p["career"]["reds"] += reds
            p["career"]["minutes"] += minutes
            p["career"]["cs"] += clean_sheets

            # Per competition
            comp_name = COMPETITIONS.get(comp_id)
            if comp_name:
                if comp_name not in p["byComp"]:
                    p["byComp"][comp_name] = {"apps": 0, "goals": 0, "assists": 0, "yellows": 0, "reds": 0, "cs": 0}
                c = p["byComp"][comp_name]
                c["apps"] += apps
                c["goals"] += goals
                c["assists"] += assists
                c["yellows"] += yellows
                c["reds"] += reds
                c["cs"] += clean_sheets

            # Per team
            if team_name:
                if team_name not in p["byTeam"]:
                    p["byTeam"][team_name] = {"apps": 0, "goals": 0, "assists": 0}
                t = p["byTeam"][team_name]
                t["apps"] += apps
                t["goals"] += goals
                t["assists"] += assists

    print(f"\n  ✅ {total_rows:,} rijen verwerkt")
    print(f"  📊 {len(players):,} unieke spelers met data")
    return players


# ============================================================
# STAP 4: Laad national team data
# ============================================================

def load_national_team(base_path):
    print("\n🌍 Stap 4: Laden van player_national_team_performances ...")
    csv_path = find_csv(base_path, "player_national_performances")
    print(f"  Bestand: {csv_path}")

    df = pd.read_csv(csv_path, dtype=str, low_memory=False)
    print(f"  ✅ {len(df):,} rijen geladen")

    intl = {}
    for _, row in df.iterrows():
        pid = str(row.get("player_id", ""))
        if not pid:
            continue
        caps = safe_int(row.get("matches"))
        goals = safe_int(row.get("goals"))

        if pid not in intl:
            intl[pid] = {"caps": 0, "goals": 0}
        intl[pid]["caps"] += caps
        intl[pid]["goals"] += goals

    return intl


# ============================================================
# STAP 5: Combineer en schrijf output
# ============================================================

def build():
    start = time.time()
    print("🏗️  Voetbal 501 — Data Builder (Python)")
    print("=" * 45)

    # Download
    base_path = download_dataset()

    # Load
    profiles = load_profiles(base_path)
    performances = load_performances(base_path)
    national_team = load_national_team(base_path)

    # Combine
    print("\n🔧 Stap 5: Combineren en filteren ...")
    game_players = []
    skipped_low = 0
    skipped_no_profile = 0

    for pid, perf in performances.items():
        intl = national_team.get(pid, {"caps": 0, "goals": 0})

        # Totale appearances = club + interland
        total_apps = perf["career"]["apps"] + intl["caps"]

        if total_apps < MIN_APPEARANCES:
            skipped_low += 1
            continue

        profile = profiles.get(pid)
        if not profile:
            skipped_no_profile += 1
            continue

        player = {
            "id": pid,
            "n": profile["name"],
            "nat": profile["nationality"],
            "pos": profile["position"],
            "club": profile["club"],
            "img": profile["image"],
            # Career totals (club + interland gecombineerd)
            "ca": perf["career"]["apps"] + intl["caps"],       # total appearances
            "cg": perf["career"]["goals"] + intl["goals"],     # total goals
            "cas": perf["career"]["assists"],                   # assists (alleen club, interland heeft geen assists data)
            "cy": perf["career"]["yellows"],
            "cr": perf["career"]["reds"],
            "cm": perf["career"]["minutes"],
            "ccs": perf["career"]["cs"],
            # International apart (voor aparte categorieën)
            "ic": intl["caps"],
            "ig": intl["goals"],
            # Club-only apart (voor aparte categorieën)
            "cla": perf["career"]["apps"],
            "clg": perf["career"]["goals"],
        }

        # Per-competition
        if perf["byComp"]:
            player["comp"] = {}
            for comp_name, stats in perf["byComp"].items():
                player["comp"][comp_name] = {
                    "a": stats["apps"],
                    "g": stats["goals"],
                    "as": stats["assists"],
                    "y": stats["yellows"],
                    "r": stats["reds"],
                    "cs": stats["cs"],
                }

        # Per-team (top 5 by appearances)
        if perf["byTeam"]:
            sorted_teams = sorted(perf["byTeam"].items(), key=lambda x: x[1]["apps"], reverse=True)[:5]
            player["teams"] = {}
            for team_name, stats in sorted_teams:
                player["teams"][team_name] = {
                    "a": stats["apps"],
                    "g": stats["goals"],
                    "as": stats["assists"],
                }

        game_players.append(player)

    # Sorteer op total appearances
    game_players.sort(key=lambda x: x["ca"], reverse=True)

    print(f"  ✅ {len(game_players):,} spelers in game database")
    print(f"  ⏭️  {skipped_low:,} overgeslagen (< {MIN_APPEARANCES} apps)")
    print(f"  ⏭️  {skipped_no_profile:,} overgeslagen (geen profiel)")

    # Categorieën
    categories = [
        # Totaal (club + interland)
        {"id": "total_goals", "label": "Total Goals", "desc": "Totaal goals (club + interland)", "stat": "cg"},
        {"id": "total_apps", "label": "Total Appearances", "desc": "Totaal wedstrijden (club + interland)", "stat": "ca"},
        # Club-only
        {"id": "club_goals", "label": "Club Goals", "desc": "Goals in clubcarrière", "stat": "clg"},
        {"id": "club_apps", "label": "Club Appearances", "desc": "Wedstrijden in clubcarrière", "stat": "cla"},
        {"id": "career_assists", "label": "Career Assists", "desc": "Totaal assists in clubcarrière", "stat": "cas"},
        {"id": "career_yellows", "label": "Career Yellow Cards", "desc": "Totaal gele kaarten", "stat": "cy"},
        {"id": "career_reds", "label": "Career Red Cards", "desc": "Totaal rode kaarten", "stat": "cr"},
        {"id": "career_clean_sheets", "label": "Career Clean Sheets", "desc": "Totaal clean sheets", "stat": "ccs"},
        # International
        {"id": "intl_caps", "label": "International Caps", "desc": "Aantal interlands", "stat": "ic"},
        {"id": "intl_goals", "label": "International Goals", "desc": "Aantal interlandgoals", "stat": "ig"},
    ]

    for comp_id, comp_name in COMPETITIONS.items():
        categories.extend([
            {"id": f"{comp_id}_goals", "label": f"{comp_name} Goals", "desc": f"Goals in de {comp_name}", "comp": comp_name, "stat": "g"},
            {"id": f"{comp_id}_apps", "label": f"{comp_name} Appearances", "desc": f"Wedstrijden in de {comp_name}", "comp": comp_name, "stat": "a"},
            {"id": f"{comp_id}_assists", "label": f"{comp_name} Assists", "desc": f"Assists in de {comp_name}", "comp": comp_name, "stat": "as"},
        ])

    # Schrijf output
    print("\n💾 Stap 6: Schrijven van game_data.json ...")
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    output = {
        "version": 1,
        "generated": pd.Timestamp.now().isoformat(),
        "totalPlayers": len(game_players),
        "categories": categories,
        "players": game_players,
    }

    json_str = json.dumps(output, ensure_ascii=False)
    OUTPUT_FILE.write_text(json_str, encoding="utf-8")

    size_mb = len(json_str.encode("utf-8")) / 1024 / 1024
    elapsed = time.time() - start

    print(f"  ✅ Geschreven: {OUTPUT_FILE}")
    print(f"  📦 Bestandsgrootte: {size_mb:.1f} MB")
    print(f"\n{'=' * 45}")
    print(f"📊 Samenvatting:")
    print(f"  Spelers:      {len(game_players):,}")
    print(f"  Categorieën:  {len(categories)}")
    print(f"  Bestand:      {size_mb:.1f} MB")
    print(f"  Tijd:         {elapsed:.1f}s")
    print(f"{'=' * 45}")

    # Voorbeelden
    print("\n🔍 Top 5 spelers (by total appearances):")
    for p in game_players[:5]:
        print(f"  {p['n']} — {p['ca']} apps ({p['cla']} club + {p['ic']} intl), {p['cg']} goals ({p['clg']} club + {p['ig']} intl)")


if __name__ == "__main__":
    build()
