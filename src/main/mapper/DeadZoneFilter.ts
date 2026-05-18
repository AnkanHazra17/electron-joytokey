import { AXIS_NEUTRAL, DEFAULT_DEAD_ZONE } from '@shared/constants'
import type { JoystickEvent } from '@shared/types'

export function applyDeadZone(evt: JoystickEvent, deadZones: Record<number, number>): JoystickEvent {
  if (evt.type !== 'axis') return evt
  const dz = deadZones[evt.index] ?? DEFAULT_DEAD_ZONE
  if (Math.abs(evt.value - AXIS_NEUTRAL) < dz) {
    return { ...evt, value: AXIS_NEUTRAL }
  }
  return evt
}
