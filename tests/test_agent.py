import json
import os
import unittest
from datetime import datetime
from zoneinfo import ZoneInfo
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from langchain.messages import AIMessage, AIMessageChunk
from langchain_core.language_models.fake_chat_models import FakeMessagesListChatModel
from langchain_core.outputs import ChatGenerationChunk
from pydantic import Field

from puffskein import agent
from puffskein.tools import AgentContext, get_current_time, tavily_search


class ScriptedModel(FakeMessagesListChatModel):
    """Exercise the real graph, tool injection and checkpoint without network calls."""

    seen_tools: list = Field(default_factory=list)
    seen_messages: list = Field(default_factory=list)

    def bind_tools(self, tools, **kwargs):
        self.seen_tools.append([tool.name for tool in tools])
        return self

    def _generate(self, messages, **kwargs):
        self.seen_messages.append(messages)
        return super()._generate(messages, **kwargs)

    async def _astream(self, messages, **kwargs):
        message = self._generate(messages, **kwargs).generations[0].message
        yield ChatGenerationChunk(message=AIMessageChunk(
            content=message.content, tool_calls=message.tool_calls,
        ))


def search_call(call_id, query):
    return {"name": "tavily_search", "args": {"query": query}, "id": call_id, "type": "tool_call"}


class AgentTests(unittest.IsolatedAsyncioTestCase):
    def tearDown(self):
        agent.get_agent.cache_clear()

    async def test_search_events_and_checkpoints_are_isolated_by_thread(self):
        model = ScriptedModel(responses=[
            AIMessage(content="先查询资料。", tool_calls=[search_call("call-1", "React")]),
            AIMessage(content="已找到资料。", tool_calls=[search_call("call-2", "LangGraph")]),
            AIMessage(content="最终回答"),
            AIMessage(content="我记得上文"),
            AIMessage(content="新的会话"),
        ])
        client = AsyncMock()
        client.__aenter__.return_value = client
        client.search.return_value = {"results": [
            {"title": "官方文档", "url": "https://example.com/docs", "content": "测试资料"},
            {"title": "不安全地址", "url": "javascript:alert(1)", "content": "不应展示"},
        ]}
        agent.get_agent.cache_clear()
        with patch.object(agent, "init_chat_model", return_value=model), \
                patch.dict(os.environ, {"TAVILY_API_KEY": "test-key"}), \
                patch("puffskein.tools.AsyncTavilyClient", return_value=client):
            events = [event async for event in agent.chat("请记住我是小明，并搜索", "thread-a")]
            self.assertEqual(events[-1], {"type": "done"})
            calls = [event for event in events if event["type"] == "tool_start"]
            results = [event for event in events if event["type"] == "tool_end"]
            self.assertEqual([call["query"] for call in calls], ["React", "LangGraph"])
            self.assertEqual(len(results), 2)
            self.assertEqual(calls[0]["id"], results[0]["id"])
            self.assertEqual(results[0]["sources"], [{"title": "官方文档", "url": "https://example.com/docs"}])
            self.assertIn("最终回答", "".join(event["text"] for event in events if event["type"] == "text"))
            self.assertEqual(client.search.await_count, 2)

            bindings_before = len(model.seen_tools)
            await self.collect("我叫什么？", "thread-a", False)
            self.assertTrue(any(message.content == "请记住我是小明，并搜索" for message in model.seen_messages[-1]))
            self.assertTrue(any(message.type == "tool" for message in model.seen_messages[-1]))
            self.assertEqual(len(model.seen_tools), bindings_before + 1)
            self.assertEqual(model.seen_tools[-1], ["get_current_time"])
            await self.collect("你好", "thread-b", False)
            self.assertFalse(any(message.content == "请记住我是小明，并搜索" for message in model.seen_messages[-1]))

    async def collect(self, question, thread_id, allow_search=True):
        return [event async for event in agent.chat(question, thread_id, allow_search)]

    async def test_disabled_search_is_enforced_even_if_model_asks_for_tool(self):
        model = ScriptedModel(responses=[
            AIMessage(content="", tool_calls=[search_call("forbidden", "不能搜索")]),
            AIMessage(content="本轮不允许搜索"),
        ])
        with patch.object(agent, "init_chat_model", return_value=model), \
                patch("puffskein.tools.AsyncTavilyClient") as client:
            events = await self.collect("搜索", "disabled", False)
        client.assert_not_called()
        self.assertTrue(all(tools == ["get_current_time"] for tools in model.seen_tools))
        result = next(event for event in events if event["type"] == "tool_end")
        self.assertIn("未允许", result["error"])

    async def test_time_tool_is_available_without_search_and_streams_its_result(self):
        model = ScriptedModel(responses=[
            AIMessage(content="", tool_calls=[{
                "name": "get_current_time", "args": {}, "id": "time-1", "type": "tool_call",
            }]),
            AIMessage(content="这是当前时间"),
        ])
        with patch.object(agent, "init_chat_model", return_value=model):
            events = [event async for event in agent.chat("现在几点？", "time-thread", False, "Asia/Tokyo")]
        result = next(event for event in events if event["type"] == "tool_end")
        self.assertEqual(result["name"], "get_current_time")
        self.assertIn("Asia/Tokyo", result["details"])
        self.assertIn("+09:00", result["details"])
        self.assertIsNone(result["error"])
        self.assertEqual(result["sources"], [])
        self.assertEqual(events[-1], {"type": "done"})

    def test_time_tool_uses_browser_timezone_or_system_local_time(self):
        instant = datetime(2026, 11, 24, 15, 30, 0, tzinfo=ZoneInfo("Asia/Tokyo"))
        runtime = SimpleNamespace(context=AgentContext(timezone="Asia/Tokyo"))
        with patch("puffskein.tools.datetime") as clock:
            clock.now.return_value = instant
            content, artifact = get_current_time.func(runtime)
            self.assertIn("2026-11-24T15:30:00+09:00", content)
            self.assertIn("星期二", content)
            self.assertEqual(content, artifact["details"])
            self.assertEqual(clock.now.call_args.args[0].key, "Asia/Tokyo")
            runtime.context.timezone = None
            content, _ = get_current_time.func(runtime)
            clock.now.assert_called_with()
            self.assertIn(instant.astimezone().isoformat(timespec="seconds"), content)
        for timezone in ["Invalid/Timezone", "/invalid-path"]:
            runtime.context.timezone = timezone
            _, artifact = get_current_time.func(runtime)
            self.assertIn("无法识别", artifact["error"])

    async def test_missing_key_and_search_errors_are_reported_without_secrets(self):
        runtime = SimpleNamespace(context=AgentContext())
        with patch.dict(os.environ, {"TAVILY_API_KEY": ""}):
            content, artifact = await tavily_search.coroutine("问题", runtime)
            self.assertIn("TAVILY_API_KEY", artifact["error"])
        client = AsyncMock()
        client.__aenter__.return_value = client
        client.search.side_effect = RuntimeError("secret-api-key")
        with patch.dict(os.environ, {"TAVILY_API_KEY": "test-key"}), \
                patch("puffskein.tools.AsyncTavilyClient", return_value=client):
            content, artifact = await tavily_search.coroutine("问题", runtime)
        self.assertIn("联网搜索失败", artifact["error"])
        self.assertNotIn("secret-api-key", content)
        self.assertEqual(json.loads(content)["sources"], [])
        client.__aexit__.assert_awaited_once()

    async def test_agent_failure_becomes_a_terminal_error_event(self):
        with patch.object(agent, "get_agent", side_effect=RuntimeError("private-key")), \
                self.assertLogs(agent.logger, level="ERROR"):
            events = await self.collect("问题", "error")
        self.assertEqual(events[0]["status"], "thinking")
        self.assertEqual(events[-1]["type"], "error")
        self.assertNotIn("private-key", json.dumps(events))


if __name__ == "__main__":
    unittest.main()
