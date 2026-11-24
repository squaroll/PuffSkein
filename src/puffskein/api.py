import json
from pathlib import Path
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator
from fastapi.responses import StreamingResponse

from puffskein.agent import chat

app = FastAPI()

STATIC_DIR = Path(__file__).resolve().parents[2] / "dist"


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)
    thread_id: UUID = Field(default_factory=uuid4)
    allow_search: bool = True
    timezone: str | None = None

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, value):
        if value is not None:
            try:
                ZoneInfo(value)
            except (ZoneInfoNotFoundError, ValueError) as error:
                raise ValueError("无效的本机时区") from error
        return value


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
    async def events():
        async for event in chat(
            request.message, str(request.thread_id), request.allow_search, request.timezone,
        ):
            yield json.dumps(event, ensure_ascii=False) + "\n"

    return StreamingResponse(
        events(),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


app.mount(
    "/static",
    StaticFiles(directory=STATIC_DIR, check_dir=False),
    name="static",
)
