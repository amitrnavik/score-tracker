from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.models.game import Game
from app.models.player import Player
from app.models.round import Round
from app.schemas.player import PlayerCreate


router = APIRouter(
    prefix="/games/{game_id}/players",
    tags=["Players"],
)


@router.post("/")
def add_player(
    game_id: int,
    player_data: PlayerCreate,
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
            detail="Game is not active",
        )

    existing_player = (
        db.query(Player)
        .filter(
            Player.game_id == game_id,
            Player.name == player_data.name,
            Player.status == "active",
        )
        .first()
    )

    if existing_player:
        raise HTTPException(
            status_code=400,
            detail="Player already exists",
        )

    active_player_count = (
        db.query(Player)
        .filter(
            Player.game_id == game_id,
            Player.status == "active",
        )
        .count()
    )

    if active_player_count >= 10:
        raise HTTPException(
            status_code=400,
            detail="Maximum 10 active players allowed",
        )

    last_round = (
        db.query(Round)
        .filter(Round.game_id == game_id)
        .order_by(Round.round_number.desc())
        .first()
    )

    current_round = last_round.round_number if last_round else 0

    player = Player(
        game_id=game_id,
        name=player_data.name,
        joined_at_round=current_round + 1,
        status="active",
    )

    db.add(player)
    db.commit()
    db.refresh(player)

    return {
        "player_id": player.id,
        "name": player.name,
        "status": player.status,
        "joined_at_round": player.joined_at_round,
        "balance": 0,
    }


@router.delete("/{player_id}")
def remove_player(
    game_id: int,
    player_id: int,
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
            detail="Game is not active",
        )

    player = (
        db.query(Player)
        .filter(
            Player.id == player_id,
            Player.game_id == game_id,
        )
        .first()
    )

    if not player:
        raise HTTPException(
            status_code=404,
            detail="Player not found",
        )

    if player.status != "active":
        raise HTTPException(
            status_code=400,
            detail="Player is already removed",
        )

    last_round = (
        db.query(Round)
        .filter(Round.game_id == game_id)
        .order_by(Round.round_number.desc())
        .first()
    )

    current_round = last_round.round_number if last_round else 0

    player.status = "left"
    player.left_at_round = current_round + 1

    db.commit()
    db.refresh(player)

    return {
        "player_id": player.id,
        "name": player.name,
        "status": player.status,
        "left_at_round": player.left_at_round,
    }