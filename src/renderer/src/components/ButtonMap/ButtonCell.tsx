import type { Mapping } from '@shared/types'

interface Props {
  label: string
  isActive: boolean
  mapping?: Mapping
  onClick: () => void
}

export function ButtonCell({ label, isActive, mapping, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={[
        'flex flex-col items-center justify-center rounded-lg border text-xs font-medium transition-all duration-75 cursor-pointer select-none min-w-[48px] min-h-[48px] p-1 gap-0.5',
        isActive
          ? 'border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--accent)]'
          : 'border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:border-[var(--accent)]/50',
      ].join(' ')}
    >
      <span>{label}</span>
      {mapping && (
        <span className="text-[10px] text-[var(--text-muted)] truncate max-w-[44px]">
          {mapping.action.key ?? mapping.action.mouseButton ?? '—'}
        </span>
      )}
    </button>
  )
}
