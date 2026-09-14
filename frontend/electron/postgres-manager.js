const path = require('path')
const fs = require('fs')
const { spawn, execFile, execSync } = require('child_process')
const net = require('net')

const isWindows = process.platform === 'win32'
const isPackaged = process.mainModule?.filename.indexOf('app.asar') !== -1 || process.resourcesPath !== undefined

/**
 * Portable PostgreSQL Manager for Windows
 * Automatically checks, initializes, starts, and stops embedded PostgreSQL.
 */
class PostgresManager {
  constructor(options = {}) {
    this.port = options.port || 5432
    this.user = options.user || 'postgres'
    this.password = options.password || 'postgres'
    this.dbName = options.dbName || 'shop_pos'

    // Determine PostgreSQL binary directories
    if (isPackaged && process.resourcesPath) {
      this.binDir = path.join(process.resourcesPath, 'pgsql', 'bin')
      this.shareDir = path.join(process.resourcesPath, 'pgsql', 'share')
    } else {
      this.binDir = path.join(__dirname, '../../pgsql-win64/bin')
      this.shareDir = path.join(__dirname, '../../pgsql-win64/share')
    }

    // Determine Data directory (in %APPDATA%/ShopManagement/postgres_data)
    const appData = process.env.APPDATA || (process.platform === 'darwin' ? path.join(process.env.HOME, 'Library/Application Support') : '/var/lib')
    this.dataDir = options.dataDir || path.join(appData, 'ShopManagement', 'postgres_data')
    this.logFile = path.join(appData, 'ShopManagement', 'postgres.log')

    this.process = null
    this.isEmbedded = isWindows && fs.existsSync(path.join(this.binDir, 'pg_ctl.exe'))
  }

  /**
   * Check if a port is currently listening
   */
  checkPort(port = this.port) {
    return new Promise((resolve) => {
      const socket = new net.Socket()
      socket.setTimeout(800)
      socket.on('connect', () => {
        socket.destroy()
        resolve(true) // Port is open / database already running!
      })
      socket.on('timeout', () => {
        socket.destroy()
        resolve(false)
      })
      socket.on('error', () => {
        resolve(false)
      })
      socket.connect(port, '127.0.0.1')
    })
  }

  /**
   * Ensure data directory exists and run initdb if needed
   */
  async ensureCluster() {
    if (!this.isEmbedded) {
      console.log('[PostgresManager] Non-embedded or non-Windows environment. Skipping portable cluster init.')
      return
    }

    const initdbExe = path.join(this.binDir, 'initdb.exe')
    const postmasterOpts = path.join(this.dataDir, 'postmaster.opts')
    const globalDir = path.join(this.dataDir, 'global')

    // Create parent directories if not present
    const parentDir = path.dirname(this.dataDir)
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true })
    }

    // If data cluster does not exist, initialize it
    if (!fs.existsSync(globalDir)) {
      console.log(`[PostgresManager] Initializing new PostgreSQL cluster in: ${this.dataDir}`)
      fs.mkdirSync(this.dataDir, { recursive: true })

      try {
        const initArgs = [
          '-U', this.user,
          '-A', 'trust',
          '-E', 'UTF8',
          '--locale=C',
          '-D', this.dataDir,
        ]
        if (fs.existsSync(this.shareDir)) {
          initArgs.push('-L', this.shareDir)
        }

        execFileSync(initdbExe, initArgs, { stdio: 'inherit' })
        console.log('[PostgresManager] ✅ Database cluster initialized successfully.')

        // Customize postgresql.conf to listen locally and optimize for POS
        const confPath = path.join(this.dataDir, 'postgresql.conf')
        if (fs.existsSync(confPath)) {
          let conf = fs.readFileSync(confPath, 'utf8')
          conf += `\n# --- POS Embedded Settings ---\n`
          conf += `listen_addresses = '127.0.0.1'\n`
          conf += `port = ${this.port}\n`
          conf += `max_connections = 60\n`
          conf += `shared_buffers = 128MB\n`
          conf += `synchronous_commit = off\n` // high throughput for retail POS
          fs.writeFileSync(confPath, conf, 'utf8')
        }
      } catch (err) {
        console.error('[PostgresManager] ❌ Failed to initdb:', err)
        throw err
      }
    }
  }

  /**
   * Start PostgreSQL server and ensure the target database exists
   */
  async start() {
    // 1. Check if PostgreSQL is already running on port 5432
    const alreadyRunning = await this.checkPort(this.port)
    if (alreadyRunning) {
      console.log(`[PostgresManager] PostgreSQL is already active on port ${this.port}. Reusing running instance.`)
      return true
    }

    if (!this.isEmbedded) {
      console.log('[PostgresManager] Running in external database mode.')
      return true
    }

    await this.ensureCluster()

    console.log(`[PostgresManager] Starting embedded PostgreSQL server on port ${this.port}...`)
    const pgCtlExe = path.join(this.binDir, 'pg_ctl.exe')

    try {
      execFileSync(pgCtlExe, [
        '-D', this.dataDir,
        '-l', this.logFile,
        '-o', `-p ${this.port}`,
        'start',
      ], { stdio: 'inherit' })

      // Wait up to 10 seconds for port to open
      let started = false
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 500))
        started = await this.checkPort(this.port)
        if (started) break
      }

      if (!started) {
        throw new Error('PostgreSQL process started but port 5432 did not respond in time.')
      }

      console.log('[PostgresManager] ✅ Embedded PostgreSQL is online and accepting connections.')

      // Ensure target database exists
      await this.ensureDatabase()
      return true
    } catch (err) {
      console.error('[PostgresManager] ❌ Failed to start PostgreSQL:', err)
      return false
    }
  }

  /**
   * Ensure shop_pos database exists
   */
  async ensureDatabase() {
    if (!this.isEmbedded) return
    const createdbExe = path.join(this.binDir, 'createdb.exe')
    if (!fs.existsSync(createdbExe)) return

    try {
      execFileSync(createdbExe, [
        '-h', '127.0.0.1',
        '-p', this.port.toString(),
        '-U', this.user,
        this.dbName,
      ], { stdio: 'ignore' })
      console.log(`[PostgresManager] ✅ Created database "${this.dbName}".`)
    } catch (err) {
      // createdb returns error if database already exists, which is normal
      console.log(`[PostgresManager] Database "${this.dbName}" is ready.`)
    }
  }

  /**
   * Cleanly stop PostgreSQL on application exit
   */
  async stop() {
    if (!this.isEmbedded) return
    const pgCtlExe = path.join(this.binDir, 'pg_ctl.exe')
    if (!fs.existsSync(pgCtlExe) || !fs.existsSync(this.dataDir)) return

    console.log('[PostgresManager] Stopping embedded PostgreSQL server...')
    try {
      execFileSync(pgCtlExe, [
        '-D', this.dataDir,
        '-m', 'fast',
        'stop',
      ], { stdio: 'ignore' })
      console.log('[PostgresManager] ✅ PostgreSQL stopped cleanly.')
    } catch (err) {
      // silent
    }
  }
}

module.exports = PostgresManager
