import secrets
import string

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends, HTTPException

from app.database.dependencies import get_db
from app.models.game import Game
from app.models.player import Player
from app.schemas.game import GameCreate
from app.models.round import Round
from app.models.round_score import RoundScore


router = APIRouter(
    prefix="/games",
    tags=["Games"],
)


def generate_game_code(length: int = 5) -> str:
    characters = string.ascii_uppercase + string.digits

    return "".join(
        secrets.choice(characters)
        for _ in range(length)
    )


@router.post("/")
def create_game(
    game_data: GameCreate,
    db: Session = Depends(get_db),
):
    game_code = generate_game_code()
    manage_code = generate_manage_code(12)

    game = Game(
        game_code=game_code,
        manage_code=manage_code,
        status="active",
    )

    db.add(game)
    db.flush()

    for name in game_data.players:
        player = Player(
            game_id=game.id,
            name=name,
            joined_at_round=1,
            status="active",
        )

        db.add(player)

    db.commit()
    db.refresh(game)

    return {
        "game_id": game.id,
        "game_code": game.game_code,
        "manage_code": game.manage_code,
        "players": game_data.players,
    }


@router.get("/{game_id}")
def get_game(
    game_id: int,
    db: Session = Depends(get_db),
):
    game = db.get(Game, game_id)

    if not game:
        raise HTTPException(
            status_code=404,
            detail="Game not found",
        )

    players = (
        db.query(Player)
        .filter(Player.game_id == game_id)
        .order_by(Player.id)
        .all()
    )

    rounds = (
        db.query(Round)
        .filter(Round.game_id == game_id)
        .order_by(Round.round_number)
        .all()
    )

    balances = {
        player.id: 0
        for player in players
    }

    round_data = []

    for game_round in rounds:
        scores = (
            db.query(RoundScore)
            .filter(RoundScore.round_id == game_round.id)
            .all()
        )

        winners = [
            score
            for score in scores
            if score.amount == 0
        ]

        winner = winners[0] if winners else None

        total_lost = sum(
            score.amount
            for score in scores
            if score.amount > 0
        )

        score_data = {}

        for score in scores:
            player = next(
                (
                    p for p in players
                    if p.id == score.player_id
                ),
                None,
            )

            if not player:
                continue

            score_data[player.name] = score.amount

            if winner and score.player_id == winner.player_id:
                balances[player.id] += total_lost
            else:
                balances[player.id] -= score.amount

        round_data.append({
            "round_number": game_round.round_number,
            "scores": score_data,
            "winner": (
                next(
                    (
                        p.name
                        for p in players
                        if winner
                        and p.id == winner.player_id
                    ),
                    None,
                )
                if winner
                else None
            ),
            "amount_won": total_lost,
        })

    player_data = []

    for player in players:
        player_data.append({
            "player_id": player.id,
            "name": player.name,
            "status": player.status,
            "joined_at_round": player.joined_at_round,
            "left_at_round": player.left_at_round,
            "balance": balances[player.id],
        })

    return {
        "game_id": game.id,
        "game_code": game.game_code,
        "status": game.status,
        "players": player_data,
        "rounds": round_data,
    }


@router.post("/{game_id}/end")
def end_game(
    game_id: int,
    db: Session = Depends(get_db),
):
    game = db.get(Game, game_id)

    if not game:
        raise HTTPException(
            status_code=404,
            detail="Game not found",
        )

    if game.status != "active":
        raise HTTPException(
            status_code=400,
            detail="Game is already ended",
        )

    game.status = "ended"

    db.commit()
    db.refresh(game)

    return {
        "game_id": game.id,
        "game_code": game.game_code,
        "status": game.status,
        "message": "Game ended successfully",
    }


@router.get("/{game_id}/settlement")
def get_settlement(
    game_id: int,
    db: Session = Depends(get_db),
):
    game = db.get(Game, game_id)

    if not game:
        raise HTTPException(
            status_code=404,
            detail="Game not found",
        )

    players = (
        db.query(Player)
        .filter(Player.game_id == game_id)
        .order_by(Player.id)
        .all()
    )

    rounds = (
        db.query(Round)
        .filter(Round.game_id == game_id)
        .order_by(Round.round_number)
        .all()
    )

    balances = {
        player.id: 0
        for player in players
    }

    for game_round in rounds:
        scores = (
            db.query(RoundScore)
            .filter(RoundScore.round_id == game_round.id)
            .all()
        )

        winner = next(
            (score for score in scores if score.amount == 0),
            None,
        )

        if not winner:
            continue

        total_lost = sum(
            score.amount
            for score in scores
            if score.player_id != winner.player_id
        )

        balances[winner.player_id] += total_lost

        for score in scores:
            if score.player_id != winner.player_id:
                balances[score.player_id] -= score.amount

    settlement = []

    for player in players:
        settlement.append({
            "player_id": player.id,
            "name": player.name,
            "status": player.status,
            "balance": balances[player.id],
        })

    total_balance = sum(balances.values())

    return {
        "game_id": game.id,
        "game_code": game.game_code,
        "status": game.status,
        "settlement": settlement,
        "total_balance": total_balance,
    }


