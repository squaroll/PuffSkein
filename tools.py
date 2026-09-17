def add_numbers(a, b):
    """计算两个数字的和。"""
    if not isinstance(a, (int, float)) or not isinstance(b, (int, float)):
        return {
            "ok": False,
            "error": "arguments must be numbers"
        }
    
    if abs(a) > 10000 or abs(b) > 10000:
        return {
            "ok": False,
            "error": "arguments exceed allowed range"
        }
    return {
        "ok": True,
        "result": a + b
    }

def subtract_numbers(a, b):
    """计算两个数字的差，用第一个数减去第二个数。"""
    if not isinstance(a, (int, float)) or not isinstance(b, (int, float)):
        return {
            "ok": False,
            "error": "arguments must be numbers"
        }
    
    if abs(a) > 10000 or abs(b) > 10000:
        return {
            "ok": False,
            "error": "arguments exceed allowed range"
        }
    return {
        "ok": True,
        "result": a - b
    }