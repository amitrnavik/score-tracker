from pydantic import BaseModel, Field


class GameCreate(BaseModel):
    players: list[str] = Field(
        min_length=2,
        max_length=10,
    )