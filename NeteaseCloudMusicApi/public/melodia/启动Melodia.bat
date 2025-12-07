@echo off
title Dou

echo ========================================
echo    Dou Music Player Starting...
echo ========================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [Error] Node.js not found
    echo Please install: https://nodejs.org/
    pause
    exit /b 1
)

echo [1/2] Starting API server...
cd /d "%~dp0..\NeteaseCloudMusicApi"
start "API" cmd /c "node app.js"

timeout /t 2 /nobreak >nul

echo [2/2] Starting web server...
cd /d "%~dp0"

timeout /t 1 /nobreak >nul
start http://localhost:8080

node server.js

pause
