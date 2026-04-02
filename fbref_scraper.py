"""
data_pipeline/scrapers/fbref_scraper.py

Haalt spelersstatistieken op van FBref.com voor historische seizoenen.
FBref biedt gratis CSV-export van alle spelerstabellen.

Strategie:
- Per competitie per seizoen één CSV-URL ophalen
- Parsen en opslaan in de database
- Respectvolle rate limiting (6 seconden tussen requests)

Gedekte statistieken:
- appearances, starts, minutes, goals, assists
- yellow cards, red cards, xG, xAG, shots, pass accuracy
"""

import time
import logging
import os
import io
import requests
import pandas as pd
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger(__name__)

DELAY = float(os.getenv("FBREF_DELAY_SECONDS", 6))

# FBref competitie-IDs en hun CSV-endpoint patroon
# Formaat: fbref_comp_id -> (naam, landen)
COMPETITIONS = {
    "9":  {"name": "Premier League",       "country": "England"},
    "12": {"name": "La Liga",              "country": "Spain"},
    "20": {"name": "Bundesliga",           "country": "Germany"},
    "11": {"name": "Serie A",              "country": "Italy"},
    "13": {"name": "Ligue 1",              "country": "France"},
    "23": {"name": "Eredivisie",           "country": "Netherlands"},
    "37": {"name": "Jupiler Pro League",   "country": "Belgium"},
    "32": {"name": "Primeira Liga",        "country": "Portugal"},
}

# Seizoenen om op te halen (eindejaar)
# FBref heeft data vanaf 2017-18 voor de meeste competities
SEASONS = [
    "2017-2018", "2018-2019", "2019-2020",
    "2020-2021", "2021-2022", "2022-2023",
    "2023-2024", "2024-2025",
]

# Mapping van FBref kolomnamen naar onze databasekolommen
COLUMN_MAP = {
    "Player":       "name",
    "Nation":       "nationality",
    "Pos":          "position",
    "Squad":        "club_name",
    "Age":          "age",
    "MP":           "appearances",
    "Starts":       "starts",
    "Min":          "minutes_played",
    "Gls":          "goals",
    "Ast":          "assists",
    "CrdY":         "yellow_cards",
    "CrdR":         "red_cards",
    "xG":           "xg",
    "xAG":          "xag",
    "Sh":           "shots",
    "SoT":          "shots_on_target",
    "PasTotCmp%":   "pass_accuracy",
    # FBref player-URL voor unieke ID
    "player_url":   "fbref_player_url",
}


def build_csv_url(comp_id: str, season: str) -> str:
    """
    Bouw de FBref CSV-export URL op voor een competitie + seizoen.
    
    FBref CSV-export URLs hebben dit patroon:
    https://fbref.com/en/comps/{comp_id}/{season}/stats/players/{season}-{comp_name}-Stats.csv
    
    We gebruiken de 'standard stats' tabel die goals/assists/appearances bevat.
    """
    # Seizoen formaat: "2023-2024" -> "2023-2024"
    return (
        f"https://fbref.com/en/comps/{comp_id}/{season}/stats/"
        f"players/{season}-stats-Standard.csv"
    )


def fetch_csv(url: str) -> pd.DataFrame | None:
    """
    Haal een CSV op van FBref en geef een DataFrame terug.
    Retourneert None bij fouten.
    """
    headers = {
        # Identificeer ons netjes — FBref blokkeert bots zonder user-agent
        "User-Agent": (
            "Mozilla/5.0 (compatible; Football501DataPipeline/1.0; "
            "Educational project; contact via GitHub)"
        )
    }

    try:
        logger.info(f"  Ophalen: {url}")
        response = requests.get(url, headers=headers, timeout=30)

        if response.status_code == 429:
            logger.warning("  ⚠️  Rate limited (429). Wacht 60 seconden...")
            time.sleep(60)
            return fetch_csv(url)  # Retry

        if response.status_code == 404:
            logger.warning(f"  ⚠️  Niet gevonden (404): {url}")
            return None

        response.raise_for_status()

        # FBref CSV heeft soms een dubbele header — pandas kan dat aan
        df = pd.read_csv(
            io.StringIO(response.text),
            header=0,
            on_bad_lines="skip",
        )

        # Verwijder rijen die de kolomnamen herhalen (FBref eigenaardigheid)
        df = df[df["Player"] != "Player"].copy()

        logger.info(f"  ✅ {len(df)} spelers opgehaald")
        return df

    except requests.RequestException as e:
        logger.error(f"  ❌ Request fout: {e}")
        return None
    except Exception as e:
        logger.error(f"  ❌ Parse fout: {e}")
        return None


