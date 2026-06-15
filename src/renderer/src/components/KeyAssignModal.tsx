import { useEffect, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { InputTrigger, MappedAction, ModifierKey } from '@shared/types'

interface Props {
  open: boolean
  trigger: InputTrigger | null
  onClose: () => void
  onSave: (action: MappedAction) => void
}

const MODIFIER_KEYS = new Set(['Meta', 'Control', 'Shift', 'Alt'])

// browser KeyboardEvent.key → cgkey.ps1 VK table name
const KEY_NAME_MAP: Record<string, string> = {
  ' ': 'space',
  arrowup: 'up',
  arrowdown: 'down',
  arrowleft: 'left',
  arrowright: 'right',
}

function normalizeKey(key: string): string {
  const lower = key.toLowerCase()
  return KEY_NAME_MAP[lower] ?? lower
}
const MODIFIER_MAP: Record<string, ModifierKey> = {
  Meta: 'command', Control: 'control', Shift: 'shift', Alt: 'option',
}

export function KeyAssignModal({ open, trigger, onClose, onSave }: Props) {
  const [capturedKey, setCapturedKey] = useState<string>('')
  const [capturedMods, setCapturedMods] = useState<ModifierKey[]>([])
  const captureRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) { setCapturedKey(''); setCapturedMods([]) }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      if (MODIFIER_KEYS.has(e.key)) return
      const mods = (['Meta', 'Control', 'Shift', 'Alt'] as const)
        .filter((k) => e.getModifierState(k))
        .map((k) => MODIFIER_MAP[k])
      setCapturedKey(normalizeKey(e.key))
      setCapturedMods(mods)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  const label = trigger
    ? `${trigger.type === 'button' ? `Button ${trigger.index + 1}` : trigger.type === 'hat' ? 'D-Pad' : `Axis ${trigger.index}`}`
    : ''

  const displayKey = [...capturedMods.map((m) => m[0].toUpperCase() + m.slice(1)), capturedKey]
    .filter(Boolean)
    .join(' + ')

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-96 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-sm font-semibold text-[var(--text)]">
              Assign Key — {label}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <div
            ref={captureRef}
            tabIndex={0}
            className="h-20 flex items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--bg)] mb-4 text-sm focus:outline-none focus:border-[var(--accent)] cursor-text"
            onClick={() => captureRef.current?.focus()}
          >
            {displayKey ? (
              <kbd className="px-3 py-1.5 rounded bg-[var(--bg-hover)] border border-[var(--border)] font-mono text-[var(--accent)]">
                {displayKey}
              </kbd>
            ) : (
              <span className="text-[var(--text-muted)]">Press a key combination…</span>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={!capturedKey}
              onClick={() => {
                if (!capturedKey) return
                onSave({
                  type: capturedMods.length > 0 ? 'keyCombo' : 'key',
                  key: capturedKey,
                  modifiers: capturedMods.length > 0 ? capturedMods : undefined,
                  toggle: trigger?.type !== 'button' ? false : true,
                })
                onClose()
              }}
              className="px-4 py-2 text-sm rounded-lg bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Assign
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
