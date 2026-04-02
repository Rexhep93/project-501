"""
data_pipeline/loaders/db_loader.py

Slaat gescrapede data op in de PostgreSQL database.
Voert upserts uit (insert or update) zodat het script
meerdere keren gedraaid kan worden zonder duplicaten.
"""

import os
import logging
import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)


def get_connection():
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise ValueError("DATABASE_URL niet ingesteld in .env")
    return psycopg2.connect(db_url)


# ──────────────────────────────────────────────
# Competities
# ──────────────────────────────────────────────

def get_competition_id(cursor, fbref_comp_id: str) -> int | None:
    cursor.execute(
        "SELECT id FROM competitions WHERE fbref_id = %s",
        (fbref_comp_id,)
    )
    row = cursor.fetchone()
    return row[0] if row else None


# ──────────────────────────────────────────────
# Clubs
# ──────────────────────────────────────────────

def upsert_club(cursor, name: str, country: str = None) -> int:
    """Voeg club in of haal bestaande ID op."""
    cursor.execute(
        """
        INSERT INTO clubs (name, country)
        VALUES (%s, %s)
        ON CONFLICT (name) DO UPDATE SET country = EXCLUDED.country
        RETURNING id
        """,
        (name, country)
    )
    # clubs heeft geen UNIQUE op name standaard — pas schema aan of gebruik SELECT
    cursor.execute("SELECT id FROM clubs WHERE name = %s", (name,))
    row = cursor.fetchone()
    return row[0] if row else None


def upsert_club_safe(cursor, name: str, country: str = None) -> int:
    """Upsert club met fallback SELECT."""
    cursor.execute("SELECT id FROM clubs WHERE name = %s LIMIT 1", (name,))
    row = cursor.fetchone()
    if row:
        return row[0]

    cursor.execute(
        "INSERT INTO clubs (name, country) VALUES (%s, %s) RETURNING id",
        (name, country)
    )
    return cursor.fetchone()[0]


# ──────────────────────────────────────────────
# Spelers
# ──────────────────────────────────────────────

def upsert_player(cursor, player_data: dict) -> int:
    """
    Voeg speler in of update bestaande.
    Identificatie via fbref_id of naam + geboortedatum.
    Retourneert het database player_id.
    """
    # Probeer eerst op fbref_id te matchen
    fbref_id = player_data.get("fbref_id")
    tm_id = player_data.get("transfermarkt_id")

    if fbref_id:
        cursor.execute("SELECT id FROM players WHERE fbref_id = %s", (fbref_id,))
        row = cursor.fetchone()
        if row:
            _update_player(cursor, row[0], player_data)
            return row[0]

    if tm_id:
        cursor.execute("SELECT id FROM players WHERE transfermarkt_id = %s", (tm_id,))
        row = cursor.fetchone()
        if row:
            _update_player(cursor, row[0], player_data)
            return row[0]

    # Fallback: match op naam (niet perfect maar goed genoeg voor historische data)
    name = player_data.get("name", "").strip()
    cursor.execute(
        "SELECT id FROM players WHERE LOWER(name) = LOWER(%s) LIMIT 1",
        (name,)
    )
    row = cursor.fetchone()
    if row:
        _update_player(cursor, row[0], player_data)
        return row[0]

    # Nieuwe speler invoegen
    cursor.execute(
        """
        INSERT INTO players (
            fbref_id, transfermarkt_id, name, nationality,
            position, birth_date, photo_url,
            international_caps, international_goals, national_team
        ) VALUES (
            %(fbref_id)s, %(transfermarkt_id)s, %(name)s, %(nationality)s,
            %(position)s, %(birth_date)s, %(photo_url)s,
            %(international_caps)s, %(international_goals)s, %(national_team)s
        )
        RETURNING id
        """,
        {
            "fbref_id": fbref_id,
            "transfermarkt_id": tm_id,
            "name": name,
            "nationality": player_data.get("nationality"),
            "position": player_data.get("position"),
            "birth_date": player_data.get("birth_date"),
            "photo_url": player_data.get("photo_url"),
            "international_caps": player_data.get("international_caps", 0),
            "international_goals": player_data.get("international_goals", 0),
            "national_team": player_data.get("national_team"),
        }
    )
    return cursor.fetchone()[0]


def _update_player(cursor, player_id: int, data: dict):
    """Update spelersgegevens, overschrijf alleen als nieuwe waarde niet leeg is."""
    updates = []
    params = []

    if data.get("fbref_id"):
        updates.append("fbref_id = %s")
        params.append(data["fbref_id"])
    if data.get("transfermarkt_id"):
        updates.append("transfermarkt_id = %s")
        params.append(data["transfermarkt_id"])
    if data.get("nationality"):
        updates.append("nationality = %s")
        params.append(data["nationality"])
    if data.get("position"):
        updates.append("position = %s")
        params.append(data["position"])
    if data.get("birth_date"):
        updates.append("birth_date = %s")
        params.append(data["birth_date"])
    if data.get("international_caps", 0) > 0:
        updates.append("international_caps = %s")
        params.append(data["international_caps"])
        updates.append("international_goals = %s")
        params.append(data.get("international_goals", 0))
        updates.append("national_team = %s")
        params.append(data.get("national_team"))

    if not updates:
        return

    updates.append("last_updated = NOW()")
    params.append(player_id)

    cursor.execute(
        f"UPDATE players SET {', '.join(updates)} WHERE id = %s",
        params
    )


# ──────────────────────────────────────────────
# Seizoensstatistieken
# ──────────────────────────────────────────────

