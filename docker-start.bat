@echo off
title Smart Buy POS - All-In-One Web Launcher
color 0A
cls
echo ====================================================================
echo               Smart Buy POS — Web Application Launcher
echo ====================================================================
echo.

REM 1. Check if Docker is installed
where docker >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo [ERROR] Docker is not installed or not added to your system PATH!
    echo.
    echo Please install Docker Desktop for Windows:
    echo https://www.docker.com/products/docker-desktop/
    echo.
    echo After installing, restart your computer and run this file again.
    echo ====================================================================
    pause
    exit /b 1
)

REM 2. Check if Docker daemon is actively running
docker info >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    color 0E
    echo [NOTICE] Docker is installed, but Docker Desktop is NOT running.
    echo Attempting to start Docker Desktop...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe" >nul 2>&1
    
    echo Waiting for Docker engine to become active (up to 45 seconds)...
    set /a attempts=0
    :WAIT_DOCKER
    timeout /t 3 >nul
    docker info >nul 2>&1
    if %ERRORLEVEL% EQU 0 goto DOCKER_READY
    set /a attempts+=1
    if %attempts% GEQ 15 (
        color 0C
        echo.
        echo [ERROR] Docker Desktop failed to start automatically.
        echo Please launch 'Docker Desktop' from your Start Menu, wait until
        echo it says 'Engine running', and then run docker-start.bat again.
        echo.
        pause
        exit /b 1
    )
    goto WAIT_DOCKER
)

:DOCKER_READY
color 0A
echo.
echo [1/3] Docker Desktop is active and ready.
echo [2/3] Building and launching Smart Buy POS containers...
echo       (First launch may take 2-3 minutes to download and build images)
echo.

cd /d "%~dp0"
docker compose --env-file .env.docker up -d --build

if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo.
    echo [ERROR] Docker Compose encountered an error starting the services.
    echo Review the error log above.
    echo.
    pause
    exit /b 1
)

echo.
echo [3/3] Containers started successfully!
echo ====================================================================
echo   Smart Buy POS is live at: http://localhost:3000
echo.
echo   Default Login Accounts:
echo   - Admin:        Phone: 01700000000   | Password: admin123
echo   - Super Admin:  Phone: 01999999999   | Password: superadmin123
echo ====================================================================
echo.
echo Opening Smart Buy POS in your default web browser...
timeout /t 5 >nul
start http://localhost:3000

echo.
echo Application is running in the background.
echo To safely stop the application anytime, double-click: docker-stop.bat
echo.
pause
