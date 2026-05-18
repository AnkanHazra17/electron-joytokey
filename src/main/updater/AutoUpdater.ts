import { autoUpdater } from 'electron-updater'
import { app } from 'electron'
import type { UpdateStatus } from '@shared/types'
import log from '../logger'

type SendFn = (status: UpdateStatus) => void

export function initAutoUpdater(send: SendFn): void {
  if (!app.isPackaged) return

  autoUpdater.logger = log
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => send({ state: 'checking' }))
  autoUpdater.on('update-available', (info) =>
    send({ state: 'available', version: info.version })
  )
  autoUpdater.on('update-not-available', () => send({ state: 'idle' }))
  autoUpdater.on('download-progress', (p) =>
    send({ state: 'downloading', percent: Math.round(p.percent) })
  )
  autoUpdater.on('update-downloaded', (info) =>
    send({ state: 'ready', version: info.version })
  )
  autoUpdater.on('error', (e) =>
    send({ state: 'error', error: e.message })
  )

  // Check 3 seconds after ready-to-show to avoid blocking startup
  setTimeout(() => {
    autoUpdater.checkForUpdatesAndNotify().catch((e) =>
      log.warn('[AutoUpdater] check failed:', e.message)
    )
  }, 3000)
}

export function installUpdate(): void {
  autoUpdater.quitAndInstall()
}
