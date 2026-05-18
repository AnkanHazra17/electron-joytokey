import { BrowserWindow, shell } from 'electron'
import { join } from 'path'

let mainWindow: BrowserWindow | null = null

export function createWindow(): BrowserWindow {
  mainWindow = new BrowserWindow({
    width: 960,
    height: 680,
    minWidth: 800,
    minHeight: 560,
    show: false,
    titleBarStyle: "hiddenInset",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      preload: join(__dirname, '../preload/index.js'),
    },
  })

  mainWindow.once('ready-to-show', () => mainWindow!.show())

  // Open external links in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

export function showWindow(): void {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  }
}
