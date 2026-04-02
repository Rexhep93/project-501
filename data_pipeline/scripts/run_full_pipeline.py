"""
data_pipeline/scripts/run_full_pipeline.py

EENMALIGE volledige import van alle historische data.
Volgorde:
  1. FBref — seizoensstatistieken (8 competities × 8 seizoenen)
  2. Transfermarkt — interland caps voor unieke spelers
  3. Carrière totalen herberekenen

Geschatte looptijd: 60–90 minuten (door rate limiting).
Draai dit één keer. Daarna wekelijkse refresh.

Gebruik:
    python data_pipeline/scripts/run_full_pipeline.py

Opties:
    --test          Alleen Eredivisie 2023-24 (snel testen)
    --skip-fbref    Sla FBref over (als al gedaan)
    --skip-tm       Sla Transfermarkt over
"""

import sys
import os
import argparse
import logging
from datetime import datetime

# Voeg de project root toe aan het path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))

from data_pipeline.scrapers.fbref_scraper import (
    scrape_competition_season, scrape_all,
    COMPETITIONS, SEASONS
)
from data_pipeline.scrapers.transfermarkt_scraper import scrape_players_batch
from data_pipeline.loaders.db_loader import (
    save_fbref_season, save_transfermarkt_profiles,
    finalize_career_totals, get_connection
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(f"pipeline_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"),
    ]
)
logger = logging.getLogger(__name__)


def get_unique_player_names_from_db() -> list[str]:
    """Haal alle unieke spelernamen op uit de database voor Transfermarkt lookup."""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT DISTINCT name FROM players
            WHERE transfermarkt_id IS NULL
            ORDER BY name
            """
        )
        names = [row[0] for row in cursor.fetchall()]
        cursor.close()
        return names
    finally:
        conn.close()


def run_fbref_phase(test_mode: bool = False):
    """Fase 1: Haal alle FBref data op."""
    logger.info("=" * 60)
    logger.info("FASE 1: FBref — Seizoensstatistieken")
    logger.info("=" * 60)

    if test_mode:
        # Snel testen: alleen Eredivisie 2023-24
        logger.info("TEST MODE: Alleen Eredivisie 2023-24")
        records = scrape_competition_season("23", "2023-2024")
        if records:
            logger.info(f"Opslaan: {len(records)} spelers")
            save_fbref_season(records)
    else:
        # Volledig: alle competities × seizoenen
        all_data = scrape_all(COMPETITIONS, SEASONS)

        for (comp_id, season), records in all_data.items():
            logger.info(f"\nOpslaan: {COMPETITIONS[comp_id]['name']} {season} — {len(records)} spelers")
            save_fbref_season(records)

    logger.info("\n✅ Fase 1 klaar")


def run_transfermarkt_phase(test_mode: bool = False, max_players: int = None):
    """Fase 2: Haal Transfermarkt interland data op."""
    logger.info("=" * 60)
    logger.info("FASE 2: Transfermarkt — Interland Stats")
    logger.info("=" * 60)

    # Haal spelernamen op die nog geen Transfermarkt data hebben
    names = get_unique_player_names_from_db()
    logger.info(f"Spelers te verwerken: {len(names)}")

    if test_mode:
        # Test met bekende Nederlandse internationals
        names = ["Virgil van Dijk", "Memphis Depay", "Frenkie de Jong",
                 "Daley Blind", "Arjen Robben"]
        logger.info(f"TEST MODE: {len(names)} spelers")

    if max_players:
        names = names[:max_players]
        logger.info(f"Gelimiteerd tot {max_players} spelers")

    profiles = scrape_players_batch(names)

    if profiles:
        logger.info(f"\nOpslaan: {len(profiles)} profielen")
        save_transfermarkt_profiles(profiles)

    logger.info("\n✅ Fase 2 klaar")


def run_finalization_phase():
    """Fase 3: Carrière totalen berekenen."""
    logger.info("=" * 60)
    logger.info("FASE 3: Carrière totalen herberekenen")
    logger.info("=" * 60)
    finalize_career_totals()
    logger.info("✅ Fase 3 klaar")


def print_summary():
    """Print een samenvatting van wat er in de database zit."""
    conn = get_connection()
    try:
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) FROM players")
        player_count = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(*) FROM player_season_stats")
        stats_count = cursor.fetchone()[0]

        cursor.execute("SELECT COUNT(DISTINCT season) FROM player_season_stats")
        season_count = cursor.fetchone()[0]

        cursor.execute(
            "SELECT COUNT(*) FROM players WHERE international_caps > 0"
        )
        intl_count = cursor.fetchone()[0]

        cursor.execute(
            """
            SELECT c.name, COUNT(DISTINCT pss.player_id)
            FROM player_season_stats pss
            JOIN competitions c ON c.id = pss.competition_id
            GROUP BY c.name
            ORDER BY COUNT(DISTINCT pss.player_id) DESC
            """
        )
        per_comp = cursor.fetchall()

        cursor.close()

        logger.info("\n" + "=" * 60)
        logger.info("📊 DATABASE SAMENVATTING")
        logger.info("=" * 60)
        logger.info(f"  Spelers totaal:        {player_count:,}")
        logger.info(f"  Seizoensrecords:       {stats_count:,}")
        logger.info(f"  Seizoenen gedekt:      {season_count}")
        logger.info(f"  Met interland data:    {intl_count:,}")
        logger.info("\n  Per competitie:")
        for comp_name, count in per_comp:
            logger.info(f"    {comp_name:<25} {count:,} spelers")

    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(description="Football 501 Data Pipeline")
    parser.add_argument("--test", action="store_true",
                        help="Testmodus: alleen Eredivisie 2023-24 + 5 spelers TM")
    parser.add_argument("--skip-fbref", action="store_true",
                        help="FBref fase overslaan")
    parser.add_argument("--skip-tm", action="store_true",
                        help="Transfermarkt fase overslaan")
    parser.add_argument("--max-tm-players", type=int, default=None,
                        help="Max spelers voor Transfermarkt (budget beheer)")
    args = parser.parse_args()

    start_time = datetime.now()
    logger.info("🚀 Football 501 Full Pipeline Gestart")
    logger.info(f"   Tijd: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info(f"   Modus: {'TEST' if args.test else 'VOLLEDIG'}")

    try:
        if not args.skip_fbref:
            run_fbref_phase(test_mode=args.test)

        if not args.skip_tm:
            run_transfermarkt_phase(
                test_mode=args.test,
                max_players=args.max_tm_players
            )

        run_finalization_phase()
        print_summary()

    except KeyboardInterrupt:
        logger.warning("\n⏹️  Pipeline onderbroken door gebruiker")
        logger.info("De al opgeslagen data blijft behouden.")
        logger.info("Herstart het script om verder te gaan.")
        sys.exit(1)
    except Exception as e:
        logger.error(f"\n❌ Onverwachte fout: {e}", exc_info=True)
        sys.exit(1)

    duration = datetime.now() - start_time
    logger.info(f"\n🏁 Pipeline klaar in {duration}")


if __name__ == "__main__":
    main()
