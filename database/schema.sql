-- =============================================
-- Football 501 — Database Schema
-- =============================================
 
-- Competities (Premier League, Eredivisie, etc.)
CREATE TABLE IF NOT EXISTS competitions (
    id              SERIAL PRIMARY KEY,
    fbref_id        VARCHAR(20) UNIQUE,         -- FBref interne ID
    api_football_id INTEGER,                    -- API-Football league ID
    name            VARCHAR(100) NOT NULL,
    country         VARCHAR(50),
    logo_url        TEXT
);
 
-- Clubs
CREATE TABLE IF NOT EXISTS clubs (
    id              SERIAL PRIMARY KEY,
    fbref_id        VARCHAR(20) UNIQUE,
    transfermarkt_id VARCHAR(20),
    api_football_id INTEGER,
    name            VARCHAR(100) NOT NULL,
    short_name      VARCHAR(20),
    country         VARCHAR(50),
    logo_url        TEXT
);
 
-- Spelers (kern-profiel, source of truth)
CREATE TABLE IF NOT EXISTS players (
    id                  SERIAL PRIMARY KEY,
    fbref_id            VARCHAR(20) UNIQUE,
    transfermarkt_id    VARCHAR(20),
    api_football_id     INTEGER,
 
    -- Identiteit
    name                VARCHAR(150) NOT NULL,
    full_name           VARCHAR(200),
    nationality         VARCHAR(50),
    birth_date          DATE,
    position            VARCHAR(30),    -- GK, DF, MF, FW
    photo_url           TEXT,
 
    -- Interlands (van Transfermarkt)
    international_caps      INTEGER DEFAULT 0,
    international_goals     INTEGER DEFAULT 0,
    national_team           VARCHAR(50),
 
    -- Carrière totalen (berekend uit player_season_stats)
    career_goals            INTEGER DEFAULT 0,
    career_assists          INTEGER DEFAULT 0,
    career_appearances      INTEGER DEFAULT 0,
    career_yellow_cards     INTEGER DEFAULT 0,
    career_red_cards        INTEGER DEFAULT 0,
 
    -- Meta
    last_updated        TIMESTAMP DEFAULT NOW(),
    data_source         VARCHAR(20) DEFAULT 'fbref'
);
 
-- Statistieken per speler per seizoen per competitie
CREATE TABLE IF NOT EXISTS player_season_stats (
    id              SERIAL PRIMARY KEY,
    player_id       INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    competition_id  INTEGER NOT NULL REFERENCES competitions(id),
    club_id         INTEGER REFERENCES clubs(id),
    season          VARCHAR(10) NOT NULL,   -- bijv. '2023-24'
 
    -- Speeltijd
    appearances     INTEGER DEFAULT 0,
    starts          INTEGER DEFAULT 0,
    minutes_played  INTEGER DEFAULT 0,
 
    -- Aanval
    goals           INTEGER DEFAULT 0,
    assists         INTEGER DEFAULT 0,
    penalties_scored INTEGER DEFAULT 0,
    penalties_attempted INTEGER DEFAULT 0,
 
    -- Disciplinair
    yellow_cards    INTEGER DEFAULT 0,
    red_cards       INTEGER DEFAULT 0,
 
    -- Geavanceerd (FBref/Opta)
    xg              NUMERIC(5,2),   -- Expected Goals
    xag             NUMERIC(5,2),   -- Expected Assisted Goals
    shots           INTEGER,
    shots_on_target INTEGER,
    passes          INTEGER,
    pass_accuracy   NUMERIC(4,1),
 
    -- Keeper-specifiek
    clean_sheets    INTEGER,
    goals_conceded  INTEGER,
    saves           INTEGER,
 
    -- Meta
    data_source     VARCHAR(20) DEFAULT 'fbref',
    last_updated    TIMESTAMP DEFAULT NOW(),
 
    UNIQUE (player_id, competition_id, club_id, season)
);
 
-- Index voor snelle game queries
CREATE INDEX IF NOT EXISTS idx_player_season_player ON player_season_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_player_season_season ON player_season_stats(season);
CREATE INDEX IF NOT EXISTS idx_player_season_comp   ON player_season_stats(competition_id);
 