def upsert_season_stats(cursor, player_id: int, stats: dict):
    """
    Voeg seizoensstatistieken in of update bestaande.
    """
    comp_id = get_competition_id(cursor, stats.get("fbref_comp_id"))
    if not comp_id:
        logger.warning(f"Competitie niet gevonden: {stats.get('fbref_comp_id')}")
        return

    club_name = stats.get("club_name", "").strip()
    club_id = upsert_club_safe(cursor, club_name) if club_name else None

    cursor.execute(
        """
        INSERT INTO player_season_stats (
            player_id, competition_id, club_id, season,
            appearances, starts, minutes_played,
            goals, assists, yellow_cards, red_cards,
            xg, xag, shots, shots_on_target, pass_accuracy,
            data_source, last_updated
        ) VALUES (
            %(player_id)s, %(competition_id)s, %(club_id)s, %(season)s,
            %(appearances)s, %(starts)s, %(minutes_played)s,
            %(goals)s, %(assists)s, %(yellow_cards)s, %(red_cards)s,
            %(xg)s, %(xag)s, %(shots)s, %(shots_on_target)s, %(pass_accuracy)s,
            'fbref', NOW()
        )
        ON CONFLICT (player_id, competition_id, club_id, season)
        DO UPDATE SET
            appearances     = EXCLUDED.appearances,
            starts          = EXCLUDED.starts,
            minutes_played  = EXCLUDED.minutes_played,
            goals           = EXCLUDED.goals,
            assists         = EXCLUDED.assists,
            yellow_cards    = EXCLUDED.yellow_cards,
            red_cards       = EXCLUDED.red_cards,
            xg              = EXCLUDED.xg,
            xag             = EXCLUDED.xag,
            shots           = EXCLUDED.shots,
            shots_on_target = EXCLUDED.shots_on_target,
            pass_accuracy   = EXCLUDED.pass_accuracy,
            last_updated    = NOW()
        """,
        {
            "player_id": player_id,
            "competition_id": comp_id,
            "club_id": club_id,
            "season": stats.get("season"),
            "appearances": stats.get("appearances", 0),
            "starts": stats.get("starts", 0),
            "minutes_played": stats.get("minutes_played", 0),
            "goals": stats.get("goals", 0),
            "assists": stats.get("assists", 0),
            "yellow_cards": stats.get("yellow_cards", 0),
            "red_cards": stats.get("red_cards", 0),
            "xg": stats.get("xg"),
            "xag": stats.get("xag"),
            "shots": stats.get("shots"),
            "shots_on_target": stats.get("shots_on_target"),
            "pass_accuracy": stats.get("pass_accuracy"),
        }
    )


# ──────────────────────────────────────────────
# Carrière totalen herberekenen
# ──────────────────────────────────────────────

def recalculate_career_totals(cursor):
    """
    Herbereken carrière totalen voor alle spelers vanuit seizoensdata.
    Efficiënter dan per-speler berekenen.
    """
    logger.info("Herberekenen carrière totalen...")
    cursor.execute(
        """
        UPDATE players p
        SET
            career_goals        = agg.total_goals,
            career_assists      = agg.total_assists,
            career_appearances  = agg.total_appearances,
            career_yellow_cards = agg.total_yellows,
            career_red_cards    = agg.total_reds,
            last_updated        = NOW()
        FROM (
            SELECT
                player_id,
                SUM(goals)          AS total_goals,
                SUM(assists)        AS total_assists,
                SUM(appearances)    AS total_appearances,
                SUM(yellow_cards)   AS total_yellows,
                SUM(red_cards)      AS total_reds
            FROM player_season_stats
            GROUP BY player_id
        ) agg
        WHERE p.id = agg.player_id
        """
    )
    logger.info("✅ Carrière totalen bijgewerkt.")


# ──────────────────────────────────────────────
# Batch saves
# ──────────────────────────────────────────────

def save_fbref_season(records: list[dict], commit_every: int = 100):
    """
    Sla een volledige FBref seizoensdataset op in de database.
    Verwerkt in batches voor efficiency.
    """
    if not records:
        return

    conn = get_connection()
    try:
        cursor = conn.cursor()
        saved = 0
        failed = 0

        for i, record in enumerate(records):
            try:
                player_id = upsert_player(cursor, record)
                upsert_season_stats(cursor, player_id, record)
                saved += 1

                if (i + 1) % commit_every == 0:
                    conn.commit()
                    logger.debug(f"  Commit na {i+1} records")

            except Exception as e:
                logger.error(f"  Fout bij speler {record.get('name')}: {e}")
                conn.rollback()
                failed += 1
                continue

        conn.commit()
        logger.info(f"  ✅ Opgeslagen: {saved}, Mislukt: {failed}")

    finally:
        cursor.close()
        conn.close()


def save_transfermarkt_profiles(profiles: list[dict]):
    """
    Sla Transfermarkt spelersprofielen op — update interland stats.
    """
    if not profiles:
        return

    conn = get_connection()
    try:
        cursor = conn.cursor()
        updated = 0

        for profile in profiles:
            try:
                upsert_player(cursor, profile)
                updated += 1
            except Exception as e:
                logger.error(f"  Fout bij profiel {profile.get('name')}: {e}")
                conn.rollback()
                continue

        conn.commit()
        logger.info(f"  ✅ {updated} spelersprofielen bijgewerkt")

    finally:
        cursor.close()
        conn.close()


def finalize_career_totals():
    """Herbereken alle carrière totalen na de import."""
    conn = get_connection()
    try:
        cursor = conn.cursor()
        recalculate_career_totals(cursor)
        conn.commit()
    finally:
        cursor.close()
        conn.close()
