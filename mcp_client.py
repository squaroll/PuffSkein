import asyncio
import json

from mcp import Client
from mcp.types import TextContent


MCP_URL = "http://127.0.0.1:8000/mcp"


async def get_tool_schemas(client, exposed_tools):
    result = await client.list_tools()

    schemas = []

    for tool in result.tools:

        if tool.name not in exposed_tools:
            continue

        schemas.append({
            "type": "function",
            "function": {
                "name": tool.name,
                "description": tool.description or "",
                "parameters": tool.input_schema
            }
        })

    return schemas


# def get_tool_schemas(client, exposed_tools):
#     return asyncio.run(
#         _get_tool_schemas(client, exposed_tools)
#     )

async def call_mcp_tool(client, tool_call):
    tool_name = tool_call["function"]["name"]

    arguments = json.loads(
        tool_call["function"]["arguments"]
    )

    result = await client.call_tool(
        tool_name,
        arguments
    )

    if result.structured_content is not None:
        content = result.structured_content

    else:
        text_parts = []

        for block in result.content:
            if isinstance(block, TextContent):
                text_parts.append(block.text)

        content = "\n".join(text_parts)

    return {
        "ok": not result.is_error,
        "result": content
    }

