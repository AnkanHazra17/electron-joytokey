import { describe, it, expect } from 'vitest'
import { applyDeadZone } from '../../src/main/mapper/DeadZoneFilter'
import { AXIS_NEUTRAL } from '../../src/shared/constants'
import type { JoystickEvent } from '../../src/shared/types'

const makeAxisEvt = (value: number): JoystickEvent => ({
  devicePath: '/dev/test', type: 'axis', index: 0, value, rawValue: 0, timestamp: 0,
})

describe('DeadZoneFilter', () => {
  it('returns neutral for values within dead zone', () => {
    const evt = makeAxisEvt(0.52)  // close to center (dz = 0.1)
    const result = applyDeadZone(evt, {})
    expect(result.value).toBe(AXIS_NEUTRAL)
  })

  it('passes through values outside dead zone', () => {
    const evt = makeAxisEvt(0.95)
    const result = applyDeadZone(evt, {})
    expect(result.value).toBe(0.95)
  })

  it('respects per-axis dead zone override', () => {
    const evt = makeAxisEvt(0.62)  // outside default (0.1) but inside custom (0.2)
    const result = applyDeadZone(evt, { 0: 0.2 })
    expect(result.value).toBe(AXIS_NEUTRAL)
  })

  it('does not modify button events', () => {
    const evt: JoystickEvent = {
      devicePath: '/dev/test', type: 'button', index: 0, value: 1, rawValue: 1, timestamp: 0,
    }
    const result = applyDeadZone(evt, {})
    expect(result).toStrictEqual(evt)
  })

  it('passes through value clearly outside dead zone', () => {
    // Use 0.65 — |0.65 - 0.5| = 0.15 > 0.1 dead zone — no floating-point ambiguity
    const evt = makeAxisEvt(0.65)
    const result = applyDeadZone(evt, {})
    expect(result.value).toBe(0.65)
  })
})