-- Game categorieën (de "vragen" in het spel)
CREATE TABLE IF NOT EXISTS game_categories (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL,      -- bijv. "Goals dit seizoen"
    description     VARCHAR(200),               -- uitleg voor de speler
    stat_table      VARCHAR(50) NOT NULL,        -- 'player_season_stats' of 'players'
    stat_column     VARCHAR(50) NOT NULL,        -- bijv. 'goals'
    filter_season   VARCHAR(10),                -- NULL = carrière, '2024-25' = specifiek
    filter_comp_id  INTEGER,                    -- NULL = alle comps
    is_active       BOOLEAN DEFAULT TRUE,
    min_value       INTEGER DEFAULT 1,          -- antwoord moet minstens dit zijn
    max_display     INTEGER DEFAULT 180         -- boven dit = 0 in darts
);
 
-- Spelersessies (multiplayer)
CREATE TABLE IF NOT EXISTS game_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player1_name    VARCHAR(50),
    player2_name    VARCHAR(50),
    category_id     INTEGER REFERENCES game_categories(id),
    status          VARCHAR(20) DEFAULT 'active',  -- active, finished
    winner          VARCHAR(50),
    created_at      TIMESTAMP DEFAULT NOW()
);
 
-- Beurten per sessie
CREATE TABLE IF NOT EXISTS game_turns (
    id              SERIAL PRIMARY KEY,
    session_id      UUID REFERENCES game_sessions(id),
    turn_number     INTEGER NOT NULL,
    active_player   VARCHAR(50),
 
    -- De vraag
    subject_player_id INTEGER REFERENCES players(id),
    category_id     INTEGER REFERENCES game_categories(id),
 
    -- Het antwoord
    correct_answer  INTEGER NOT NULL,
    darts_score     INTEGER NOT NULL,       -- na toepassing dartsregels
    score_before    INTEGER NOT NULL,
    score_after     INTEGER NOT NULL,
 
    played_at       TIMESTAMP DEFAULT NOW()
);
 
-- Seed: standaard competities
INSERT INTO competitions (fbref_id, api_football_id, name, country) VALUES
    ('9',   39,  'Premier League',    'England'),
    ('12',  140, 'La Liga',           'Spain'),
    ('20',  78,  'Bundesliga',        'Germany'),
    ('11',  135, 'Serie A',           'Italy'),
    ('13',  61,  'Ligue 1',           'France'),
    ('23',  88,  'Eredivisie',        'Netherlands'),
    ('37',  144, 'Jupiler Pro League','Belgium'),
    ('32',  94,  'Primeira Liga',     'Portugal'),
    ('8',   2,   'Champions League',  'Europe')
ON CONFLICT (fbref_id) DO NOTHING;
 
-- Seed: standaard spelcategorieën
INSERT INTO game_categories (name, description, stat_table, stat_column, filter_season) VALUES
    ('Goals dit seizoen',     'Hoeveel goals scoorde deze speler dit seizoen?',       'player_season_stats', 'goals',          '2024-25'),
    ('Assists dit seizoen',   'Hoeveel assists gaf deze speler dit seizoen?',          'player_season_stats', 'assists',        '2024-25'),
    ('Wedstrijden gespeeld',  'Hoeveel wedstrijden speelde deze speler dit seizoen?',  'player_season_stats', 'appearances',    '2024-25'),
    ('Interland caps',        'Hoeveel interlands speelde deze speler in zijn carrière?','players',           'international_caps', NULL),
    ('Interlandgoals',        'Hoeveel goals scoorde deze speler voor zijn land?',     'players',            'international_goals', NULL),
    ('Carrière goals',        'Hoeveel goals scoorde deze speler in zijn hele carrière?','players',          'career_goals',   NULL),
    ('Carrière assists',      'Hoeveel assists gaf deze speler in zijn hele carrière?', 'players',           'career_assists',  NULL),
    ('Minuten gespeeld /10',  'Minuten gespeeld dit seizoen gedeeld door 10',          'player_season_stats','minutes_played', '2024-25'),
    ('Gele kaarten carrière', 'Hoeveel gele kaarten kreeg deze speler in zijn carrière?','players',          'career_yellow_cards', NULL)
ON CONFLICT DO NOTHING;
