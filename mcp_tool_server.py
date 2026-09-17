from mcp.server import MCPServer
from tools import add_numbers, subtract_numbers

mcp = MCPServer("agent tools")
# mcp = MCPServer("agent tools", debug=True, log_level="DEBUG")

# @mcp.tool()
# def add_numbers(a: float, b: float) -> float:
#     return a + b;

# @mcp.tool()
# def subtract_numbers(a: float, b: float) -> float:
#     return a - b;

mcp.add_tool(add_numbers)
mcp.add_tool(subtract_numbers)

if __name__ == "__main__":
    mcp.run(
        transport="streamable-http",
        host="127.0.0.1",
        port=8000,
        streamable_http_path="/mcp",
    )