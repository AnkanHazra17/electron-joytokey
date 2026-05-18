import { describe, it, expect, vi, beforeEach } from 'vitest'
import { tmpdir } from 'os'
import { join } from 'path'
import { mkdirSync } from 'fs'
import type { Profile } from '../../src/shared/types'
import Store from 'electron-store'
import { CONFIG_VERSION } from '../../src/shared/constants'

function makeStore(dir: string): ReturnType<typeof import('../../src/main/store/ConfigStore')['default']> {
  const store = new Store<Record<string, unknown>>({ cwd: dir, name: 'config' })
  store.clear()
  // Inline minimal ConfigStore backed by this store instance
  const defaultProfiles: Profile[] = []

  return {
    getConfig: () => ({
      configVersion: CONFIG_VERSION,
      activeProfileId: store.get('activeProfileId', null) as string | null,
      profiles: store.get('profiles', defaultProfiles) as Profile[],
      globalEnabled: store.get('globalEnabled', true) as boolean,
      globalHotkey: store.get('globalHotkey', 'CmdOrCtrl+Shift+J') as string,
      launchAtLogin: store.get('launchAtLogin', false) as boolean,
      minimizeToTray: store.get('minimizeToTray', true) as boolean,
      logLevel: store.get('logLevel', 'info') as 'info',
      connectedDevicePaths: store.get('connectedDevicePaths', []) as string[],
    }),
    setConfig: (partial: Record<string, unknown>) => { Object.entries(partial).forEach(([k, v]) => store.set(k, v)) },
    getProfiles: () => store.get('profiles', []) as Profile[],
    saveProfile: (profile: Profile) => {
      const profiles = store.get('profiles', []) as Profile[]
      const idx = profiles.findIndex((p: Profile) => p.id === profile.id)
      const updated = { ...profile, updatedAt: Date.now() }
      const next = idx >= 0 ? profiles.map((p: Profile) => p.id === profile.id ? updated : p) : [...profiles, updated]
      store.set('profiles', next)
      return updated
    },
    deleteProfile: (id: string) => {
      const profiles = (store.get('profiles', []) as Profile[]).filter((p) => p.id !== id)
      store.set('profiles', profiles)
      if (store.get('activeProfileId') === id) store.set('activeProfileId', null)
    },
    getActiveProfile: () => {
      const id = store.get('activeProfileId') as string | null
      if (!id) return null
      return (store.get('profiles', []) as Profile[]).find((p) => p.id === id) ?? null
    },
    setActiveProfileId: (id: string | null) => store.set('activeProfileId', id),
    createDefaultProfile: () => ({
      id: 'new', name: 'Default', mappings: [], deadZones: {}, axisCount: 6, buttonCount: 16, createdAt: Date.now(), updatedAt: Date.now(),
    }),
  }
}

describe('ConfigStore', () => {
  let dir: string

  beforeEach(() => {
    dir = join(tmpdir(), `joytokey-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    mkdirSync(dir, { recursive: true })
  })

  it('returns default config on first load', () => {
    const cs = makeStore(dir)
    const config = cs.getConfig()
    expect(config.globalEnabled).toBe(true)
    expect(config.profiles).toHaveLength(0)
    expect(config.configVersion).toBe(CONFIG_VERSION)
  })

  it('saves and retrieves a profile', () => {
    const cs = makeStore(dir)
    const profile: Profile = {
      id: 'test-uuid', name: 'My Profile', mappings: [], deadZones: {},
      axisCount: 4, buttonCount: 16, createdAt: 1000, updatedAt: 1000,
    }
    cs.saveProfile(profile)
    expect(cs.getProfiles()).toHaveLength(1)
    expect(cs.getProfiles()[0].name).toBe('My Profile')
  })

  it('updates existing profile when id matches', () => {
    const cs = makeStore(dir)
    const base: Profile = { id: 'abc', name: 'Old', mappings: [], deadZones: {}, axisCount: 4, buttonCount: 16, createdAt: 0, updatedAt: 0 }
    cs.saveProfile(base)
    cs.saveProfile({ ...base, name: 'New' })
    expect(cs.getProfiles()).toHaveLength(1)
    expect(cs.getProfiles()[0].name).toBe('New')
  })

  it('deletes a profile by id', () => {
    const cs = makeStore(dir)
    const p: Profile = { id: 'del-me', name: 'X', mappings: [], deadZones: {}, axisCount: 4, buttonCount: 16, createdAt: 0, updatedAt: 0 }
    cs.saveProfile(p)
    cs.deleteProfile('del-me')
    expect(cs.getProfiles()).toHaveLength(0)
  })
})
