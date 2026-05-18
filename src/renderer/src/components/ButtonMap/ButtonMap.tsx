import type { JoystickEvent, Mapping, Profile } from '@shared/types'
import { HAT_CENTERED } from '@shared/constants'
import { ButtonCell } from './ButtonCell'
import { AxisGauge } from './AxisGauge'

interface Props {
  profile: Profile | null
  events: Map<string, JoystickEvent>
  onCellClick: (type: 'button' | 'axis' | 'hat', index: number) => void
}

const HAT_LABELS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

export function ButtonMap({ profile, events, onCellClick }: Props) {
  const buttonCount = profile?.buttonCount ?? 16
  const axisCount = profile?.axisCount ?? 4

  const findMapping = (type: string, index: number): Mapping | undefined =>
    profile?.mappings.find(
      (m) => m.trigger.type === type && m.trigger.index === index && m.enabled
    )

  const buttonActive = (i: number) => events.get(`button:${i}`)?.value === 1
  const hatValue = events.get('hat:0')?.value ?? HAT_CENTERED
  const axisValue = (i: number) => events.get(`axis:${i}`)?.value ?? 0.5

  return (
    <div className="flex flex-col gap-6">
      {/* Buttons grid */}
      <section>
        <h3 className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-2">Buttons</h3>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: buttonCount }, (_, i) => (
            <ButtonCell
              key={i}
              label={`B${i + 1}`}
              isActive={buttonActive(i)}
              mapping={findMapping('button', i)}
              onClick={() => onCellClick('button', i)}
            />
          ))}
        </div>
      </section>

      {/* Hat / D-pad */}
      <section>
        <h3 className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-2">D-Pad</h3>
        <div className="grid grid-cols-3 gap-1 w-36">
          {[null, 0, null, 7, null, 1, 6, 8, 2, 5, null, 3, null, 4, null].map((dir, idx) =>
            dir === null ? (
              <div key={idx} />
            ) : dir === 8 ? (
              <div key={idx} className="flex items-center justify-center w-10 h-10 rounded border border-[var(--border)] bg-[var(--bg-card)]">
                <div className={`w-3 h-3 rounded-full ${hatValue !== HAT_CENTERED ? 'bg-[var(--accent)]' : 'bg-[var(--border)]'}`} />
              </div>
            ) : (
              <ButtonCell
                key={idx}
                label={HAT_LABELS[dir]}
                isActive={hatValue === dir}
                mapping={profile?.mappings.find(
                  (m) => m.trigger.type === 'hat' && m.trigger.hatDir === dir && m.enabled
                )}
                onClick={() => onCellClick('hat', 0)}
              />
            )
          )}
        </div>
      </section>

      {/* Axes */}
      <section>
        <h3 className="text-xs uppercase tracking-wider text-[var(--text-muted)] mb-2">Axes</h3>
        <div className="flex flex-col gap-3 max-w-xs">
          {Array.from({ length: axisCount }, (_, i) => (
            <div key={i} onClick={() => onCellClick('axis', i)} className="cursor-pointer">
              <AxisGauge
                label={`Axis ${i}`}
                value={axisValue(i)}
                deadZone={profile?.deadZones?.[i] ?? 0.1}
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
