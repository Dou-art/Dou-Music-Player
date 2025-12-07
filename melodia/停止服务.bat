@echo off
chcp 65001 >nul
echo 正在停止服务...
taskkill /f /im node.exe >nul 2>nul
taskkill /f /im python.exe >nul 2>nul
echo 服务已停止
timeout /t 2
