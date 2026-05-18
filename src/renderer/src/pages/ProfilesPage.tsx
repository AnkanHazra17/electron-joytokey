import { useState } from 'react'
import { Plus, Trash2, Copy, Star, Download, Upload } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { useProfiles } from '../hooks/useProfiles'
import { IPC_CHANNELS } from '@shared/ipcChannels'
import type { Profile } from '@shared/types'

export function ProfilesPage() {
  const { profiles, activeProfileId, save, remove, setActive, create } = useProfiles()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const startEdit = (p: Profile) => { setEditingId(p.id); setEditName(p.name) }
  const commitEdit = async (p: Profile) => {
    if (editName.trim()) await save({ ...p, name: editName.trim() })
    setEditingId(null)
  }

  const duplicate = async (p: Profile) => {
    await save({ ...p, id: uuidv4(), name: `${p.name} (copy)`, createdAt: Date.now(), updatedAt: Date.now() })
  }

  const exportProfile = async (p: Profile) => {
    const res = await window.joytokey.invoke(IPC_CHANNELS.SHOW_SAVE_DIALOG, { defaultName: `${p.name}.json` }) as { ok: boolean; data: { filePath?: string; canceled: boolean } }
    if (!res.ok || res.data.canceled || !res.data.filePath) return
    // Write via IPC isn't available directly — use a data URL trick
    const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${p.name}.json`; a.click()
    URL.revokeObjectURL(url)
  }

  const importProfile = () => {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const text = await file.text()
      try {
        const parsed: Profile = JSON.parse(text)
        await save({ ...parsed, id: uuidv4(), createdAt: Date.now(), updatedAt: Date.now() })
      } catch { /* invalid JSON */ }
    }
    input.click()
  }

  const handleCreate = async () => {
    const p = create()
    await save(p)
    await setActive(p.id)
    startEdit(p)
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Profiles</h2>
        <div className="flex gap-2">
          <button onClick={importProfile} className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
            <Upload size={13} /> Import
          </button>
          <button
            onClick={handleCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium transition-colors"
          >
            <Plus size={13} /> New Profile
          </button>
        </div>
      </div>

      {profiles.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-2 py-16 text-[var(--text-muted)]">
          <p className="text-sm">No profiles yet</p>
          <p className="text-xs">Create one to start mapping your controller</p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {profiles.map((p) => (
          <div
            key={p.id}
            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${p.id === activeProfileId ? 'border-[var(--accent)]/50 bg-[var(--accent)]/5' : 'border-[var(--border)] bg-[var(--bg-card)]'}`}
          >
            <button onClick={() => setActive(p.id)} className="shrink-0 text-[var(--text-muted)] hover:text-[var(--warning)] transition-colors">
              <Star size={15} fill={p.id === activeProfileId ? 'currentColor' : 'none'} className={p.id === activeProfileId ? 'text-[var(--warning)]' : ''} />
            </button>

            <div className="flex-1 min-w-0">
              {editingId === p.id ? (
                <input
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => commitEdit(p)}
                  onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(p); if (e.key === 'Escape') setEditingId(null) }}
                  className="w-full bg-transparent text-sm font-medium border-b border-[var(--accent)] outline-none pb-0.5"
                />
              ) : (
                <p className="text-sm font-medium cursor-pointer hover:text-[var(--accent)] transition-colors truncate" onClick={() => startEdit(p)}>
                  {p.name}
                </p>
              )}
              <p className="text-xs text-[var(--text-muted)]">{p.mappings.length} mapping{p.mappings.length !== 1 ? 's' : ''}</p>
            </div>

            <div className="flex gap-1 shrink-0">
              <button onClick={() => exportProfile(p)} className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)] transition-colors">
                <Download size={13} />
              </button>
              <button onClick={() => duplicate(p)} className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--bg-hover)] transition-colors">
                <Copy size={13} />
              </button>
              <button onClick={() => remove(p.id)} className="p-1.5 rounded text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors">
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
