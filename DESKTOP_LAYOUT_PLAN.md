# Desktop App — Real Layout Detection (consume firmware HID feature report)

## Why

Today `getDeviceLayout()` in `src/main/hid/DeviceDescriptor.ts` guesses the grid from the device
name with `product.match(/WTS(\d+)/i)` and builds a `size×size` square. That digit is the **firmware
version** (`WTS2-jyt` → version 2.0), **not** the grid size — so it always renders a 2×2 grid and
ignores the real, modular tile arrangement.

The firmware now exposes the true layout over HID as a **Feature Report (Report ID 2)**. This plan
replaces the name heuristic with reading that report on connect. The grid UI
(`DeviceGrid` / `GridPage`) already renders `selectedDevice.layout` and needs **no changes**.

## Wire protocol (must match firmware)

HID **Feature Report, Report ID `0x02`, 18 data bytes**:

| Byte | Meaning |
|---|---|
| 0 | Protocol version = `0x01` |
| 1 | `(rows << 4) \| (cols & 0x0F)` |
| 2..17 | Per-cell **HID button index**, row-major (`r*cols + c`); `0x00`–`0x07` = button index, `0xFF` = empty cell |

The button index in each cell equals the input-report button bit, so pressing a tile lights the
correct on-screen tile with no extra mapping.

> node-hid's `getFeatureReport(id, len)` returns a `number[]` that, on most platforms, is prefixed
> with the report-id byte. Request `len = 19` and strip a leading `0x02` if present (handled below).

---

## Changes

### 1. `src/shared/constants.ts`
```ts
export const WHIZTOYS_LAYOUT_REPORT_ID = 2
export const WHIZTOYS_LAYOUT_REPORT_LEN = 18
```

### 2. `src/main/hid/DeviceDescriptor.ts`
Delete `buildWhizToysLayout()` and the current `getDeviceLayout()` (the `/WTS(\d+)/i` version). Keep
`isWhizToysDevice`, `whizToysStrategy`, `normalizeWhizToysReport`, `getStrategy` unchanged. Add a
parser for the feature report:

```ts
import type { DeviceLayout, TileInfo } from '@shared/types'
import { WHIZTOYS_LAYOUT_REPORT_ID } from '@shared/constants'

/**
 * Decode the firmware HID layout feature report (Report ID 2) into a DeviceLayout.
 * Returns undefined if the report is absent/invalid (e.g. old firmware).
 */
export function parseWhizToysLayout(raw: Buffer | number[]): DeviceLayout | undefined {
  const bytes = Array.from(raw)
  if (bytes.length === 0) return undefined
  // node-hid may prefix the report id; strip it.
  const data = bytes[0] === WHIZTOYS_LAYOUT_REPORT_ID ? bytes.slice(1) : bytes
  if (data[0] !== 0x01) return undefined // protocol version

  const rows = (data[1] >> 4) & 0x0f
  const cols = data[1] & 0x0f
  if (rows === 0 || cols === 0 || rows * cols > 16) return undefined

  const tiles: TileInfo[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = data[2 + r * cols + c]
      const buttonIndex = idx === 0xff || idx === undefined ? -1 : idx
      tiles.push({
        row: r,
        col: c,
        buttonIndex,
        label: buttonIndex >= 0 ? String(buttonIndex + 1) : '',
      })
    }
  }
  return { rows, cols, tiles }
}
```

### 3. `src/main/hid/HidManager.ts`
Read the real layout when the device is opened, cache it per path, and serve it from `enumerate()`.

- Imports: drop `getDeviceLayout`; add the new symbols:
  ```ts
  import { getStrategy, parseWhizToysLayout, normalizeWhizToysReport } from './DeviceDescriptor'
  import { HID_POLL_MS, WHIZTOYS_LAYOUT_REPORT_ID, WHIZTOYS_LAYOUT_REPORT_LEN } from '@shared/constants'
  import type { DeviceLayout, HidDeviceInfo, JoystickEvent } from '@shared/types'
  ```
- Add a cache field on the class:
  ```ts
  private layouts = new Map<string, DeviceLayout>()
  ```
- In `enumerate()`, replace the `getDeviceLayout(...)` line with the cached layout:
  ```ts
  layout: this.layouts.get(d.path ?? ''),
  ```
- In `openDevice()`, after `const device = new HID(path)` and the WhizToys check, read the report:
  ```ts
  if (strategy.name === 'WhizToys BLE Gamepad') {
    try {
      const raw = device.getFeatureReport(
        WHIZTOYS_LAYOUT_REPORT_ID,
        WHIZTOYS_LAYOUT_REPORT_LEN + 1, // +1 for the leading report-id byte
      )
      const layout = parseWhizToysLayout(raw)
      if (layout) this.layouts.set(path, layout)
      else this.layouts.delete(path)
    } catch (err) {
      // Old/silent firmware: no feature report -> no grid (GridPage shows fallback).
      this.layouts.delete(path)
      log.warn(`[HidManager] no layout feature report from ${path}: ${String(err)}`)
    }
  }
  ```
  Do this **before** `this.emit('devices:changed', this.enumerate())` so the first emit carries the
  layout.
- In `closeDevice()` and the reader `error` handler, clear the cache:
  ```ts
  this.layouts.delete(path)
  ```

No IPC or preload changes: `devices:changed` / `devices:list` already carry `HidDeviceInfo.layout`,
and `GridPage` reads `selectedDevice?.layout`.

### 4. Renderer
No changes. `GridPage` + `DeviceGrid` + `GridTile` already consume `selectedDevice.layout`. Before
connect (no cached layout) the existing "Connect your device…" / "No layout available" states show,
which is correct — the report can only be read on an open device.

### 5. Tests (`tests/unit/`)
- `parseWhizToysLayout`:
  - A valid 3×3 report with 8 tiles (one `0xFF` empty cell) → 9 tiles, the empty one `buttonIndex:-1`,
    others `0..7`. Test both with and without the leading report-id byte.
  - Bad version byte → `undefined`; `rows*cols > 16` → `undefined`.
- `tests/mocks/MockHidDevice.ts`: add a `getFeatureReport(id, len)` stub returning a canned layout
  buffer so `HidManager.openDevice` can be exercised.

Example expected buffer (3×3, tiles 0..7, last cell empty), with report-id prefix:
```
02 01 33 00 01 02 03 04 05 06 07 FF FF FF FF FF FF FF
   └id └ver └3x3 └────────── 8 tiles ──────────┘ └ empty + padding
```

---

## Verification
1. Flash the updated firmware. Connect the carpet on the Devices tab.
2. `npm run dev` → open **Key Map**: the grid shows the device's **real** rows×cols (not 2×2), with
   empty cells greyed.
3. Step on a tile → its on-screen tile glows. Click a tile → assign a key → press it with mapping
   enabled → the key fires in a text editor.
4. `npm test` green. A non-WhizToys gamepad still shows the generic `ButtonMap` (no regression).

## Note
Profile mappings remain keyed by button index. If tiles are physically rearranged, the next firmware
boot re-discovers the order and the feature report reflects the new positions; a saved key stays
attached to its button index. Revisit `(row,col)`-keyed mappings later if that becomes a problem.
