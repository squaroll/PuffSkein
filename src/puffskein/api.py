from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from fastapi.responses import StreamingResponse

from puffskein.agent import chat

app = FastAPI()

STATIC_DIR = Path(__file__).resolve().parents[2] / "dist"


class ChatRequest(BaseModel):
    message: str


@app.get("/")
def index():
    if not (STATIC_DIR / "index.html").is_file():
        raise HTTPException(
            status_code=503,
            detail="前端尚未构建，请先运行 npm install 和 npm run build；开发时请访问 Vite 开发服务器。",
        )
    return FileResponse(STATIC_DIR / "index.html")


@app.post("/chat")
def chat_endpoint(request: ChatRequest):
    return StreamingResponse(
        chat(request.message),
        media_type="text/plain; charset=utf-8",
    )


app.mount(
    "/static",
    StaticFiles(directory=STATIC_DIR, check_dir=False),
    name="static",
)
