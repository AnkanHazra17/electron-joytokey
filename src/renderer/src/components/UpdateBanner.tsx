import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { IPC_CHANNELS } from '@shared/ipcChannels'
import type { UpdateStatus } from '@shared/types'

export function UpdateBanner() {
  const [status, setStatus] = useState<UpdateStatus | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const unsub = window.joytokey.on(IPC_CHANNELS.UPDATER_STATUS, (s) => {
      setStatus(s as UpdateStatus)
      setDismissed(false)
    })
    return unsub
  }, [])

  if (!status || dismissed || status.state === 'idle' || status.state === 'checking') return null

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-[var(--accent)]/10 border-b border-[var(--accent)]/20 text-sm">
      <Download size={14} className="text-[var(--accent)] shrink-0" />
      <span className="flex-1 text-[var(--text)]">
        {status.state === 'available' && `Update v${status.version} available — downloading…`}
        {status.state === 'downloading' && `Downloading update… ${status.percent ?? 0}%`}
        {status.state === 'ready' && `Update v${status.version} ready to install`}
        {status.state === 'error' && `Update error: ${status.error}`}
      </span>
      {status.state === 'ready' && (
        <button
          onClick={() => window.joytokey.invoke(IPC_CHANNELS.UPDATER_INSTALL)}
          className="px-3 py-1 text-xs rounded bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium transition-colors"
        >
          Restart &amp; Install
        </button>
      )}
      <button onClick={() => setDismissed(true)} className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
        <X size={14} />
      </button>
    </div>
  )
}
