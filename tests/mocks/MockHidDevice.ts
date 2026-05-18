import { EventEmitter } from 'events'

export class MockHidDevice extends EventEmitter {
  private intervalId?: ReturnType<typeof setInterval>

  startEmitting(report: Buffer, intervalMs = 16): void {
    this.intervalId = setInterval(() => this.emit('data', Buffer.from(report)), intervalMs)
  }

  stopEmitting(): void {
    clearInterval(this.intervalId)
  }

  close(): void {
    this.stopEmitting()
    this.removeAllListeners()
  }

  // Stub write — HID devices also support sending reports
  write(_data: number[]): number { return _data.length }
}
