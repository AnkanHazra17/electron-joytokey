import { Usb, RefreshCw, Plug, PlugZap } from 'lucide-react'
import { useDevices } from '../hooks/useDevices'
import { useUiStore } from '../store/uiStore'

export function DevicesPage() {
  const { devices, loading, refresh, connect, disconnect } = useDevices()
  const setSelectedDevice = useUiStore((s) => s.setSelectedDevice)
  const setActiveTab = useUiStore((s) => s.setActiveTab)

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Devices</h2>
        <button
          onClick={refresh}
          className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      {loading && (
        <p className="text-sm text-[var(--text-muted)]">Scanning for HID devices…</p>
      )}

      {!loading && devices.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-[var(--text-muted)]">
          <Usb size={40} strokeWidth={1.5} />
          <p className="text-sm">No joystick or gamepad detected</p>
          <p className="text-xs">Connect a USB HID device and click Refresh</p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {devices.map((device) => (
          <div
            key={device.path}
            className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] hover:border-[var(--accent)]/40 transition-colors"
          >
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${device.isOpen ? 'bg-[var(--success)]' : 'bg-[var(--border)]'}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{device.product || 'Unknown Device'}</p>
              <p className="text-xs text-[var(--text-muted)]">
                {device.manufacturer || `VID:${device.vendorId.toString(16).toUpperCase()} PID:${device.productId.toString(16).toUpperCase()}`}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              {device.isOpen && (
                <button
                  onClick={() => { setSelectedDevice(device.path); setActiveTab('mapping') }}
                  className="px-3 py-1.5 text-xs rounded-md border border-[var(--accent)]/40 text-[var(--accent)] hover:bg-[var(--accent)]/10 transition-colors"
                >
                  Map
                </button>
              )}
              <button
                onClick={() => device.isOpen ? disconnect(device) : connect(device)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors ${
                  device.isOpen
                    ? 'border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--danger)] hover:border-[var(--danger)]/40'
                    : 'bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-medium'
                }`}
              >
                {device.isOpen ? <><Plug size={12} />Disconnect</> : <><PlugZap size={12} />Connect</>}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
