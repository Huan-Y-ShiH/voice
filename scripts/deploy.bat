@echo off
setlocal enabledelayedexpansion

echo Starting deployment process...

:: Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Error: Node.js is not installed
    exit /b 1
)

:: Check if Nginx is installed
where nginx >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Error: Nginx is not installed
    exit /b 1
)

:: Install dependencies
echo Installing dependencies...
call npm install

if %ERRORLEVEL% neq 0 (
    echo Error: Failed to install dependencies
    exit /b 1
)

:: Build project
echo Building project...
call npm run build

if %ERRORLEVEL% neq 0 (
    echo Error: Failed to build project
    exit /b 1
)

:: Copy Nginx configs
echo Configuring Nginx...
copy /Y nginx\voice-assistant.conf C:\nginx\conf\sites-enabled\ >nul 2>nul
copy /Y nginx\ssl.conf C:\nginx\conf\sites-enabled\ >nul 2>nul

if %ERRORLEVEL% neq 0 (
    echo Creating sites-enabled directory...
    mkdir C:\nginx\conf\sites-enabled 2>nul
    copy /Y nginx\voice-assistant.conf C:\nginx\conf\sites-enabled\ >nul 2>nul
    copy /Y nginx\ssl.conf C:\nginx\conf\sites-enabled\ >nul 2>nul
)

:: Create SSL directory if not exists
if not exist "C:\nginx\ssl" (
    echo Creating SSL directory...
    mkdir C:\nginx\ssl
)

:: Restart Nginx
echo Restarting Nginx...
taskkill /F /IM nginx.exe >nul 2>nul
start nginx

:: Start Node.js server
echo Starting API server...
start "Voice Assistant API" node server.js

echo Deployment complete!
echo You can now access the application at:
echo - HTTP:  http://www.srtp.site
echo - HTTPS: https://www.srtp.site 