@router.get("/{game_id}/settlement/payments")
def get_settlement_payments(
    game_id: int,
    db: Session = Depends(get_db),
):
    game = db.get(Game, game_id)

    if not game:
        raise HTTPException(
            status_code=404,
            detail="Game not found",
        )

    players = (
        db.query(Player)
        .filter(Player.game_id == game_id)
        .order_by(Player.id)
        .all()
    )

    rounds = (
        db.query(Round)
        .filter(Round.game_id == game_id)
        .order_by(Round.round_number)
        .all()
    )

    balances = {
        player.id: 0
        for player in players
    }

    # Calculate final balances
    for game_round in rounds:
        scores = (
            db.query(RoundScore)
            .filter(RoundScore.round_id == game_round.id)
            .all()
        )

        winner = next(
            (score for score in scores if score.amount == 0),
            None,
        )

        if not winner:
            continue

        total_lost = sum(
            score.amount
            for score in scores
            if score.player_id != winner.player_id
        )

        balances[winner.player_id] += total_lost

        for score in scores:
            if score.player_id != winner.player_id:
                balances[score.player_id] -= score.amount

    # Separate creditors and debtors
    creditors = [
        {
            "player_id": player.id,
            "name": player.name,
            "amount": balances[player.id],
        }
        for player in players
        if balances[player.id] > 0
    ]

    debtors = [
        {
            "player_id": player.id,
            "name": player.name,
            "amount": -balances[player.id],
        }
        for player in players
        if balances[player.id] < 0
    ]

    payments = []

    creditor_index = 0
    debtor_index = 0

    while (
        creditor_index < len(creditors)
        and debtor_index < len(debtors)
    ):
        creditor = creditors[creditor_index]
        debtor = debtors[debtor_index]

        payment = min(
            creditor["amount"],
            debtor["amount"],
        )

        payments.append({
            "from_player_id": debtor["player_id"],
            "from_player": debtor["name"],
            "to_player_id": creditor["player_id"],
            "to_player": creditor["name"],
            "amount": payment,
        })

        creditor["amount"] -= payment
        debtor["amount"] -= payment

        if creditor["amount"] == 0:
            creditor_index += 1

        if debtor["amount"] == 0:
            debtor_index += 1

    return {
        "game_id": game.id,
        "game_code": game.game_code,
        "status": game.status,
        "payments": payments,
    }


@router.get("/code/{game_code}")
def get_game_by_code(
    game_code: str,
    db: Session = Depends(get_db),
):
    game = (
        db.query(Game)
        .filter(Game.game_code == game_code.upper())
        .first()
    )

    if not game:
        raise HTTPException(
            status_code=404,
            detail="Game not found",
        )

    return {
        "game_id": game.id,
        "game_code": game.game_code,
        "status": game.status,
    }

def generate_manage_code(length: int = 12) -> str:
    characters = string.ascii_letters + string.digits
    return "".join(
        secrets.choice(characters)
        for _ in range(length)
    )


@router.get("/manage/{manage_code}")
def get_manage_game(
    manage_code: str,
    db: Session = Depends(get_db),
):
    game = (
        db.query(Game)
        .filter(Game.manage_code == manage_code)
        .first()
    )

    if not game:
        raise HTTPException(
            status_code=404,
            detail="Game not found",
        )

    return {
        "game_id": game.id,
        "game_code": game.game_code,
        "status": game.status,
    }

@router.get("/")
def list_games(
    db: Session = Depends(get_db),
):
    games = (
        db.query(Game)
        .order_by(Game.created_at.desc())
        .all()
    )

    result = []

    for game in games:

        players = (
            db.query(Player)
            .filter(Player.game_id == game.id)
            .all()
        )

        rounds = (
            db.query(Round)
            .filter(Round.game_id == game.id)
            .count()
        )

        result.append({
            "game_id": game.id,
            "game_code": game.game_code,
            "status": game.status,
            "players": [
                player.name
                for player in players
            ],
            "round_count": rounds,
            "created_at": game.created_at,
        })

    return result