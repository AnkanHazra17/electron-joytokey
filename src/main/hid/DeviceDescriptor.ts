import type { DeviceLayout } from '@shared/types'

export interface ParseStrategy {
  axisCount: number
  buttonCount: number
  axisOffset: number    // byte offset where axis data starts
  axisBytes: number     // bytes per axis value (1 = 8-bit, 2 = 16-bit)
  buttonOffset: number  // byte offset where button bits start
  hatOffset: number     // byte offset for hat/d-pad nibble (-1 = no hat)
  hatNibble: 'high' | 'low'  // which nibble of the hat byte
  name: string
}

export const genericGamepadStrategy: ParseStrategy = {
  axisCount: 4,
  buttonCount: 16,
  axisOffset: 0,
  axisBytes: 1,
  buttonOffset: 4,
  hatOffset: 4,
  hatNibble: 'low',
  name: 'Generic Gamepad',
}

export function isWhizToysDevice(product: string, manufacturer: string): boolean {
  const s = `${product} ${manufacturer}`.toLowerCase()
  return product.endsWith('-jyt') || s.includes('wts') || s.includes('whiztoys')
}

export function normalizeWhizToysReport(raw: Buffer): Buffer | null {
  if (raw.length >= 4 && raw[0] === 0x01) return raw.slice(1, 4)
  if (raw.length >= 3) return raw.slice(0, 3)
  return null
}

export const whizToysStrategy: ParseStrategy = {
  axisCount: 0,
  buttonCount: 8,
  axisOffset: 0,
  axisBytes: 1,
  buttonOffset: 0,
  hatOffset: -1,
  hatNibble: 'low',
  name: 'WhizToys BLE Gamepad',
}

// VID:PID → override strategy (add known controllers here)
const descriptors: Record<string, ParseStrategy> = {
  // Sony DualShock 4 (USB)
  '054c:09cc': {
    axisCount: 6,
    buttonCount: 14,
    axisOffset: 1,
    axisBytes: 1,
    buttonOffset: 5,
    hatOffset: 5,
    hatNibble: 'low',
    name: 'DualShock 4',
  },
  // Xbox One controller (USB)
  '045e:02ea': {
    axisCount: 6,
    buttonCount: 16,
    axisOffset: 0,
    axisBytes: 2,
    buttonOffset: 12,
    hatOffset: -1,
    hatNibble: 'low',
    name: 'Xbox One Controller',
  },
}

export function getStrategy(
  vendorId: number,
  productId: number,
  product = '',
  manufacturer = ''
): ParseStrategy {
  const key = `${vendorId.toString(16).padStart(4, '0')}:${productId.toString(16).padStart(4, '0')}`
  if (descriptors[key]) return descriptors[key]
  if (isWhizToysDevice(product, manufacturer)) return whizToysStrategy
  return genericGamepadStrategy
}

function buildWhizToysLayout(rows: number, cols: number): DeviceLayout {
  const maxButtons = whizToysStrategy.buttonCount
  const tiles = []
  let btnIdx = 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      tiles.push({
        row: r,
        col: c,
        buttonIndex: btnIdx < maxButtons ? btnIdx : -1,
        label: String(btnIdx + 1),
      })
      btnIdx++
    }
  }
  return { rows, cols, tiles }
}

export function getDeviceLayout(
  _vendorId: number,
  _productId: number,
  product = '',
  manufacturer = ''
): DeviceLayout | undefined {
  if (!isWhizToysDevice(product, manufacturer)) return undefined
  // WTS2-jyt → size 2 → 2×2 grid, WTS3-jyt → size 3 → 3×3 grid, etc.
  const match = product.match(/WTS(\d+)/i)
  const size = match ? parseInt(match[1], 10) : 3
  return buildWhizToysLayout(size, size)
}
