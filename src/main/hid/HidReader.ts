import { EventEmitter } from 'events'
import type { HID } from 'node-hid'
import { WHIZTOYS_LAYOUT_REPORT_ID } from '@shared/constants'
import type { DeviceLayout, JoystickEvent } from '@shared/types'
import { parse } from './HidParser'
import { parseWhizToysLayout, type ParseStrategy } from './DeviceDescriptor'
import log from '../logger'

export class HidReader extends EventEmitter {
  private prevBuf: Buffer | null = null
  private closed = false

  constructor(
    private readonly device: HID,
    private readonly devicePath: string,
    private readonly strategy: ParseStrategy,
    private readonly preprocessor?: (buf: Buffer) => Buffer | null
  ) {
    super()
    device.on('data', (buf: Buffer) => this.onData(buf))
    device.on('error', (err: Error) => {
      if (!this.closed) log.warn(`[HidReader] ${devicePath} error: ${err.message}`)
      this.emit('error', err)
    })
  }

  private onData(raw: Buffer): void {
    try {
      // WhizToys delivers the tile layout as Report ID 2 (a notified input
      // report, since Windows won't expose BLE HID feature reports). Intercept
      // those frames and surface them as a layout instead of gamepad input.
      if (
        this.strategy.name === 'WhizToys BLE Gamepad' &&
        raw.length > 0 &&
        raw[0] === WHIZTOYS_LAYOUT_REPORT_ID
      ) {
        const layout = parseWhizToysLayout(raw)
        if (layout) this.emit('whiztoys:layout', layout as DeviceLayout)
        return
      }
      const buf = this.preprocessor ? this.preprocessor(raw) : raw
      if (!buf) return
      const events = parse(this.devicePath, buf, this.strategy, this.prevBuf)
      this.prevBuf = Buffer.from(buf)
      for (const evt of events) {
        this.emit('joystick:input', evt as JoystickEvent)
      }
    } catch (err) {
      log.error('[HidReader] parse error', err)
    }
  }

  close(): void {
    this.closed = true
    try { this.device.close() } catch { /* ignore */ }
    this.removeAllListeners()
  }
}
