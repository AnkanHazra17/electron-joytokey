import { describe, it, expect } from 'vitest'
import {
  isWhizToysDevice,
  normalizeWhizToysReport,
  getStrategy,
  parseWhizToysLayout,
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

// 3×3 report: version=0x01, rows=3 cols=3 (0x33), tiles 0..7, last cell empty (0xFF)
// with report-id prefix: 02 01 33 00 01 02 03 04 05 06 07 FF FF FF FF FF FF FF
const VALID_3x3_WITH_ID = [0x02, 0x01, 0x33, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF]
const VALID_3x3_NO_ID   = VALID_3x3_WITH_ID.slice(1)

describe('parseWhizToysLayout', () => {
  it('parses a 3×3 report with report-id prefix', () => {
    const layout = parseWhizToysLayout(VALID_3x3_WITH_ID)
    expect(layout).not.toBeUndefined()
    expect(layout!.rows).toBe(3)
    expect(layout!.cols).toBe(3)
    expect(layout!.tiles).toHaveLength(9)
  })

  it('parses a 3×3 report without report-id prefix', () => {
    const layout = parseWhizToysLayout(VALID_3x3_NO_ID)
    expect(layout).not.toBeUndefined()
    expect(layout!.rows).toBe(3)
    expect(layout!.cols).toBe(3)
  })

  it('assigns button indices 0..7 to first 8 cells and -1 to the empty cell', () => {
    const layout = parseWhizToysLayout(VALID_3x3_WITH_ID)!
    for (let i = 0; i < 8; i++) {
      expect(layout.tiles[i].buttonIndex).toBe(i)
      expect(layout.tiles[i].label).toBe(String(i + 1))
    }
    expect(layout.tiles[8].buttonIndex).toBe(-1)
    expect(layout.tiles[8].label).toBe('')
  })

  it('returns undefined for bad protocol version', () => {
    const bad = [...VALID_3x3_NO_ID]
    bad[0] = 0x02 // wrong version
    expect(parseWhizToysLayout(bad)).toBeUndefined()
  })

  it('returns undefined when rows*cols > 16', () => {
    // version=0x01, rows=5 cols=5 (0x55) → 25 cells
    const bad = [0x01, 0x55, ...new Array(16).fill(0x00)]
    expect(parseWhizToysLayout(bad)).toBeUndefined()
  })

  it('returns undefined for empty input', () => {
    expect(parseWhizToysLayout([])).toBeUndefined()
  })

  it('returns undefined when rows or cols is zero', () => {
    const bad = [0x01, 0x00, ...new Array(16).fill(0x00)]
    expect(parseWhizToysLayout(bad)).toBeUndefined()
  })

  it('works with a Buffer input', () => {
    const layout = parseWhizToysLayout(Buffer.from(VALID_3x3_WITH_ID))
    expect(layout).not.toBeUndefined()
    expect(layout!.rows).toBe(3)
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
