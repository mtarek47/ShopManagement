@echo off
setlocal enabledelayedexpansion

title Smart Buy POS - Automated Database Provisioner
echo =======================================================
echo   Smart Buy POS - Automated Database Setup Script
echo =======================================================
echo.

:: 1. Define Paths
set "APP_DIR=%~dp0"
set "DATA_DIR=%APPDATA%\ShopManagement\postgres_data"
set "LOG_FILE=%APPDATA%\ShopManagement\postgres.log"
set "BIN_DIR=%APP_DIR%pgsql\bin"
set "PORT=5432"
set "DB_USER=postgres"
set "DB_PASS=postgres"
set "DB_NAME=shop_pos"

:: Check if local bin exists or fallback to system path
if not exist "%BIN_DIR%\pg_ctl.exe" (
    set "BIN_DIR="
)

echo [1/5] Checking Data Directory...
if not exist "%APPDATA%\ShopManagement" (
    mkdir "%APPDATA%\ShopManagement"
)

:: 2. Initialize Cluster if not exists
if not exist "%DATA_DIR%\global" (
    echo [2/5] Initializing PostgreSQL cluster in %DATA_DIR%...
    if defined BIN_DIR (
        "%BIN_DIR%\initdb.exe" -U %DB_USER% -A trust -E UTF8 --locale=C -D "%DATA_DIR%"
    ) else (
        initdb.exe -U %DB_USER% -A trust -E UTF8 --locale=C -D "%DATA_DIR%"
    )
    
    :: Append POS configuration
    echo listen_addresses = '127.0.0.1' >> "%DATA_DIR%\postgresql.conf"
    echo port = %PORT% >> "%DATA_DIR%\postgresql.conf"
    echo max_connections = 60 >> "%DATA_DIR%\postgresql.conf"
    echo shared_buffers = 128MB >> "%DATA_DIR%\postgresql.conf"
    echo synchronous_commit = off >> "%DATA_DIR%\postgresql.conf"
) else (
    echo [2/5] Existing database cluster detected.
)

:: 3. Start PostgreSQL Server
echo [3/5] Starting PostgreSQL Engine...
if defined BIN_DIR (
    "%BIN_DIR%\pg_ctl.exe" -D "%DATA_DIR%" -l "%LOG_FILE%" -o "-p %PORT%" start
) else (
    pg_ctl.exe -D "%DATA_DIR%" -l "%LOG_FILE%" -o "-p %PORT%" start
)

:: Wait 2 seconds for socket
timeout /t 2 /nobreak >nul

:: 4. Create Database if not exists
echo [4/5] Ensuring Database "%DB_NAME%" exists...
if defined BIN_DIR (
    "%BIN_DIR%\createdb.exe" -h 127.0.0.1 -p %PORT% -U %DB_USER% %DB_NAME% 2>nul
) else (
    createdb.exe -h 127.0.0.1 -p %PORT% -U %DB_USER% %DB_NAME% 2>nul
)

:: 5. Run Prisma Deploy / Schema Push if Node is available
echo [5/5] Syncing Database Schema and Seeding Master Super Admin...
if exist "%APP_DIR%backend" (
    cd /d "%APP_DIR%backend"
    call npx prisma db push --skip-generate 2>nul
    call node src/index.js --seed-only 2>nul
)

echo.
echo =======================================================
echo   Database Provisioning Completed Successfully!
echo =======================================================
echo.
exit /b 0
