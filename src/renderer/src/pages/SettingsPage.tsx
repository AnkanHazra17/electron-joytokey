import { useEffect, useRef, useState } from 'react'
import { IPC_CHANNELS } from '@shared/ipcChannels'
import type { AppConfig } from '@shared/types'

const MODIFIER_KEYS = new Set(['Meta', 'Control', 'Shift', 'Alt'])

export function SettingsPage() {
  const [config, setConfig] = useState<Partial<AppConfig>>({})
  const [hotkeyCapture, setHotkeyCapture] = useState(false)
  const hotkeyRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    window.joytokey.invoke(IPC_CHANNELS.CONFIG_GET).then((res: unknown) => {
      const r = res as { ok: boolean; data?: AppConfig }
      if (r.ok && r.data) setConfig(r.data)
    })
  }, [])

  const update = async (patch: Partial<AppConfig>) => {
    const next = { ...config, ...patch }
    setConfig(next)
    await window.joytokey.invoke(IPC_CHANNELS.CONFIG_SET, patch)
  }

  useEffect(() => {
    if (!hotkeyCapture) return
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      if (MODIFIER_KEYS.has(e.key)) return
      const parts: string[] = []
      if (e.metaKey) parts.push('Command')
      if (e.ctrlKey) parts.push('Ctrl')
      if (e.altKey) parts.push('Alt')
      if (e.shiftKey) parts.push('Shift')
      parts.push(e.key.toUpperCase())
      update({ globalHotkey: parts.join('+') })
      setHotkeyCapture(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hotkeyCapture, config])

  return (
    <div className="flex flex-col gap-6 p-6 max-w-lg">
      <h2 className="text-base font-semibold">Settings</h2>

      {/* Global Hotkey */}
      <section className="flex flex-col gap-2">
        <label className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Global Toggle Hotkey</label>
        <button
          ref={hotkeyRef}
          onClick={() => setHotkeyCapture(true)}
          className={`text-left px-4 py-2.5 rounded-lg border text-sm font-mono transition-colors ${hotkeyCapture ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]' : 'border-[var(--border)] bg-[var(--bg-card)] text-[var(--text)]'}`}
        >
          {hotkeyCapture ? 'Press a key combination…' : (config.globalHotkey ?? 'CmdOrCtrl+Shift+J')}
        </button>
      </section>

      {/* Launch at login */}
      <section className="flex items-center justify-between">
        <div>
          <p className="text-sm">Launch at Login</p>
          <p className="text-xs text-[var(--text-muted)]">Start JoyToKey automatically when you log in</p>
        </div>
        <Toggle checked={!!config.launchAtLogin} onChange={(v) => update({ launchAtLogin: v })} />
      </section>

      {/* Minimize to tray */}
      <section className="flex items-center justify-between">
        <div>
          <p className="text-sm">Minimize to Tray</p>
          <p className="text-xs text-[var(--text-muted)]">Keep running in the background when window closes</p>
        </div>
        <Toggle checked={!!config.minimizeToTray} onChange={(v) => update({ minimizeToTray: v })} />
      </section>

      {/* Log level */}
      <section className="flex flex-col gap-2">
        <label className="text-xs uppercase tracking-wider text-[var(--text-muted)]">Log Level</label>
        <select
          value={config.logLevel ?? 'info'}
          onChange={(e) => update({ logLevel: e.target.value as AppConfig['logLevel'] })}
          className="px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] text-sm text-[var(--text)] outline-none focus:border-[var(--accent)]"
        >
          <option value="error">Error</option>
          <option value="warn">Warning</option>
          <option value="info">Info</option>
          <option value="debug">Debug</option>
        </select>
      </section>
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-6 rounded-full transition-colors focus:outline-none ${checked ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`}
      />
    </button>
  )
}
