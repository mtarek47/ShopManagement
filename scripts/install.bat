@echo off
REM ==============================================================================
REM Demo Shop POS - Windows Batch Quick Launcher & Installer
REM ==============================================================================

echo [POS SETUP] Starting Demo Shop POS Setup...

cd /d "%~dp0\..\database"
echo [POS SETUP] Syncing Database...
call npx prisma db push --schema=schema.prisma
call node seeders/seed.js

cd /d "%~dp0\..\backend"
echo [POS SETUP] Starting Backend Server...
start "POS-Backend" cmd /k "npm start"

cd /d "%~dp0\..\frontend"
echo [POS SETUP] Starting POS Frontend Desktop App...
start "POS-Frontend" cmd /k "npm run electron:dev"

echo [POS SETUP] Ready!
