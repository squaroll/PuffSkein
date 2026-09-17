EXPOSED_TOOLS = {
    "add_numbers"
}

ALLOWED_TOOLS = {
    "add_numbers"
}

def check_tool_call(tool_call):
    tool_name = tool_call["function"]["name"]

    if tool_name not in ALLOWED_TOOLS:
        return False, f"Tool '{tool_name}' is not allowed."

    return True, ""