$python = ".\.venv\Scripts\python.exe"

Write-Host "Starting MCP Tool Server..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "$python mcp_tool_server.py"

Start-Sleep -Seconds 1

Write-Host "Starting Web Server..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "$python server.py"

Write-Host "All services started."

Write-Host "Opening browser..."
Start-Process "http://127.0.0.1:5000"