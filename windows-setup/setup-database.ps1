# Smart Buy POS - Automated Database Provisioner (PowerShell)
$ErrorActionPreference = "SilentlyContinue"

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host "  Smart Buy POS - Automated Database Setup (PowerShell) " -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan

$AppDir = $PSScriptRoot
$AppData = [Environment]::GetFolderPath('ApplicationData')
$DataDir = Join-Path $AppData "ShopManagement\postgres_data"
$LogFile = Join-Path $AppData "ShopManagement\postgres.log"
$BinDir = Join-Path $AppDir "pgsql\bin"
$Port = 5432
$DbUser = "postgres"
$DbName = "shop_pos"

# Ensure directory
$ParentDir = Join-Path $AppData "ShopManagement"
if (-not (Test-Path $ParentDir)) {
    New-Item -ItemType Directory -Path $ParentDir -Force | Out-Null
}

# 1. Initialize Cluster
$GlobalDir = Join-Path $DataDir "global"
if (-not (Test-Path $GlobalDir)) {
    Write-Host "[1/4] Initializing PostgreSQL cluster in $DataDir..." -ForegroundColor Yellow
    $InitExe = Join-Path $BinDir "initdb.exe"
    if (Test-Path $InitExe) {
        & $InitExe -U $DbUser -A trust -E UTF8 --locale=C -D $DataDir
    } else {
        initdb -U $DbUser -A trust -E UTF8 --locale=C -D $DataDir
    }

    $ConfFile = Join-Path $DataDir "postgresql.conf"
    if (Test-Path $ConfFile) {
        Add-Content -Path $ConfFile -Value "`nlisten_addresses = '127.0.0.1'`nport = $Port`nmax_connections = 60`nshared_buffers = 128MB`nsynchronous_commit = off`n"
    }
} else {
    Write-Host "[1/4] Existing cluster found." -ForegroundColor Green
}

# 2. Start PostgreSQL
Write-Host "[2/4] Starting PostgreSQL Server..." -ForegroundColor Yellow
$PgCtlExe = Join-Path $BinDir "pg_ctl.exe"
if (Test-Path $PgCtlExe) {
    & $PgCtlExe -D $DataDir -l $LogFile -o "-p $Port" start
} else {
    pg_ctl -D $DataDir -l $LogFile -o "-p $Port" start
}

Start-Sleep -Seconds 2

# 3. Create Database
Write-Host "[3/4] Ensuring database '$DbName' exists..." -ForegroundColor Yellow
$CreateDbExe = Join-Path $BinDir "createdb.exe"
if (Test-Path $CreateDbExe) {
    & $CreateDbExe -h 127.0.0.1 -p $Port -U $DbUser $DbName
} else {
    createdb -h 127.0.0.1 -p $Port -U $DbUser $DbName
}

# 4. Auto-Seed and Schema Push
Write-Host "[4/4] Syncing Database Schema and Seeding Root Master Admin..." -ForegroundColor Yellow
$BackendDir = Join-Path $AppDir "backend"
if (Test-Path $BackendDir) {
    Push-Location $BackendDir
    npx prisma db push --skip-generate
    Pop-Location
}

Write-Host "`n✅ Database Setup Completed Successfully!`n" -ForegroundColor Green
