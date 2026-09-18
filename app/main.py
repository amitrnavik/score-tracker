from fastapi import FastAPI

app = FastAPI()


@app.get("/")
def home():
    return {
        "message": "3 Patti Score Tracker API is running!"
    }