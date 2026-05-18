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

export function getStrategy(vendorId: number, productId: number): ParseStrategy {
  const key = `${vendorId.toString(16).padStart(4, '0')}:${productId.toString(16).padStart(4, '0')}`
  return descriptors[key] ?? genericGamepadStrategy
}
