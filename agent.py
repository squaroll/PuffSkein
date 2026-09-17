import json
from dotenv import load_dotenv
import os
from policy import EXPOSED_TOOLS, check_tool_call
import requests
from mcp_client import get_tool_schemas, call_mcp_tool
from mcp import Client
import asyncio

load_dotenv()
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")

messages = [
    {
        "role": "system",
        "content": "你是一个古风小生"
    }
]
conversation_summary = ""


def call_llm(context, tools=None):
    body = {
        "model": "deepseek-flash",
        "messages": context,
        "thinking": {
            "type": "disabled"
        },
        "stream": False
    }

    if tools:
        body["tools"] = tools

    response = requests.post(
            "https://api.deepseek.com/chat/completions",
            headers={
                "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
                "Content-Type": "application/json"
            },
            json=body,
            timeout=60
        )
    # if not response.ok:
    #     print("DeepSeek status:", response.status_code)
    #     print("DeepSeek error:", response.text)
    #     print(
    #         "发送的 messages:",
    #         json.dumps(context, ensure_ascii=False, indent=2)
    #     )
    response.raise_for_status()
    return response.json()

def update_summary(old_messages):
    global conversation_summary
    text = f"""
            当前已有摘要：
            {conversation_summary}

            下面是新的旧对话：
            {messages_to_text(old_messages)}

            请更新摘要，保留重要事实、用户要求、当前任务进度，
            删除闲聊和重复信息。
            """

    result = call_llm([
        {
            "role": "user",
            "content": text
        }
    ])

    new_summary = result["choices"][0]["message"]["content"]

    conversation_summary = new_summary

def build_context():
    context = []
    context.append(messages[0])

    if conversation_summary:
        context.append({
            "role": "system",
            "content": "之前对话摘要：" + conversation_summary
        })

    context.extend(messages[1:][-10:])
    return context

def compact_history():
    if len(messages) - 1 > 20:
        update_summary(messages[1:11])
        del messages[1:11]

def messages_to_text(messages):
    text = ""
    for message in messages:
        text += message["role"] + ":" + message["content"] + "\n"
    return text

async def run_agent(context):
    working_context = context.copy()
    # max_steps = 10
    llm_step = 0
    tool_calls_count = 0

    async with Client("http://127.0.0.1:8000/mcp") as mcp_client:
        tools = await get_tool_schemas(mcp_client, EXPOSED_TOOLS)

        while llm_step < 9:
            result = call_llm(working_context, tools)
            llm_step += 1

            message = result["choices"][0]["message"]
            finish_reason = result["choices"][0]["finish_reason"]

            if finish_reason == "tool_calls":
                working_context.append(message)
                for tool_call in message["tool_calls"]:
                    if tool_calls_count >= 12:
                        raise RuntimeError("Agent exceeded maximum tool calls")

                    allowed, reason = check_tool_call(tool_call)

                    if not allowed:
                        tool_res = {
                            "ok": False,
                            "error": f"Permission denied: {reason}"
                        }
                    else:
                        tool_res = await call_mcp_tool(mcp_client, tool_call)
                    
                    working_context.append({
                        "role": "tool",
                        "tool_call_id": tool_call["id"],
                        "content": json.dumps(
                            tool_res,
                            ensure_ascii=False
                        )
                    })

                    print(
                        f"[Tool #{tool_calls_count}]",
                        tool_call["function"]["name"],
                        tool_call["function"]["arguments"]
                    )

                    tool_calls_count += 1
                continue
            else:
                return message["content"]
    raise RuntimeError("Agent exceeded maximum steps")


def chat_with_agent(user_message):

    messages.append({
        "role": "user",
        "content": user_message
    })
    context = build_context()
    result = asyncio.run(run_agent(context))
    messages.append({
        "role": "assistant",
        "content": result
    })
    compact_history()

    return result