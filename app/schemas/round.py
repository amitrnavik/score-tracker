from pydantic import BaseModel, Field


class RoundScoreCreate(BaseModel):
    player_id: int
    amount: int = Field(ge=0)


class RoundCreate(BaseModel):
    scores: list[RoundScoreCreate] = Field(
        min_length=2,
        max_length=10,
    )