import { useState, useEffect } from 'react'
import { IPC_CHANNELS } from '@shared/ipcChannels'
import type { IpcResult, AppConfig } from '@shared/types'

export function useMappingEnabled() {
  const [enabled, setEnabled] = useState(true)

  useEffect(() => {
    window.joytokey
      .invoke(IPC_CHANNELS.CONFIG_GET)
      .then((res) => {
        const r = res as IpcResult<AppConfig>
        if (r.ok && r.data) setEnabled(r.data.globalEnabled)
      })

    const unsub = window.joytokey.on(IPC_CHANNELS.MAPPING_STATE_CHANGED, (payload) => {
      setEnabled((payload as { enabled: boolean }).enabled)
    })
    return unsub
  }, [])

  const toggle = async () => {
    const next = !enabled
    await window.joytokey.invoke(IPC_CHANNELS.MAPPING_SET_ENABLED, { enabled: next })
    setEnabled(next)
  }

  return { enabled, toggle }
}
