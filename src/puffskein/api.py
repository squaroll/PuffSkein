from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from fastapi.responses import StreamingResponse

from puffskein.agent import chat

app = FastAPI()

STATIC_DIR = Path(__file__).resolve().parents[2] / "static"


class ChatRequest(BaseModel):
    message: str


@app.get("/")
def index():
    return FileResponse(STATIC_DIR / "index.html")


@app.post("/chat")
def chat_endpoint(request: ChatRequest):
    return StreamingResponse(
        chat(request.message),
        media_type="text/plain; charset=utf-8",
    )


app.mount(
    "/static",
    StaticFiles(directory=STATIC_DIR),
    name="static",
)