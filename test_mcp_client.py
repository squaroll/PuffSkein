import asyncio
from mcp import Client


async def main():
    async with Client("http://localhost:8000/mcp") as client:

        tools = await client.list_tools()

        for tool in tools.tools:
            print("工具名称：", tool.name)
            print("描述：", tool.description)
            print("参数 Schema：", tool.input_schema)
            print()

        result = await client.call_tool(
            "add_numbers",
            {
                "a": 10,
                "b": 20
            }
        )

        print("工具调用结果：")
        print(result.content)
        print("结构化结果：")
        print(result.structured_content)


asyncio.run(main())