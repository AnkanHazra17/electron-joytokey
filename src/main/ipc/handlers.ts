import { ipcMain, dialog, BrowserWindow } from 'electron'
import { z } from 'zod'
import { IPC_CHANNELS } from './channels'
import ConfigStore from '../store/ConfigStore'
import { hidManager } from '../hid/HidManager'
import { mappingEngine } from '../mapper/MappingEngine'
import type { IpcResult, Profile } from '@shared/types'

function ok<T>(data: T): IpcResult<T> { return { ok: true, data } }
function err<T = never>(msg: string): IpcResult<T> { return { ok: false, error: msg } }

function safe<T>(fn: () => T): IpcResult<T> {
  try { return ok(fn()) }
  catch (e) { return err<T>(e instanceof Error ? e.message : String(e)) }
}

const connectSchema = z.object({ path: z.string().min(1), vendorId: z.number(), productId: z.number() })
const profileIdSchema = z.object({ id: z.string().uuid() })
const profileSchema = z.object({ id: z.string() }).passthrough()

export function registerHandlers(): void {
  // ── Devices ──────────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.DEVICES_LIST, () => safe(() => hidManager.enumerate()))

  ipcMain.handle(IPC_CHANNELS.DEVICES_CONNECT, (_e, payload) => {
    const parsed = connectSchema.safeParse(payload)
    if (!parsed.success) return err(parsed.error.message)
    const { path, vendorId, productId } = parsed.data
    return safe(() => hidManager.openDevice(path, vendorId, productId))
  })

  ipcMain.handle(IPC_CHANNELS.DEVICES_DISCONNECT, (_e, payload) => {
    const parsed = z.object({ path: z.string() }).safeParse(payload)
    if (!parsed.success) return err(parsed.error.message)
    return safe(() => hidManager.closeDevice(parsed.data.path))
  })

  // ── Profiles ─────────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.PROFILES_LIST, () => safe(() => ConfigStore.getProfiles()))

  ipcMain.handle(IPC_CHANNELS.PROFILES_SAVE, (_e, payload) => {
    const parsed = profileSchema.safeParse(payload)
    if (!parsed.success) return err(parsed.error.message)
    return safe(() => ConfigStore.saveProfile(parsed.data as unknown as Profile))
  })

  ipcMain.handle(IPC_CHANNELS.PROFILES_DELETE, (_e, payload) => {
    const parsed = profileIdSchema.safeParse(payload)
    if (!parsed.success) return err(parsed.error.message)
    return safe(() => ConfigStore.deleteProfile(parsed.data.id))
  })

  ipcMain.handle(IPC_CHANNELS.PROFILES_SET_ACTIVE, (_e, payload) => {
    const parsed = z.object({ id: z.string().nullable() }).safeParse(payload)
    if (!parsed.success) return err(parsed.error.message)
    return safe(() => {
      ConfigStore.setActiveProfileId(parsed.data.id)
      const profile = parsed.data.id ? ConfigStore.getProfiles().find((p) => p.id === parsed.data.id) ?? null : null
      mappingEngine.setActiveProfile(profile)
    })
  })

  // ── Mapping ───────────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.MAPPING_SET_ENABLED, (_e, payload) => {
    const parsed = z.object({ enabled: z.boolean() }).safeParse(payload)
    if (!parsed.success) return err(parsed.error.message)
    return safe(() => {
      mappingEngine.setEnabled(parsed.data.enabled)
      ConfigStore.setConfig({ globalEnabled: parsed.data.enabled })
    })
  })

  // ── Config ────────────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.CONFIG_GET, () => safe(() => ConfigStore.getConfig()))

  ipcMain.handle(IPC_CHANNELS.CONFIG_SET, (_e, payload) => {
    const parsed = z.record(z.unknown()).safeParse(payload)
    if (!parsed.success) return err(parsed.error.message)
    return safe(() => ConfigStore.setConfig(parsed.data as Parameters<typeof ConfigStore.setConfig>[0]))
  })

  // ── Dialogs ───────────────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.SHOW_SAVE_DIALOG, async (_e, payload) => {
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showSaveDialog(win!, {
      filters: [{ name: 'JSON Profile', extensions: ['json'] }],
      defaultPath: payload?.defaultName ?? 'profile.json',
    })
    return ok(result)
  })

  ipcMain.handle(IPC_CHANNELS.SHOW_OPEN_DIALOG, async () => {
    const win = BrowserWindow.getFocusedWindow()
    const result = await dialog.showOpenDialog(win!, {
      filters: [{ name: 'JSON Profile', extensions: ['json'] }],
      properties: ['openFile'],
    })
    return ok(result)
  })
}
