import json
import os
from dataclasses import dataclass
from datetime import datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from langchain.tools import ToolRuntime, tool
from tavily import AsyncTavilyClient


@dataclass
class AgentContext:
    allow_search: bool = True
    timezone: str | None = None


@tool(response_format="content_and_artifact")
def get_current_time(runtime: ToolRuntime[AgentContext]) -> tuple[str, dict]:
    """获取用户本机的当前日期、时间和星期，与工作台侧边栏使用同一时区。"""
    timezone = runtime.context.timezone
    try:
        now = datetime.now(ZoneInfo(timezone)) if timezone else datetime.now().astimezone()
    except (ZoneInfoNotFoundError, ValueError):
        error = "无法识别该时区，请使用 Asia/Shanghai、UTC 等 IANA 时区名称。"
        return error, {"error": error}
    weekday = "一二三四五六日"[now.weekday()]
    details = f"当前时间：{now.isoformat(timespec='seconds')}，星期{weekday}，时区：{timezone or now.tzname()}"
    return details, {"details": details, "error": None}


@tool(response_format="content_and_artifact")
async def tavily_search(query: str, runtime: ToolRuntime[AgentContext]) -> tuple[str, dict]:
    """搜索互联网以获取最新信息。query 应为具体的搜索词；回答时引用结果中的网页地址。"""
    artifact = {"query": query, "sources": [], "error": None}
    if not runtime.context.allow_search:
        artifact["error"] = "本轮对话未允许联网搜索。"
    elif not os.getenv("TAVILY_API_KEY"):
        artifact["error"] = "尚未配置 TAVILY_API_KEY，暂时无法联网搜索。"
    else:
        try:
            async with AsyncTavilyClient(api_key=os.environ["TAVILY_API_KEY"]) as client:
                result = await client.search(query, max_results=5, search_depth="basic", timeout=30)
            artifact["sources"] = [
                {"title": item.get("title", ""), "url": item["url"], "content": item.get("content", "")}
                for item in result.get("results", [])
                if isinstance(item.get("url"), str) and item["url"].startswith(("https://", "http://"))
            ]
        except Exception:
            artifact["error"] = "联网搜索失败，请检查 Tavily 配置、额度或网络后重试。"

    return json.dumps(artifact, ensure_ascii=False), artifact
