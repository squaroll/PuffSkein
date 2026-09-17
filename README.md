# PuffSkein Agent

一个用于学习 Agent、Harness 与 MCP 的小型项目。

浏览器将消息发送到 Flask，Agent 调用 LLM；当 LLM 提议使用工具时，Harness 会经过策略检查，再通过 MCP Client 调用本地 MCP Tool Server。

## 架构概览

```text
Browser → Flask (/chat) → Agent → LLM
                              ↓
                         Policy check
                              ↓
                     MCP Client → MCP Tool Server → Tool
```

## 准备

1. 创建并激活 Python 虚拟环境：

   ```powershell
   py -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```

2. 安装仓库声明的依赖：

   ```powershell
   python -m pip install -r requirements.txt
   ```

3. 复制 `.env.example` 为 `.env`。
4. 在 `.env` 中填入自己的 `DEEPSEEK_API_KEY`；不要提交 `.env`。

## 启动

### 方法一
先启动 MCP Tool Server：

```powershell
.\.venv\Scripts\python.exe mcp_tool_server.py
```

再在另一个终端启动 Web Server：

```powershell
.\.venv\Scripts\python.exe server.py
```

然后访问终端输出的本地地址（通常是 `http://127.0.0.1:5000`）。

### 方法二
> 暂时仅支持 Windows 操作系统

运行 `.\start.ps1` 同时启动两个服务。

## 主要文件

- `server.py`：Flask HTTP 接口和静态页面入口。
- `agent.py`：Agent 循环、上下文、LLM 调用与 Tool Call 编排。
- `policy.py`：定义向模型暴露哪些工具，以及哪些调用被允许执行。
- `mcp_client.py`：获取 MCP Tool Schema、调用 MCP Tool。
- `mcp_tool_server.py`：启动本地 MCP Server。
- `tools.py`：实际工具实现；当前有加法和减法工具。

## 安全约定

- `.env` 包含 API Key，只保留在本机。
- LLM 只能提出工具调用，不能自行执行；执行前必须经过 `policy.py`。
- 页面会将 Markdown 回复解析后净化，避免直接将不可信 HTML 注入页面。
