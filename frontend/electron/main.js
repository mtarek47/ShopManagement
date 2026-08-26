const { app, BrowserWindow, Menu, ipcMain, shell } = require('electron')
const path = require('path')
const http = require('http')
const { fork } = require('child_process')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged
const isMac = process.platform === 'darwin'
const isWindows = process.platform === 'win32'

let mainWindow
let splashWindow
let backendProcess = null

/**
 * In Production (Packaged App), automatically spawn the Express backend
 * In Development, do nothing so developer can use nodemon / hot-reload!
 */
function startPackagedBackend() {
  if (isDev) {
    console.log('[Electron] Running in Development mode. Connecting to external backend on :5000')
    return
  }

  try {
    const backendPath = app.isPackaged
      ? path.join(process.resourcesPath, 'backend', 'src', 'index.js')
      : path.join(__dirname, '../../backend/src/index.js')

    const backendCwd = app.isPackaged
      ? path.join(process.resourcesPath, 'backend')
      : path.join(__dirname, '../../backend')

    console.log('[Electron] Spawning bundled background server from:', backendPath)

    backendProcess = fork(backendPath, [], {
      cwd: backendCwd,
      env: {
        ...process.env,
        PORT: '5000',
        NODE_ENV: 'production',
      },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc']
    })

    backendProcess.stdout?.on('data', (data) => {
      console.log(`[Bundled Backend]: ${data}`)
    })

    backendProcess.stderr?.on('data', (data) => {
      console.error(`[Bundled Backend ERR]: ${data}`)
    })

    backendProcess.on('exit', (code) => {
      console.log(`[Bundled Backend] Exited with code ${code}`)
    })
  } catch (err) {
    console.error('[Electron] Failed to start bundled backend process:', err)
  }
}

function createSplashWindow() {
  splashWindow = new BrowserWindow({
    width: 420,
    height: 320,
    frame: false,
    alwaysOnTop: true,
    transparent: true,
    resizable: false,
    webPreferences: { nodeIntegration: false },
  })
  splashWindow.loadFile(path.join(__dirname, 'splash.html'))
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 1024,
    minHeight: 650,
    show: false,
    title: 'Smart Buy — Offline-First POS System',
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  // Fullscreen / Kiosk mode behavior for Production
  if (!isDev) {
    if (isWindows) {
      mainWindow.setKiosk(true)
    } else {
      mainWindow.setFullScreen(true)
    }
  } else {
    mainWindow.maximize()
  }

  const devUrl = 'http://localhost:3000'
  const prodUrl = `file://${path.join(__dirname, '../dist/index.html')}`

  mainWindow.loadURL(isDev ? devUrl : prodUrl)

  mainWindow.once('ready-to-show', () => {
    if (splashWindow) {
      splashWindow.destroy()
      splashWindow = null
    }
    mainWindow.show()
    mainWindow.focus()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Open external links in default OS browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  }
}

// Cross-Platform Native Menu (macOS Copy/Paste/Cut & shortcuts)
function setupApplicationMenu() {
  const template = [
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front' },
          { type: 'separator' },
          { role: 'window' }
        ] : [
          { role: 'close' }
        ])
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

// Health check retry loop (Works on Mac & Windows)
async function waitForBackend(retries = 25, interval = 1200) {
  return new Promise((resolve) => {
    const tryConnect = (attempt) => {
      if (attempt <= 0) {
        console.log('[Electron] Backend check finished. Launching UI...')
        resolve()
        return
      }

      const req = http.get('http://localhost:5000/health', (res) => {
        if (res.statusCode === 200) {
          console.log('[Electron] Backend API connection established!')
          resolve()
        } else {
          setTimeout(() => tryConnect(attempt - 1), interval)
        }
      })

      req.on('error', () => {
        setTimeout(() => tryConnect(attempt - 1), interval)
      })

      req.setTimeout(1000, () => {
        req.destroy()
        setTimeout(() => tryConnect(attempt - 1), interval)
      })
    }

    tryConnect(retries)
  })
}

app.whenReady().then(async () => {
  setupApplicationMenu()

  // 1. In production, start the bundled backend server
  startPackagedBackend()

  // 2. Show splash screen while waiting for backend
  if (!isDev) {
    createSplashWindow()
    await waitForBackend()
  }

  // 3. Open main window
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (!isMac) app.quit()
})

// Clean up background server on exit
app.on('before-quit', () => {
  if (backendProcess) {
    console.log('[Electron] Terminating background server...')
    try {
      backendProcess.kill('SIGTERM')
    } catch (_) {}
  }
})

// IPC: Cash drawer & printer support
ipcMain.handle('open-cash-drawer', async () => {
  return { success: true, platform: process.platform }
})

ipcMain.handle('get-version', () => app.getVersion())
ipcMain.handle('get-platform', () => process.platform)
