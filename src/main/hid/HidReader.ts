import { EventEmitter } from 'events'
import type { HID } from 'node-hid'
import type { JoystickEvent } from '@shared/types'
import { parse } from './HidParser'
import type { ParseStrategy } from './DeviceDescriptor'
import log from '../logger'

export class HidReader extends EventEmitter {
  private prevBuf: Buffer | null = null
  private closed = false

  constructor(
    private readonly device: HID,
    private readonly devicePath: string,
    private readonly strategy: ParseStrategy
  ) {
    super()
    device.on('data', (buf: Buffer) => this.onData(buf))
    device.on('error', (err: Error) => {
      if (!this.closed) log.warn(`[HidReader] ${devicePath} error: ${err.message}`)
      this.emit('error', err)
    })
  }

  private onData(buf: Buffer): void {
    try {
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
