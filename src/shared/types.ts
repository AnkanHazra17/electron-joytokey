// ─── Devices ─────────────────────────────────────────────────────────────────

export interface TileInfo {
  row: number
  col: number
  buttonIndex: number  // -1 = placeholder tile (no button in firmware)
  label: string
}

export interface DeviceLayout {
  rows: number
  cols: number
  tiles: TileInfo[]
}

export interface HidDeviceInfo {
  path: string
  vendorId: number
  productId: number
  manufacturer: string
  product: string
  serialNumber: string
  usage: number
  usagePage: number
  isOpen: boolean
  layout?: DeviceLayout
}

// ─── Events ──────────────────────────────────────────────────────────────────

export type JoystickEventType = 'button' | 'axis' | 'hat'

export interface JoystickEvent {
  devicePath: string
  type: JoystickEventType
  index: number
  value: number      // button: 0|1  axis: 0.0–1.0  hat: 0–7 (8 = centered)
  rawValue: number
  timestamp: number
}

// ─── Mappings ────────────────────────────────────────────────────────────────

export type TriggerCondition = 'press' | 'release' | 'held' | 'threshold'
export type HatDirection = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7  // N NE E SE S SW W NW

export interface InputTrigger {
  type: JoystickEventType
  index: number
  condition: TriggerCondition
  threshold?: number           // 0.0–1.0 for axis threshold
  thresholdDir?: 'above' | 'below'
  hatDir?: HatDirection
  holdDurationMs?: number
}

export type ActionType = 'key' | 'keyCombo' | 'mouseButton' | 'noop'
export type ModifierKey = 'control' | 'shift' | 'option' | 'command'
export type MouseButton = 'left' | 'right' | 'middle'

export interface MappedAction {
  type: ActionType
  key?: string
  modifiers?: ModifierKey[]
  toggle?: boolean             // hold key while input is held
  mouseButton?: MouseButton
  mouseDouble?: boolean
}

export interface Mapping {
  id: string
  label?: string
  trigger: InputTrigger
  action: MappedAction
  enabled: boolean
}

// ─── Profiles ────────────────────────────────────────────────────────────────

export interface Profile {
  id: string
  name: string
  description?: string
  deviceVid?: number
  devicePid?: number
  deviceName?: string
  appBundleId?: string
  appName?: string
  mappings: Mapping[]
  deadZones: Record<number, number>  // axisIndex → 0.0–0.5
  axisCount: number
  buttonCount: number
  createdAt: number
  updatedAt: number
}

// ─── App Config ───────────────────────────────────────────────────────────────

export type LogLevel = 'error' | 'warn' | 'info' | 'debug'

export interface AppConfig {
  configVersion: number
  activeProfileId: string | null
  profiles: Profile[]
  globalEnabled: boolean
  globalHotkey: string
  launchAtLogin: boolean
  minimizeToTray: boolean
  logLevel: LogLevel
  connectedDevicePaths: string[]
}

// ─── IPC ─────────────────────────────────────────────────────────────────────

export interface IpcResult<T = void> {
  ok: boolean
  data?: T
  error?: string
}

export type UpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error'

export interface UpdateStatus {
  state: UpdateState
  version?: string
  percent?: number
  error?: string
}
