@echo off
echo it is starting the server...

:: 启动Nginx
taskkill /F /IM nginx.exe >nul 2>nul
start nginx

:: 启动Node.js服务器
start "Voice Assistant API" node server.js

echo all server is started!
echo you can access the application through the following address:
echo - production environment: http://localhost
echo - development environment: http://localhost:3000 (use npm run dev) 