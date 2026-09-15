@echo off
title Smart Buy POS - Web Launcher
echo ===================================================
echo   Starting Smart Buy POS (Backend + Web App)
echo   (For 1-click Docker run: use docker-start.bat)
echo ===================================================
echo.

cd /d "%~dp0"
call npm start
pause
