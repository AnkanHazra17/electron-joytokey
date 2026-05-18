import type { JoystickEvent } from '@shared/types'
import { HAT_CENTERED } from '@shared/constants'
import type { ParseStrategy } from './DeviceDescriptor'

export function parse(
  devicePath: string,
  buf: Buffer,
  strategy: ParseStrategy,
  prevBuf: Buffer | null
): JoystickEvent[] {
  const events: JoystickEvent[] = []
  const now = performance.now()

  // Axes
  for (let i = 0; i < strategy.axisCount; i++) {
    const offset = strategy.axisOffset + i * strategy.axisBytes
    if (offset + strategy.axisBytes > buf.length) break

    const rawValue =
      strategy.axisBytes === 2
        ? buf.readUInt16LE(offset)
        : buf.readUInt8(offset)

    const maxVal = strategy.axisBytes === 2 ? 65535 : 255
    const value = rawValue / maxVal

    const prevRaw = prevBuf
      ? strategy.axisBytes === 2
        ? prevBuf.readUInt16LE(offset)
        : prevBuf.readUInt8(offset)
      : -1

    if (rawValue !== prevRaw) {
      events.push({ devicePath, type: 'axis', index: i, value, rawValue, timestamp: now })
    }
  }

  // Buttons (bit-packed)
  const maxButtons = Math.min(strategy.buttonCount, (buf.length - strategy.buttonOffset) * 8)
  for (let i = 0; i < maxButtons; i++) {
    const byteIdx = strategy.buttonOffset + Math.floor(i / 8)
    const bitIdx = i % 8
    if (byteIdx >= buf.length) break

    const value = (buf[byteIdx] >> bitIdx) & 1
    const prevValue = prevBuf ? (prevBuf[byteIdx] >> bitIdx) & 1 : -1

    if (value !== prevValue) {
      events.push({ devicePath, type: 'button', index: i, value, rawValue: value, timestamp: now })
    }
  }

  // Hat / D-pad
  if (strategy.hatOffset >= 0 && strategy.hatOffset < buf.length) {
    const byte = buf[strategy.hatOffset]
    const rawHat = strategy.hatNibble === 'low' ? byte & 0x0f : (byte >> 4) & 0x0f
    const hatValue = rawHat > 7 ? HAT_CENTERED : rawHat

    const prevByte = prevBuf ? prevBuf[strategy.hatOffset] : -1
    const prevRawHat = prevBuf
      ? strategy.hatNibble === 'low'
        ? prevByte & 0x0f
        : (prevByte >> 4) & 0x0f
      : -1

    if (rawHat !== prevRawHat) {
      events.push({ devicePath, type: 'hat', index: 0, value: hatValue, rawValue: rawHat, timestamp: now })
    }
  }

  return events
}
