"""
game_logic/darts_scoring.py

De core game engine van Football 501.
Implementeert de dartsscoringregels en spellogica.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


# ──────────────────────────────────────────────
# Constanten
# ──────────────────────────────────────────────

STARTING_SCORE = 501
WIN_THRESHOLD_LOW = -10   # Laagste geldig eindscore
WIN_THRESHOLD_HIGH = 0    # Hoogste geldig eindscore
MAX_DARTS_SCORE = 180

# Scores die in darts onmogelijk zijn — tellen als 0
IMPOSSIBLE_SCORES = frozenset({
    163, 166, 169, 172, 173, 175, 176, 178, 179
})


# ──────────────────────────────────────────────
# Darts Scoring
# ──────────────────────────────────────────────

def apply_darts_rules(value: int) -> int:
    """
    Pas de dartsscoringregels toe op een antwoord.
    
    Regels:
    - Boven 180 → 0 punten
    - Onmogelijke dartsscores → 0 punten  
    - Anders → de waarde zelf
    
    Args:
        value: het ruwe antwoord (bijv. goals = 23)
    
    Returns:
        De dartscore (0–180)
    
    Voorbeelden:
        23  → 23   (normale score)
        180 → 180  (maximale darts score)
        181 → 0    (boven maximum)
        169 → 0    (onmogelijk in darts)
        5   → 5    (gewone score)
    """
    if value > MAX_DARTS_SCORE:
        return 0
    if value in IMPOSSIBLE_SCORES:
        return 0
    if value < 0:
        return 0
    return value


def calculate_new_score(current_score: int, darts_score: int) -> int:
    """
    Bereken de nieuwe score na een beurt.
    De score telt AF van de startscore.
    
    Args:
        current_score: huidige score van de speler (bijv. 350)
        darts_score: behaalde dartscore deze beurt (0–180)
    
    Returns:
        Nieuwe score (kan negatief worden)
    """
    return current_score - darts_score


def is_winning_score(score: int) -> bool:
    """
    Controleer of een score een win is.
    Win = score tussen -10 en 0 (inclusief).
    """
    return WIN_THRESHOLD_LOW <= score <= WIN_THRESHOLD_HIGH


def is_bust(score: int) -> bool:
    """
    Controleer of een score 'bust' is (te ver gegaan).
    Bust = score onder -10.
    """
    return score < WIN_THRESHOLD_LOW


def determine_winner(player1_score: int, player2_score: int) -> int:
    """
    Bepaal de winnaar als beide spelers in dezelfde beurt winnen.
    Dichtstbij 0 wint. Bij gelijkspel wint speler 1.
    
    Returns:
        1 als speler 1 wint, 2 als speler 2 wint
    """
    if abs(player1_score) <= abs(player2_score):
        return 1
    return 2


# ──────────────────────────────────────────────
# Game State
# ──────────────────────────────────────────────

class GameStatus(Enum):
    ACTIVE = "active"
    FINISHED = "finished"
    ABANDONED = "abandoned"


@dataclass
class PlayerState:
    name: str
    score: int = STARTING_SCORE
    turns_played: int = 0
    total_darts_scored: int = 0
    highest_turn: int = 0
    zeros_thrown: int = 0  # Aantal keer score = 0 (impossible/over 180)


@dataclass
class TurnResult:
    player_name: str
    raw_answer: int          # Het ruwe antwoord (bijv. 23 goals)
    darts_score: int         # Na dartsregels (0–180)
    score_before: int
    score_after: int
    is_zero: bool            # Was het een nulscore?
    is_winner: bool = False
    is_bust: bool = False
    explanation: str = ""    # Waarom 0? "Boven 180" of "Onmogelijke dartscore"


@dataclass
class GameState:
    player1: PlayerState
    player2: PlayerState
    status: GameStatus = GameStatus.ACTIVE
    current_turn: int = 0
    active_player_index: int = 0   # 0 = speler 1, 1 = speler 2
    turn_history: list = field(default_factory=list)
    winner: Optional[str] = None


# ──────────────────────────────────────────────
# Game Engine
# ──────────────────────────────────────────────

class Football501Game:
    """
    Beheert de volledige spellogica van Football 501.
    Stateless design — geeft altijd een nieuwe GameState terug.
    """

    def __init__(self, player1_name: str, player2_name: str):
        self.state = GameState(
            player1=PlayerState(name=player1_name),
            player2=PlayerState(name=player2_name),
        )

    @property
    def active_player(self) -> PlayerState:
        return (
            self.state.player1
            if self.state.active_player_index == 0
            else self.state.player2
        )

    @property
    def inactive_player(self) -> PlayerState:
        return (
            self.state.player2
            if self.state.active_player_index == 0
            else self.state.player1
        )

    def submit_answer(self, raw_value: int) -> TurnResult:
        """
        Verwerk het antwoord van de actieve speler.
        
        Args:
            raw_value: het getal dat de speler heeft gegeven
                       (bijv. aantal goals van de gevraagde speler)
        
        Returns:
            TurnResult met alle info over deze beurt
        """
        if self.state.status != GameStatus.ACTIVE:
            raise ValueError("Het spel is al afgelopen.")

        player = self.active_player
        score_before = player.score

        # Toepassen dartregels
        darts_score = apply_darts_rules(raw_value)
        score_after = calculate_new_score(score_before, darts_score)

        # Leg uit waarom een 0 score
        explanation = ""
        if darts_score == 0 and raw_value > 0:
            if raw_value > MAX_DARTS_SCORE:
                explanation = f"{raw_value} is boven het maximum van {MAX_DARTS_SCORE}"
            elif raw_value in IMPOSSIBLE_SCORES:
                explanation = f"{raw_value} is een onmogelijke dartscore"

        # Maak turn result
        result = TurnResult(
            player_name=player.name,
            raw_answer=raw_value,
            darts_score=darts_score,
            score_before=score_before,
            score_after=score_after,
            is_zero=(darts_score == 0),
            explanation=explanation,
        )

        # Update speler stats
        player.score = score_after
        player.turns_played += 1
        player.total_darts_scored += darts_score
        player.highest_turn = max(player.highest_turn, darts_score)
        if darts_score == 0:
            player.zeros_thrown += 1

        # Check win/bust
        if is_winning_score(score_after):
            result.is_winner = True
            self._handle_win(result)
        elif is_bust(score_after):
            result.is_bust = True
            # Bij bust gaat de score terug (mag niet verder dan -10)
            # Optie: je kunt ook de score laten staan en de beurt overslaan
            player.score = score_before  # Reset bij bust

        self.state.turn_history.append(result)
        self.state.current_turn += 1

        # Wissel van speler (tenzij het spel voorbij is)
        if self.state.status == GameStatus.ACTIVE:
            self.state.active_player_index = 1 - self.state.active_player_index

        return result

    def _handle_win(self, result: TurnResult):
        """Verwerk een winnende score."""
        p1 = self.state.player1
        p2 = self.state.player2

        # Check of beide spelers tegelijk in de winscore komen
        # Dit kan alleen als ze allebei in dezelfde ronde winnen
        if is_winning_score(p1.score) and is_winning_score(p2.score):
            winner_index = determine_winner(p1.score, p2.score)
            self.state.winner = p1.name if winner_index == 1 else p2.name
        else:
            self.state.winner = result.player_name

        self.state.status = GameStatus.FINISHED

    def get_scores(self) -> dict:
        """Geef huidige scores terug."""
        return {
            self.state.player1.name: self.state.player1.score,
            self.state.player2.name: self.state.player2.score,
        }

    def get_stats(self) -> dict:
        """Geef spelstatistieken terug."""
        p1 = self.state.player1
        p2 = self.state.player2
        return {
            p1.name: {
                "score": p1.score,
                "turns": p1.turns_played,
                "average": p1.total_darts_scored / p1.turns_played if p1.turns_played else 0,
                "highest_turn": p1.highest_turn,
                "zeros": p1.zeros_thrown,
            },
            p2.name: {
                "score": p2.score,
                "turns": p2.turns_played,
                "average": p2.total_darts_scored / p2.turns_played if p2.turns_played else 0,
                "highest_turn": p2.highest_turn,
                "zeros": p2.zeros_thrown,
            },
        }


# ──────────────────────────────────────────────
# Hulpfuncties voor categorieën
# ──────────────────────────────────────────────

def format_darts_explanation(raw: int, darts: int) -> str:
    """Geef een leesbare uitleg van de dartsberekening."""
    if darts == raw:
        return f"{raw} → {darts} punten"
    elif raw > MAX_DARTS_SCORE:
        return f"{raw} (boven {MAX_DARTS_SCORE}) → 0 punten"
    elif raw in IMPOSSIBLE_SCORES:
        return f"{raw} (onmogelijke dartscore) → 0 punten"
    return f"{raw} → {darts} punten"


def get_score_color(score: int) -> str:
    """Geef een kleurcode voor de huidige score (voor UI)."""
    if score > 300:
        return "red"      # Ver van finish
    elif score > 100:
        return "orange"   # Dichterbij
    elif score > 0:
        return "green"    # Bijna klaar
    elif is_winning_score(score):
        return "gold"     # Gewonnen!
    else:
        return "gray"     # Bust


# ──────────────────────────────────────────────
# Tests / Demo
# ──────────────────────────────────────────────

if __name__ == "__main__":
    print("🎯 Football 501 — Game Logic Demo\n")

    # Test dartsregels
    test_values = [23, 45, 180, 181, 169, 172, 0, 100, 163, 179, 150]
    print("Darts scoring tests:")
    for v in test_values:
        score = apply_darts_rules(v)
        print(f"  {v:4d} → {score:3d}  {format_darts_explanation(v, score)}")

    # Demo spel
    print("\n🎮 Demo spel: Klaas vs Piet\n")
    game = Football501Game("Klaas", "Piet")

    # Simuleer een paar beurten
    beurten = [
        ("Klaas", 45),   # Goals Haaland
        ("Piet", 180),   # Max score
        ("Klaas", 169),  # Onmogelijke dartscore → 0
        ("Piet", 23),    # Assists
        ("Klaas", 120),  # Interland caps
        ("Piet", 88),    # Appearances
    ]

    for speler, antwoord in beurten:
        result = game.submit_answer(antwoord)
        scores = game.get_scores()
        print(f"  {result.player_name}: antwoord={result.raw_answer} → "
              f"darts={result.darts_score} | "
              f"score: {result.score_before} → {result.score_after}")
        if result.explanation:
            print(f"    ℹ️  {result.explanation}")
        if result.is_winner:
            print(f"\n🏆 {game.state.winner} wint het spel!")
            break

    if game.state.status == GameStatus.ACTIVE:
        print(f"\nStand na demo: {game.get_scores()}")
        print(f"Stats: {game.get_stats()}")