def clean_dataframe(df: pd.DataFrame, comp_id: str, season: str) -> list[dict]:
    """
    Schoon het ruwe FBref DataFrame op en zet het om naar een lijst van dicts
    klaar voor database-insert.
    """
    records = []

    # Selecteer alleen de kolommen die we kennen
    available_cols = [c for c in COLUMN_MAP.keys() if c in df.columns]
    df = df[available_cols].copy()
    df = df.rename(columns=COLUMN_MAP)

    # Verwijder rijen zonder spelernaam
    df = df[df["name"].notna() & (df["name"].str.strip() != "")]

    for _, row in df.iterrows():
        record = {
            "fbref_comp_id": comp_id,
            "season": season,
        }

        # Veld-voor-veld verwerken met type conversie
        record["name"]          = str(row.get("name", "")).strip()
        record["nationality"]   = str(row.get("nationality", "")).strip()[:2] if row.get("nationality") else None
        record["position"]      = str(row.get("position", "")).strip()
        record["club_name"]     = str(row.get("club_name", "")).strip()

        # Numerieke velden — sommige zijn leeg of "N/A" bij FBref
        int_fields = [
            "appearances", "starts", "minutes_played",
            "goals", "assists", "yellow_cards", "red_cards",
            "shots", "shots_on_target",
        ]
        for field in int_fields:
            val = row.get(field)
            try:
                record[field] = int(float(str(val).replace(",", ""))) if pd.notna(val) and str(val) not in ["", "N/A"] else 0
            except (ValueError, TypeError):
                record[field] = 0

        float_fields = ["xg", "xag", "pass_accuracy"]
        for field in float_fields:
            val = row.get(field)
            try:
                record[field] = float(str(val).replace(",", "")) if pd.notna(val) and str(val) not in ["", "N/A"] else None
            except (ValueError, TypeError):
                record[field] = None

        records.append(record)

    return records


def scrape_competition_season(comp_id: str, season: str) -> list[dict]:
    """
    Haal alle spelersdata op voor één competitie + seizoen combinatie.
    """
    url = build_csv_url(comp_id, season)
    df = fetch_csv(url)

    if df is None or df.empty:
        return []

    records = clean_dataframe(df, comp_id, season)
    return records


def scrape_all(
    competitions: dict = None,
    seasons: list = None,
    output_dir: str = "data_pipeline/raw_data"
) -> dict:
    """
    Hoofdfunctie: haalt alle competities x seizoenen op.
    
    Slaat ruwe data op als CSV in output_dir voor backup.
    Retourneert een dict {(comp_id, season): [records]}.
    """
    if competitions is None:
        competitions = COMPETITIONS
    if seasons is None:
        seasons = SEASONS

    os.makedirs(output_dir, exist_ok=True)
    all_data = {}
    total = len(competitions) * len(seasons)
    done = 0

    logger.info(f"🚀 Start FBref scrape: {len(competitions)} competities × {len(seasons)} seizoenen = {total} requests")
    logger.info(f"   Geschatte tijd: ~{total * DELAY / 60:.0f} minuten")

    for comp_id, comp_info in competitions.items():
        for season in seasons:
            done += 1
            logger.info(f"\n[{done}/{total}] {comp_info['name']} — {season}")

            records = scrape_competition_season(comp_id, season)

            if records:
                key = (comp_id, season)
                all_data[key] = records

                # Sla ook op als CSV backup
                csv_path = os.path.join(
                    output_dir,
                    f"fbref_{comp_id}_{season.replace('/', '-')}.csv"
                )
                pd.DataFrame(records).to_csv(csv_path, index=False)
                logger.info(f"   💾 Opgeslagen: {csv_path}")

            # Respecteer rate limiting — FBref vraagt dit expliciet
            if done < total:
                logger.debug(f"   ⏳ Wacht {DELAY}s...")
                time.sleep(DELAY)

    logger.info(f"\n✅ FBref scrape klaar. {len(all_data)} datasets opgehaald.")
    return all_data


if __name__ == "__main__":
    # Test met één competitie/seizoen
    logger.info("Test run: Eredivisie 2023-2024")
    records = scrape_competition_season("23", "2023-2024")
    if records:
        print(f"Eerste speler: {records[0]}")
        print(f"Totaal: {len(records)} spelers")
