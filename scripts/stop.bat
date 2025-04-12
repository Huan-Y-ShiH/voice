@echo off
echo it is stoping the server...

:: 停止Nginx
taskkill /F /IM nginx.exe >nul 2>nul

:: 停止Node.js服务器
taskkill /F /IM node.exe >nul 2>nul

echo all server is stoped! 