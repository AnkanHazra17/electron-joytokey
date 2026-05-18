import { describe, it, expect } from 'vitest'
import { parse } from '../../src/main/hid/HidParser'
import { genericGamepadStrategy } from '../../src/main/hid/DeviceDescriptor'
import { HAT_CENTERED } from '../../src/shared/constants'

const PATH = '/dev/test'

describe('HidParser', () => {
  it('emits button press when bit toggles from 0 to 1', () => {
    const prev = Buffer.alloc(8, 0)
    const curr = Buffer.alloc(8, 0)
    curr[4] = 0b00000001  // button 0 pressed

    const events = parse(PATH, curr, genericGamepadStrategy, prev)
    const btn = events.find((e) => e.type === 'button' && e.index === 0)
    expect(btn).toBeDefined()
    expect(btn!.value).toBe(1)
  })

  it('emits button release when bit toggles from 1 to 0', () => {
    const prev = Buffer.alloc(8, 0)
    prev[4] = 0b00000001
    const curr = Buffer.alloc(8, 0)

    const events = parse(PATH, curr, genericGamepadStrategy, prev)
    const btn = events.find((e) => e.type === 'button' && e.index === 0)
    expect(btn).toBeDefined()
    expect(btn!.value).toBe(0)
  })

  it('normalizes 8-bit axis to 0.0–1.0 range', () => {
    const prev = Buffer.alloc(8, 0x80)  // all axes at midpoint
    const curr = Buffer.alloc(8, 0x80)
    curr[0] = 0  // axis 0 at minimum

    const events = parse(PATH, curr, genericGamepadStrategy, prev)
    const axis = events.find((e) => e.type === 'axis' && e.index === 0)
    expect(axis).toBeDefined()
    expect(axis!.value).toBeCloseTo(0, 2)
  })

  it('emits hat direction when nibble changes', () => {
    const prev = Buffer.alloc(8, 0)
    prev[4] = 0x08  // hat centered (8)
    const curr = Buffer.alloc(8, 0)
    curr[4] = 0x00  // hat North (0)

    const events = parse(PATH, curr, genericGamepadStrategy, prev)
    const hat = events.find((e) => e.type === 'hat')
    expect(hat).toBeDefined()
    expect(hat!.value).toBe(0)  // North
  })

  it('emits hat centered when nibble > 7', () => {
    const prev = Buffer.alloc(8, 0)
    prev[4] = 0x00  // hat was North
    const curr = Buffer.alloc(8, 0)
    curr[4] = 0x08  // hat returns to centered

    const events = parse(PATH, curr, genericGamepadStrategy, prev)
    const hat = events.find((e) => e.type === 'hat')
    expect(hat).toBeDefined()
    expect(hat!.value).toBe(HAT_CENTERED)
  })

  it('emits no events when buffer is unchanged', () => {
    const buf = Buffer.alloc(8, 0)
    const events = parse(PATH, buf, genericGamepadStrategy, buf)
    expect(events).toHaveLength(0)
  })
})
