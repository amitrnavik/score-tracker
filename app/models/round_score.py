from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from app.database.base import Base


class RoundScore(Base):
    __tablename__ = "round_scores"

    id: Mapped[int] = mapped_column(primary_key=True)

    round_id: Mapped[int] = mapped_column(
        ForeignKey("rounds.id"),
        nullable=False,
        index=True,
    )

    player_id: Mapped[int] = mapped_column(
        ForeignKey("players.id"),
        nullable=False,
        index=True,
    )

    amount: Mapped[int] = mapped_column(
        nullable=False,
    )