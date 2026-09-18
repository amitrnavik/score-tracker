from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from app.routes.games import router as games_router
from app.routes.rounds import router as rounds_router
from app.routes.players import router as players_router


BASE_DIR = Path(__file__).resolve().parent


app = FastAPI(
    title="3 Patti Score Tracker",
    description="Live score tracking API for 3 Patti games",
    version="1.0.0",
)


app.include_router(games_router)
app.include_router(rounds_router)
app.include_router(players_router)


app.mount(
    "/static",
    StaticFiles(directory=BASE_DIR / "static"),
    name="static",
)


@app.get("/")
def home():
    return FileResponse(BASE_DIR / "static" / "index.html")


@app.get("/game/{game_code}")
def game_page(game_code: str):
    return FileResponse(
        BASE_DIR / "static" / "index.html"
    )