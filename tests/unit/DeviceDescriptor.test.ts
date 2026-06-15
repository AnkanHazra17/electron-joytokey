import { describe, it, expect } from 'vitest'
import {
  isWhizToysDevice,
  normalizeWhizToysReport,
  getStrategy,
  whizToysStrategy,
  genericGamepadStrategy,
} from '../../src/main/hid/DeviceDescriptor'

describe('isWhizToysDevice', () => {
  it('matches -jyt suffix', () => {
    expect(isWhizToysDevice('WTS2-jyt', '')).toBe(true)
  })
  it('matches WTS in product', () => {
    expect(isWhizToysDevice('WTS2', '')).toBe(true)
  })
  it('matches whiztoys case-insensitively', () => {
    expect(isWhizToysDevice('WhizToys Pro', '')).toBe(true)
  })
  it('matches wts in manufacturer', () => {
    expect(isWhizToysDevice('Gamepad', 'WTS Corp')).toBe(true)
  })
  it('does not match unrelated device', () => {
    expect(isWhizToysDevice('Logitech F310', 'Logitech')).toBe(false)
  })
  it('does not match empty strings', () => {
    expect(isWhizToysDevice('', '')).toBe(false)
  })
})

describe('normalizeWhizToysReport', () => {
  it('strips Report ID prefix when first byte is 0x01 and length >= 4', () => {
    const raw = Buffer.from([0x01, 0b00000001, 0x00, 0x00])
    const result = normalizeWhizToysReport(raw)
    expect(result).not.toBeNull()
    expect(result!.length).toBe(3)
    expect(result![0]).toBe(0b00000001)  // button byte
  })

  it('passes through 3-byte report without Report ID', () => {
    const raw = Buffer.from([0b00000011, 0x00, 0x00])
    const result = normalizeWhizToysReport(raw)
    expect(result).not.toBeNull()
    expect(result![0]).toBe(0b00000011)  // buttons 0 and 1 pressed
  })

  it('does NOT strip first byte when it is not 0x01, even with 4 bytes', () => {
    const raw = Buffer.from([0b00000011, 0x00, 0x00, 0x00])
    const result = normalizeWhizToysReport(raw)
    expect(result![0]).toBe(0b00000011)  // treated as 3-byte form
  })

  it('returns null for buffers shorter than 3 bytes', () => {
    expect(normalizeWhizToysReport(Buffer.from([0x01]))).toBeNull()
    expect(normalizeWhizToysReport(Buffer.from([0x01, 0x00]))).toBeNull()
    expect(normalizeWhizToysReport(Buffer.alloc(0))).toBeNull()
  })

  it('all 8 button bits survive normalization', () => {
    const raw = Buffer.from([0x01, 0xFF, 0x00, 0x00])  // all 8 buttons pressed
    const result = normalizeWhizToysReport(raw)
    expect(result![0]).toBe(0xFF)
  })
})

describe('getStrategy', () => {
  it('returns WhizToys strategy when product ends in -jyt', () => {
    const s = getStrategy(0x0000, 0x0000, 'WTS2-jyt', '')
    expect(s).toBe(whizToysStrategy)
    expect(s.buttonCount).toBe(8)
    expect(s.axisCount).toBe(0)
    expect(s.hatOffset).toBe(-1)
  })

  it('returns generic strategy for unknown devices', () => {
    const s = getStrategy(0xFFFF, 0xFFFF, 'Unknown Pad', '')
    expect(s).toBe(genericGamepadStrategy)
  })

  it('VID:PID lookup takes priority over name (DualShock 4)', () => {
    const s = getStrategy(0x054c, 0x09cc, 'WTS2-jyt', '')
    expect(s.name).toBe('DualShock 4')
  })

  it('works with no name args (backwards-compatible)', () => {
    const s = getStrategy(0xFFFF, 0xFFFF)
    expect(s).toBe(genericGamepadStrategy)
  })
})

describe('whizToysStrategy shape', () => {
  it('has correct fields for 8-button no-hat gamepad', () => {
    expect(whizToysStrategy.buttonCount).toBe(8)
    expect(whizToysStrategy.axisCount).toBe(0)
    expect(whizToysStrategy.hatOffset).toBe(-1)
    expect(whizToysStrategy.buttonOffset).toBe(0)
    expect(whizToysStrategy.name).toBe('WhizToys BLE Gamepad')
  })
})
