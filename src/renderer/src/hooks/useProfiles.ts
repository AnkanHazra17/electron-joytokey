import { useState, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { IPC_CHANNELS } from '@shared/ipcChannels'
import type { Profile, IpcResult } from '@shared/types'

export function useProfiles() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null)

  const refresh = async () => {
    const [profilesRes, configRes] = await Promise.all([
      window.joytokey.invoke(IPC_CHANNELS.PROFILES_LIST) as Promise<IpcResult<Profile[]>>,
      window.joytokey.invoke(IPC_CHANNELS.CONFIG_GET) as Promise<IpcResult<{ activeProfileId: string | null }>>,
    ])
    if (profilesRes.ok && profilesRes.data) setProfiles(profilesRes.data)
    if (configRes.ok && configRes.data) setActiveProfileId(configRes.data.activeProfileId)
  }

  useEffect(() => { refresh() }, [])

  const save = async (profile: Profile) => {
    const res = await window.joytokey.invoke(IPC_CHANNELS.PROFILES_SAVE, profile) as IpcResult<Profile>
    if (res.ok) await refresh()
    return res
  }

  const remove = async (id: string) => {
    await window.joytokey.invoke(IPC_CHANNELS.PROFILES_DELETE, { id })
    await refresh()
  }

  const setActive = async (id: string | null) => {
    await window.joytokey.invoke(IPC_CHANNELS.PROFILES_SET_ACTIVE, { id })
    setActiveProfileId(id)
  }

  const create = (): Profile => ({
    id: uuidv4(),
    name: 'New Profile',
    mappings: [],
    deadZones: {},
    axisCount: 6,
    buttonCount: 16,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })

  return { profiles, activeProfileId, refresh, save, remove, setActive, create }
}
