import { EventEmitter } from 'events'
import type { HidDeviceInfo, JoystickEvent } from '@shared/types'
import { HID_POLL_MS } from '@shared/constants'
import { getStrategy } from './DeviceDescriptor'
import { HidReader } from './HidReader'
import log from '../logger'

// Lazy require so electron-vite treats node-hid as external
const HIDLib = () => require('node-hid') as typeof import('node-hid')

// Only enumerate Generic Desktop Joystick (usage 4) and Gamepad (usage 5)
const ALLOWED_USAGES = new Set([4, 5])
const USAGE_PAGE_GENERIC_DESKTOP = 1

export class HidManager extends EventEmitter {
  private readers = new Map<string, HidReader>()
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private lastPaths = new Set<string>()

  start(): void {
    this.poll()
    this.pollTimer = setInterval(() => this.poll(), HID_POLL_MS)
  }

  stop(): void {
    if (this.pollTimer) clearInterval(this.pollTimer)
    for (const reader of this.readers.values()) reader.close()
    this.readers.clear()
  }

  enumerate(): HidDeviceInfo[] {
    const { devices } = HIDLib()
    return devices()
      .filter(
        (d) =>
          d.usagePage === USAGE_PAGE_GENERIC_DESKTOP &&
          ALLOWED_USAGES.has(d.usage ?? 0)
      )
      .map((d) => ({
        path: d.path ?? '',
        vendorId: d.vendorId,
        productId: d.productId,
        manufacturer: d.manufacturer ?? '',
        product: d.product ?? '',
        serialNumber: d.serialNumber ?? '',
        usage: d.usage ?? 0,
        usagePage: d.usagePage ?? 0,
        isOpen: this.readers.has(d.path ?? ''),
      }))
  }

  openDevice(path: string, vendorId: number, productId: number): void {
    if (this.readers.has(path)) return
    try {
      const { HID } = HIDLib()
      const device = new HID(path)
      const strategy = getStrategy(vendorId, productId)
      const reader = new HidReader(device, path, strategy)
      reader.on('joystick:input', (evt: JoystickEvent) => this.emit('joystick:input', evt))
      reader.on('error', () => {
        this.readers.delete(path)
        this.emit('devices:changed', this.enumerate())
      })
      this.readers.set(path, reader)
      log.info(`[HidManager] opened ${path} (${strategy.name})`)
      this.emit('devices:changed', this.enumerate())
    } catch (err) {
      log.error(`[HidManager] failed to open ${path}:`, err)
    }
  }

  closeDevice(path: string): void {
    const reader = this.readers.get(path)
    if (reader) {
      reader.close()
      this.readers.delete(path)
      log.info(`[HidManager] closed ${path}`)
      this.emit('devices:changed', this.enumerate())
    }
  }

  private poll(): void {
    const currentPaths = new Set(this.enumerate().map((d) => d.path))
    const added = [...currentPaths].filter((p) => !this.lastPaths.has(p))
    const removed = [...this.lastPaths].filter((p) => !currentPaths.has(p))

    if (added.length > 0 || removed.length > 0) {
      // Close readers for disconnected devices
      for (const path of removed) {
        if (this.readers.has(path)) this.closeDevice(path)
      }
      this.lastPaths = currentPaths
      this.emit('devices:changed', this.enumerate())
    }
  }
}

export const hidManager = new HidManager()
