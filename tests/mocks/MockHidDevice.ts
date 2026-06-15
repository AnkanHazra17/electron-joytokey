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

  // Canned layout report returned by getFeatureReport (can be overridden per test)
  featureReportData: number[] = []

  getFeatureReport(_id: number, _len: number): number[] {
    return this.featureReportData
  }

  // Stub write — HID devices also support sending reports
  write(_data: number[]): number { return _data.length }
}
