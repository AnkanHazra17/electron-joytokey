import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/ipcChannels'

const allowedChannels = new Set(Object.values(IPC_CHANNELS))

contextBridge.exposeInMainWorld('joytokey', {
  invoke(channel: string, ...args: unknown[]): Promise<unknown> {
    if (!allowedChannels.has(channel as never)) {
      return Promise.reject(new Error(`Blocked IPC channel: ${channel}`))
    }
    return ipcRenderer.invoke(channel, ...args)
  },

  on(channel: string, listener: (...args: unknown[]) => void): () => void {
    if (!allowedChannels.has(channel as never)) return () => {}
    const wrapped = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => listener(...args)
    ipcRenderer.on(channel, wrapped)
    return () => ipcRenderer.removeListener(channel, wrapped)
  },
})
