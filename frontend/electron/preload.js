const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  openCashDrawer: () => ipcRenderer.invoke('open-cash-drawer'),
  getVersion: () => ipcRenderer.invoke('get-version'),
  isElectron: true,
})
