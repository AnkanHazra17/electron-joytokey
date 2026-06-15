import { app, globalShortcut, ipcMain, systemPreferences } from 'electron'
import log from './logger'
import { createWindow, getMainWindow } from './window'
import { initTray, rebuildMenu } from './tray'
import { registerHandlers } from './ipc/handlers'
import { hidManager } from './hid/HidManager'
import { isWhizToysDevice } from './hid/DeviceDescriptor'
import { mappingEngine } from './mapper/MappingEngine'
import { profileMatcher } from './mapper/ProfileMatcher'
import { initAutoUpdater, installUpdate } from './updater/AutoUpdater'
import { shutdownCgkey } from './mapper/ActionExecutor'
import ConfigStore from './store/ConfigStore'
import { IPC_CHANNELS } from './ipc/channels'
import type { JoystickEvent, UpdateStatus } from '@shared/types'

// ── Single instance lock ────────────────────────────────────────────────────
if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

app.on('second-instance', () => {
  const win = getMainWindow()
  if (win) {
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

// ── App ready ───────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  const config = ConfigStore.getConfig()

  // Accessibility permission prompt (macOS)
  if (process.platform === 'darwin' && config.launchAtLogin) {
    const trusted = systemPreferences.isTrustedAccessibilityClient(false)
    if (!trusted) {
      systemPreferences.isTrustedAccessibilityClient(true)
      log.info('[main] Accessibility permission requested')
    }
  }

  // Create window
  const win = createWindow()

  // Helper to send events to renderer
  const send = (channel: string, payload: unknown) => {
    if (!win.isDestroyed()) win.webContents.send(channel, payload)
  }

  // IPC handlers
  registerHandlers()

  // Additional handlers that need win reference
  ipcMain.handle(IPC_CHANNELS.UPDATER_INSTALL, () => installUpdate())

  // HID → renderer live events
  hidManager.on('joystick:input', (evt: JoystickEvent) => {
    mappingEngine.processEvent(evt)
    send(IPC_CHANNELS.INPUT_EVENT, evt)
  })
  hidManager.on('devices:changed', (devices) => send(IPC_CHANNELS.DEVICES_CHANGED, devices))

  hidManager.on('device:disconnected', () => {
    mappingEngine.releaseHeldKeys()
  })

  hidManager.on('whiztoys:connected', ({ product, vendorId, productId }: { path: string; product: string; vendorId: number; productId: number }) => {
    const profiles = ConfigStore.getProfiles()
    const existing = profiles.find(
      (p) =>
        (p.deviceName !== undefined && isWhizToysDevice(p.deviceName, '')) ||
        (p.deviceVid === vendorId && p.devicePid === productId)
    )
    const profile = existing ?? ConfigStore.saveProfile(ConfigStore.createWhizToysProfile(product))
    ConfigStore.setActiveProfileId(profile.id)
    mappingEngine.setActiveProfile(profile)
    send(IPC_CHANNELS.PROFILE_ACTIVATED, { profileId: profile.id })
    rebuildTray()
  })

  hidManager.start()

  // Mapping engine → renderer
  mappingEngine.on('input:event', (evt: JoystickEvent) => send(IPC_CHANNELS.INPUT_EVENT, evt))

  // Load active profile
  const activeProfile = ConfigStore.getActiveProfile()
  if (activeProfile) mappingEngine.setActiveProfile(activeProfile)
  mappingEngine.setEnabled(config.globalEnabled)

  // Per-app profile matching
  profileMatcher.start(
    () => ConfigStore.getProfiles(),
    (profileId) => {
      ConfigStore.setActiveProfileId(profileId)
      const profile = ConfigStore.getProfiles().find((p) => p.id === profileId) ?? null
      mappingEngine.setActiveProfile(profile)
      send(IPC_CHANNELS.PROFILE_ACTIVATED, { profileId })
      rebuildTray()
    }
  )

  // System tray
  const rebuildTray = () =>
    rebuildMenu(
      () => ConfigStore.getProfiles(),
      () => mappingEngine.isEnabled(),
      () => ConfigStore.getConfig().activeProfileId,
      (id) => {
        ConfigStore.setActiveProfileId(id)
        const profile = id ? ConfigStore.getProfiles().find((p) => p.id === id) ?? null : null
        mappingEngine.setActiveProfile(profile)
        send(IPC_CHANNELS.PROFILE_ACTIVATED, { profileId: id })
        rebuildTray()
      },
      () => {
        const next = !mappingEngine.isEnabled()
        mappingEngine.setEnabled(next)
        ConfigStore.setConfig({ globalEnabled: next })
        send(IPC_CHANNELS.MAPPING_STATE_CHANGED, { enabled: next })
        rebuildTray()
      }
    )

  initTray(
    () => ConfigStore.getProfiles(),
    () => mappingEngine.isEnabled(),
    () => ConfigStore.getConfig().activeProfileId,
    (id) => {
      ConfigStore.setActiveProfileId(id)
      const profile = id ? ConfigStore.getProfiles().find((p) => p.id === id) ?? null : null
      mappingEngine.setActiveProfile(profile)
      rebuildTray()
    },
    () => {
      const next = !mappingEngine.isEnabled()
      mappingEngine.setEnabled(next)
      ConfigStore.setConfig({ globalEnabled: next })
      send(IPC_CHANNELS.MAPPING_STATE_CHANGED, { enabled: next })
      rebuildTray()
    }
  )

  // Global hotkey
  const hotkey = config.globalHotkey
  const registered = globalShortcut.register(hotkey, () => {
    const next = !mappingEngine.isEnabled()
    mappingEngine.setEnabled(next)
    ConfigStore.setConfig({ globalEnabled: next })
    send(IPC_CHANNELS.MAPPING_STATE_CHANGED, { enabled: next })
    rebuildTray()
  })
  if (!registered) log.warn(`[main] Failed to register global hotkey: ${hotkey}`)

  // Auto-update
  initAutoUpdater((status: UpdateStatus) => send(IPC_CHANNELS.UPDATER_STATUS, status))

  // Launch at login
  if (process.platform === 'darwin') {
    app.setLoginItemSettings({ openAtLogin: config.launchAtLogin })
  }
})

// ── Lifecycle ────────────────────────────────────────────────────────────────
app.on('window-all-closed', () => {
  const config = ConfigStore.getConfig()
  if (!config.minimizeToTray) app.quit()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  hidManager.stop()
  profileMatcher.stop()
  shutdownCgkey()
})

app.on('activate', () => {
  const win = getMainWindow()
  if (win) win.show()
})
