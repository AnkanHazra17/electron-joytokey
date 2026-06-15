export const DEFAULT_DEAD_ZONE = 0.1
export const DEFAULT_HOTKEY = 'CmdOrCtrl+Shift+J'
export const CONFIG_VERSION = 2
export const ACTIVE_WIN_POLL_MS = 1000
export const HID_POLL_MS = 2000     // USB hotplug polling interval on macOS
export const AXIS_NEUTRAL = 0.5     // normalized center value for axes
export const HAT_CENTERED = 8       // hat value when not pressed
export const MAX_AXES = 16
export const MAX_BUTTONS = 32

export const ROBOTJS_KEY_MAP: Record<string, string> = {
  space: 'space', return: 'return', escape: 'escape', tab: 'tab',
  delete: 'delete', backspace: 'delete',
  up: 'up', down: 'down', left: 'left', right: 'right',
  home: 'home', end: 'end', pageup: 'pageup', pagedown: 'pagedown',
  f1: 'f1', f2: 'f2', f3: 'f3', f4: 'f4', f5: 'f5', f6: 'f6',
  f7: 'f7', f8: 'f8', f9: 'f9', f10: 'f10', f11: 'f11', f12: 'f12',
}
