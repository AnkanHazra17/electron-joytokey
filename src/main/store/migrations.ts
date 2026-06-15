import type { AppConfig } from '@shared/types'

type AnyConfig = Record<string, unknown>

export const migrations: Record<number, (config: AnyConfig) => AnyConfig> = {
  1: (config) => {
    // v0 → v1: ensure all required fields exist
    const c = config as Partial<AppConfig>
    return {
      configVersion: 1,
      activeProfileId: c.activeProfileId ?? null,
      profiles: c.profiles ?? [],
      globalEnabled: c.globalEnabled ?? true,
      globalHotkey: c.globalHotkey ?? 'CmdOrCtrl+Shift+J',
      launchAtLogin: c.launchAtLogin ?? false,
      minimizeToTray: c.minimizeToTray ?? true,
      logLevel: c.logLevel ?? 'info',
      connectedDevicePaths: c.connectedDevicePaths ?? [],
    }
  },
  2: (config) => {
    // v1 → v2: add optional deviceName field to profiles (no structural change needed)
    return { ...config, configVersion: 2 }
  },
}
