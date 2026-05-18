import Store from 'electron-store'
import { produce } from 'immer'
import { v4 as uuidv4 } from 'uuid'
import type { AppConfig, Profile } from '@shared/types'
import { CONFIG_VERSION, DEFAULT_DEAD_ZONE, DEFAULT_HOTKEY } from '@shared/constants'
import { migrations } from './migrations'

const defaultConfig: AppConfig = {
  configVersion: CONFIG_VERSION,
  activeProfileId: null,
  profiles: [],
  globalEnabled: true,
  globalHotkey: DEFAULT_HOTKEY,
  launchAtLogin: false,
  minimizeToTray: true,
  logLevel: 'info',
  connectedDevicePaths: [],
}

const store = new Store<AppConfig>({
  name: 'config',
  defaults: defaultConfig,
})

// Run schema migrations manually — electron-store's built-in migration API
// uses a different signature (receives the store instance, not the config object).
const storedVersion = store.get('configVersion', 0) as number
if (storedVersion < CONFIG_VERSION) {
  let config = store.store as unknown as Record<string, unknown>
  for (let v = storedVersion + 1; v <= CONFIG_VERSION; v++) {
    const fn = migrations[v]
    if (fn) config = fn(config)
  }
  store.store = config as unknown as AppConfig
}

export const ConfigStore = {
  getConfig(): AppConfig {
    return store.store
  },

  setConfig(partial: Partial<AppConfig>): void {
    const next = produce(store.store, (draft) => {
      Object.assign(draft, partial)
    })
    store.store = next
  },

  getProfiles(): Profile[] {
    return store.get('profiles', [])
  },

  saveProfile(profile: Profile): Profile {
    const profiles = store.get('profiles', [])
    const idx = profiles.findIndex((p) => p.id === profile.id)
    const updated = { ...profile, updatedAt: Date.now() }
    const next =
      idx >= 0
        ? produce(profiles, (d) => {
            d[idx] = updated
          })
        : [...profiles, updated]
    store.set('profiles', next)
    return updated
  },

  deleteProfile(id: string): void {
    const profiles = store.get('profiles', []).filter((p) => p.id !== id)
    store.set('profiles', profiles)
    if (store.get('activeProfileId') === id) {
      store.set('activeProfileId', null)
    }
  },

  getActiveProfile(): Profile | null {
    const id = store.get('activeProfileId')
    if (!id) return null
    return store.get('profiles', []).find((p) => p.id === id) ?? null
  },

  setActiveProfileId(id: string | null): void {
    store.set('activeProfileId', id)
  },

  createDefaultProfile(): Profile {
    return {
      id: uuidv4(),
      name: 'Default Profile',
      mappings: [],
      deadZones: {},
      axisCount: 6,
      buttonCount: 16,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
  },
}

export default ConfigStore
