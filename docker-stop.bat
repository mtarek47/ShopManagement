@echo off
title Smart Buy POS - Safe Shutdown
color 0E
cls
echo ====================================================================
echo              Smart Buy POS — Safe Shutdown Utility
echo ====================================================================
echo.
echo Stopping all Smart Buy POS containers gracefully...
echo.

cd /d "%~dp0"
docker compose down

if %ERRORLEVEL% EQU 0 (
    color 0A
    echo.
    echo ====================================================================
    echo [SUCCESS] Smart Buy POS containers have stopped safely.
    echo All your sales, products, and database data remain preserved.
    echo ====================================================================
) else (
    color 0C
    echo.
    echo [WARNING] Failed to shut down some containers. Check Docker Desktop.
)

echo.
pause
