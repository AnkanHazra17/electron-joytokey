interface Props {
  value: number        // 0.0 – 1.0
  deadZone?: number    // 0.0 – 0.5
  label: string
}

export function AxisGauge({ value, deadZone = 0.1, label }: Props) {
  const pct = Math.round(value * 100)
  const dzPct = Math.round(deadZone * 100)
  const center = 50

  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="flex justify-between text-xs text-[var(--text-muted)]">
        <span>{label}</span>
        <span>{pct}%</span>
      </div>
      <div className="relative h-3 rounded-full bg-[var(--bg)] overflow-hidden border border-[var(--border)]">
        {/* Dead zone bands */}
        <div
          className="absolute inset-y-0 bg-yellow-500/20"
          style={{ left: `${center - dzPct}%`, width: `${dzPct * 2}%` }}
        />
        {/* Value bar */}
        <div
          className="absolute inset-y-0 bg-[var(--accent)] transition-all duration-50"
          style={{
            left: value >= 0.5 ? `${center}%` : `${pct}%`,
            width: value >= 0.5 ? `${pct - center}%` : `${center - pct}%`,
          }}
        />
        {/* Center line */}
        <div className="absolute inset-y-0 w-px bg-[var(--border)]" style={{ left: '50%' }} />
      </div>
    </div>
  )
}
