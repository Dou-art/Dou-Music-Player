@echo off
start "API" /D "D:\??\test\NeteaseCloudMusicApi" cmd /k node app.js
timeout /t 2 /nobreak >nul
cd /D "D:\??\test\melodia"
python -m http.server 8080
