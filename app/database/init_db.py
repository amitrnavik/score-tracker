from app.database.base import Base
from app.database.connection import engine
from app.models.game import Game
from app.models.player import Player
from app.models.round import Round
from app.models.round_score import RoundScore


def init_db():
    Base.metadata.create_all(bind=engine)


if __name__ == "__main__":
    init_db()
    print("Database tables created successfully.")