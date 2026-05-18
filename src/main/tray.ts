import { Tray, Menu, nativeImage, app } from 'electron'
import { join } from 'path'
import type { Profile } from '@shared/types'
import { showWindow } from './window'

let tray: Tray | null = null

function getIconPath(enabled: boolean): string {
  const base = app.isPackaged ? process.resourcesPath : join(process.cwd(), 'resources')
  return join(base, enabled ? 'tray-icon.png' : 'tray-icon-disabled.png')
}

export function initTray(
  getProfiles: () => Profile[],
  getEnabled: () => boolean,
  getActiveId: () => string | null,
  onSetActive: (id: string | null) => void,
  onToggleEnabled: () => void
): void {
  const icon = nativeImage.createFromPath(getIconPath(true))
  tray = new Tray(icon.resize({ width: 22, height: 22 }))
  tray.setToolTip('JoyToKey')
  rebuildMenu(getProfiles, getEnabled, getActiveId, onSetActive, onToggleEnabled)
}

export function rebuildMenu(
  getProfiles: () => Profile[],
  getEnabled: () => boolean,
  getActiveId: () => string | null,
  onSetActive: (id: string | null) => void,
  onToggleEnabled: () => void
): void {
  if (!tray) return
  const enabled = getEnabled()
  const activeId = getActiveId()
  const profiles = getProfiles()

  tray.setImage(nativeImage.createFromPath(getIconPath(enabled)).resize({ width: 22, height: 22 }))

  const profileItems = profiles.map((p) => ({
    label: p.name,
    type: 'radio' as const,
    checked: p.id === activeId,
    click: () => onSetActive(p.id),
  }))

  const template: Electron.MenuItemConstructorOptions[] = [
    { label: 'JoyToKey', enabled: false },
    { type: 'separator' },
    ...(profileItems.length > 0 ? profileItems : [{ label: 'No profiles', enabled: false }]),
    { type: 'separator' },
    {
      label: enabled ? '✓ Mapping Enabled' : 'Mapping Disabled',
      type: 'normal',
      click: onToggleEnabled,
    },
    { type: 'separator' },
    { label: 'Open', click: showWindow },
    { label: 'Quit', click: () => app.quit() },
  ]

  tray.setContextMenu(Menu.buildFromTemplate(template))
}
