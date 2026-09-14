const https = require('https')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// Target directory for Windows portable postgres
const targetDir = path.join(__dirname, '../pgsql-win64')

console.log('=======================================================')
console.log('  Portable PostgreSQL 16 (Windows x64) Package Builder ')
console.log('=======================================================')

if (fs.existsSync(path.join(targetDir, 'bin', 'pg_ctl.exe'))) {
  console.log(`✅ Portable PostgreSQL already present in: ${targetDir}`)
  process.exit(0)
}

console.log(`Creating target directory: ${targetDir}`)
fs.mkdirSync(targetDir, { recursive: true })

// Instructions for packaging on Mac / Linux build machines
console.log(`
ℹ️ To build the Windows installer with embedded PostgreSQL:
1. Download portable PostgreSQL 16 binaries for Windows (x64) from official release:
   https://github.com/adang1345/deluxe-postgresql-portable/releases or official EDB PostgreSQL archive.
2. Extract the 'pgsql' contents (bin, lib, share, symbols) directly into:
   "${targetDir}"
3. Run "npm run build:win" in the frontend directory.
`)
