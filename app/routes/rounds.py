from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.models.game import Game
from app.models.player import Player
from app.models.round import Round
from app.models.round_score import RoundScore
from app.schemas.round import RoundCreate


router = APIRouter(
    prefix="/games/{game_id}/rounds",
    tags=["Rounds"],
)


@router.post("/")
def create_round(
    game_id: int,
    round_data: RoundCreate,
    db: Session = Depends(get_db),
):
    # 1. Check that the game exists
    game = db.get(Game, game_id)

    if not game:
        raise HTTPException(
            status_code=404,
            detail="Game not found",
        )

    # 2. Check that the game is active
    if game.status != "active":
        raise HTTPException(
            status_code=400,
            detail="Game is not active",
        )

    # 3. Get active players
    active_players = (
        db.query(Player)
        .filter(
            Player.game_id == game_id,
            Player.status == "active",
        )
        .all()
    )

    active_player_ids = {
        player.id
        for player in active_players
    }

    # 4. Validate player count
    if len(round_data.scores) != len(active_players):
        raise HTTPException(
            status_code=400,
            detail="Scores must be provided for all active players",
        )

    # 5. Check duplicate players
    submitted_player_ids = [
        score.player_id
        for score in round_data.scores
    ]

    if len(submitted_player_ids) != len(set(submitted_player_ids)):
        raise HTTPException(
            status_code=400,
            detail="A player cannot appear more than once",
        )

    # 6. Check that all players belong to this game
    invalid_players = (
        set(submitted_player_ids) - active_player_ids
    )

    if invalid_players:
        raise HTTPException(
            status_code=400,
            detail="Invalid player in round",
        )

    # 7. Find the winner
    winners = [
        score
        for score in round_data.scores
        if score.amount == 0
    ]

    if len(winners) != 1:
        raise HTTPException(
            status_code=400,
            detail="Exactly one player must have a score of 0",
        )

    winner = winners[0]

    # 8. Calculate winner's winnings
    winner_amount = sum(
        score.amount
        for score in round_data.scores
        if score.player_id != winner.player_id
    )

    # 9. Determine round number
    last_round = (
        db.query(Round)
        .filter(Round.game_id == game_id)
        .order_by(Round.round_number.desc())
        .first()
    )

    round_number = (
        last_round.round_number + 1
        if last_round
        else 1
    )

    # 10. Create round
    game_round = Round(
        game_id=game_id,
        round_number=round_number,
    )

    db.add(game_round)
    db.flush()

    # 11. Save scores
    for score in round_data.scores:
        round_score = RoundScore(
            round_id=game_round.id,
            player_id=score.player_id,
            amount=score.amount,
        )

        db.add(round_score)

    db.commit()
    db.refresh(game_round)

    return {
        "round_id": game_round.id,
        "round_number": game_round.round_number,
        "winner": {
            "player_id": winner.player_id,
            "amount_won": winner_amount,
        },
        "scores": [
            {
                "player_id": score.player_id,
                "amount_lost": score.amount,
            }
            for score in round_data.scores
        ],
    }