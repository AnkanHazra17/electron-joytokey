import { useState, useEffect } from 'react'
import { IPC_CHANNELS } from '@shared/ipcChannels'
import type { HidDeviceInfo, IpcResult } from '@shared/types'

export function useDevices() {
  const [devices, setDevices] = useState<HidDeviceInfo[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = async () => {
    const result = (await window.joytokey.invoke(IPC_CHANNELS.DEVICES_LIST)) as IpcResult<HidDeviceInfo[]>
    if (result.ok && result.data) setDevices(result.data)
    setLoading(false)
  }

  useEffect(() => {
    refresh()
    const unsub = window.joytokey.on(IPC_CHANNELS.DEVICES_CHANGED, (updated) => {
      setDevices(updated as HidDeviceInfo[])
    })
    return unsub
  }, [])

  const connect = async (device: HidDeviceInfo) => {
    await window.joytokey.invoke(IPC_CHANNELS.DEVICES_CONNECT, {
      path: device.path,
      vendorId: device.vendorId,
      productId: device.productId,
    })
  }

  const disconnect = async (device: HidDeviceInfo) => {
    await window.joytokey.invoke(IPC_CHANNELS.DEVICES_DISCONNECT, { path: device.path })
  }

  return { devices, loading, refresh, connect, disconnect }
}
