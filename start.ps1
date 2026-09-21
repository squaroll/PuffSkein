$python = ".\.venv\Scripts\python.exe"

# 启动MCP服务器
Write-Host "Starting MCP Tool Server..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "$python mcp_tool_server.py"

Start-Sleep -Seconds 1

# 启动Web服务器
Write-Host "Starting Web Server..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "$python server.py"

Write-Host "All services started."

# 自动打开浏览器页面
Write-Host "Opening browser..."
Start-Process "http://127.0.0.1:5000"