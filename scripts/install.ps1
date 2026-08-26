# ==============================================================================
# Demo Shop POS - Automated Installation & Auto-Boot Setup Script (Windows)
# ==============================================================================

Write-Host "🛒 Installing Demo Shop Offline-First POS System..." -ForegroundColor Cyan

$CurrentDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $CurrentDir
$BackendDir = Join-Path $ProjectRoot "backend"
$DatabaseDir = Join-Path $ProjectRoot "database"
$FrontendDir = Join-Path $ProjectRoot "frontend"

# 1. Check Node.js
Write-Host "🔍 Checking Node.js runtime..." -ForegroundColor Yellow
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "❌ Node.js is not installed. Please install Node.js v18+ first."
    Exit 1
}
Write-Host "✅ Node.js detected: $(node --version)" -ForegroundColor Green

# 2. Check PostgreSQL
Write-Host "🔍 Checking PostgreSQL connection..." -ForegroundColor Yellow
if (-not (Get-Command psql -ErrorAction SilentlyContinue)) {
    Write-Warning "⚠️ psql command not found in PATH. Please verify PostgreSQL service is running."
}

# 3. Database Migration & Seeding
Write-Host "🌱 Running Database Migration and Seeding..." -ForegroundColor Yellow
Set-Location $DatabaseDir
npx prisma db push --schema=schema.prisma
node seeders/seed.js

# 4. Register Backend as a Windows Background Service via NSSM (if NSSM present) or PM2
Write-Host "⚙️ Registering POS Backend Service..." -ForegroundColor Yellow
if (Get-Command nssm -ErrorAction SilentlyContinue) {
    nssm stop PosBackendService 2>$null
    nssm remove PosBackendService confirm 2>$null
    nssm install PosBackendService (Get-Command node).Source (Join-Path $BackendDir "src\index.js")
    nssm set PosBackendService AppDirectory $BackendDir
    nssm set PosBackendService Start SERVICE_AUTO_START
    nssm start PosBackendService
    Write-Host "✅ POS Backend registered as Windows Service (Auto-Start enabled)." -ForegroundColor Green
} else {
    Write-Warning "⚠️ NSSM not detected. Setting up PM2 auto-startup..."
    npm install -g pm2 pm2-windows-startup
    pm2-startup install
    pm2 start (Join-Path $BackendDir "src\index.js") --name "pos-backend"
    pm2 save
    Write-Host "✅ PM2 process saved for auto-startup on boot." -ForegroundColor Green
}

# 5. Place Electron Shortcut into Windows Startup Folder (Kiosk Mode)
$StartupFolder = [Environment]::GetFolderPath('Startup')
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut((Join-Path $StartupFolder "DemoShopPOS.lnk"))
$Shortcut.TargetPath = "npm"
$Shortcut.Arguments = "run electron"
$Shortcut.WorkingDirectory = $FrontendDir
$Shortcut.IconLocation = (Join-Path $FrontendDir "favicon.ico")
$Shortcut.Description = "Demo Shop POS System (Kiosk Auto-Boot)"
$Shortcut.Save()

Write-Host "✅ POS Desktop Client shortcut added to Windows Startup folder." -ForegroundColor Green
Write-Host ""
Write-Host "🎉 Installation Completed Successfully!" -ForegroundColor Cyan
Write-Host "   Default Admin Phone: 01700000000"
Write-Host "   Default Admin Password: admin123"
