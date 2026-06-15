# Layout Detection

Documents how the app detects a connected device's button layout and renders it as a clickable grid.

---

## Overview

HID only exposes raw button indices (0, 1, 2, …). The app maps those indices onto a spatial grid (rows × columns) so the Key Map page can display the physical tile arrangement and let users assign keys by clicking tiles.

Layout detection runs entirely on the **main process** and is piggybacked onto the existing `HidDeviceInfo` struct — no extra IPC channels are needed.

---

## Data Types

```
src/shared/types.ts
```

```typescript
interface TileInfo {
  row: number
  col: number
  buttonIndex: number  // -1 = placeholder (no firmware button at this position)
  label: string        // display label, e.g. "1", "2", …
}

interface DeviceLayout {
  rows: number
  cols: number
  tiles: TileInfo[]   // length === rows * cols, in row-major order
}

interface HidDeviceInfo {
  // … standard HID fields …
  layout?: DeviceLayout  // undefined when no spatial layout is known
}
```

---

## Detection Flow

### 1. Enumeration (`src/main/hid/HidManager.ts`)

`HidManager.enumerate()` is called on startup and every 2 s (macOS hotplug polling). For every discovered HID device that passes the usage-page filter it builds a `HidDeviceInfo` and calls `getDeviceLayout`:

```typescript
layout: getDeviceLayout(d.vendorId, d.productId, d.product ?? '', d.manufacturer ?? '')
```

### 2. Layout computation (`src/main/hid/DeviceDescriptor.ts`)

`getDeviceLayout(vendorId, productId, product, manufacturer): DeviceLayout | undefined`

**Decision tree:**

```
isWhizToysDevice(product, manufacturer)?
  YES → buildWhizToysLayout(size, size)
  NO  → undefined
```

`undefined` means "no spatial layout known" — the Key Map page shows a fallback message.

### 3. WhizToys detection

```typescript
// DeviceDescriptor.ts
export function isWhizToysDevice(product: string, manufacturer: string): boolean {
  const s = `${product} ${manufacturer}`.toLowerCase()
  return product.endsWith('-jyt') || s.includes('wts') || s.includes('whiztoys')
}
```

Heuristics (any one is sufficient):
- Product string ends with `-jyt`
- Product or manufacturer contains `wts`
- Product or manufacturer contains `whiztoys`

### 4. Grid builder

```typescript
function buildWhizToysLayout(rows: number, cols: number): DeviceLayout {
  const maxButtons = whizToysStrategy.buttonCount  // 8
  let btnIdx = 0
  const tiles: TileInfo[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      tiles.push({
        row: r, col: c,
        buttonIndex: btnIdx < maxButtons ? btnIdx : -1,
        label: String(btnIdx + 1),
      })
      btnIdx++
    }
  }
  return { rows, cols, tiles }
}
```

For a `WTS3-jyt` device (3×3):

| Position | Button index | Label | Note |
|---|---|---|---|
| [0,0] | 0 | 1 | |
| [0,1] | 1 | 2 | |
| [0,2] | 2 | 3 | |
| [1,0] | 3 | 4 | |
| [1,1] | 4 | 5 | |
| [1,2] | 5 | 6 | |
| [2,0] | 6 | 7 | |
| [2,1] | 7 | 8 | |
| [2,2] | **-1** | 9 | placeholder — no firmware button |

The grid size is extracted from the product name: `/WTS(\d+)/i` → `size × size`. Defaults to 3 if the regex doesn't match.

---

## Parse Strategy (separate from layout)

Layout (spatial metadata) is independent of the parse strategy (how raw bytes are decoded). Strategy selection follows its own fallback chain:

```
VID:PID in descriptors map?  → use that ParseStrategy
isWhizToysDevice?            → whizToysStrategy  (0 axes, 8 buttons, report normalization)
else                         → genericGamepadStrategy (4 axes, 16 buttons)
```

Known VID:PID entries:
- `054c:09cc` — DualShock 4 (6 axes, 14 buttons)
- `045e:02ea` — Xbox One (6 axes, 16 buttons)

WhizToys devices also get a **report preprocessor** that strips the leading `0x01` report-ID byte before the main parser runs.

---

## Data Flow to Renderer

```
HidManager.enumerate()
  └─ getDeviceLayout()  ──→  HidDeviceInfo.layout
        │
        ▼
  ipcMain.handle('devices:list', ...)        ← initial load
  hidManager.emit('devices:changed', devices) ← live updates
        │
        ▼
  useDevices() hook (renderer)
  setDevices(updated)
        │
        ▼
  GridPage
  const layout = selectedDevice?.layout
        │
        ▼
  <DeviceGrid layout={layout} />
        │
        ▼
  <GridTile> × N
```

`layout` is `undefined` for unrecognised devices. `GridPage` shows a "No layout available" message in that case.

---

## Tile Rendering (`src/renderer/src/components/DeviceGrid/`)

**DeviceGrid** iterates `layout.tiles` through a `positionOrder` array (enables drag-to-reorder):

```typescript
{positionOrder.map((tileIdx, posIdx) => {
  const tile = layout.tiles[tileIdx]
  const pressed = events.get(`button:${tile.buttonIndex}`)?.value === 1
  const mapping = mappings.find(
    m => m.trigger.type === 'button' && m.trigger.index === tile.buttonIndex && m.enabled
  )
  const mappedKey = mapping ? formatAction(mapping.action) : undefined
  return <GridTile tileNumber={tile.label} buttonId={...} pressed={pressed} mappedKey={mappedKey} />
})}
```

**GridTile** displays per tile:
- Top-right: button ID (`B0`, `B1`, … or `—` for placeholders)
- Centre: tile label (`1`–`9`)
- Bottom: assigned key in accent colour (`Space`, `Ctrl+C`, …)
- Glow ring on press
- Greyed out / `opacity-25` for placeholder tiles (`buttonIndex < 0`)

---

## Drag-to-Reorder

Users can reorder tiles visually without changing the underlying button indices. The order is persisted **per device** in `localStorage`:

```
key:   "joytokey:layout-order:<vendorId>:<productId>"
value: [2, 0, 1, 3, 4, 5, 6, 7, 8]   // positionOrder → tileIdx mapping
```

`resetLayoutOrder(deviceKey, tileCount)` restores `[0, 1, 2, …]` and is triggered by the **Reset** button in edit mode.

---

## Adding Layout Support for a New Device

1. In `src/main/hid/DeviceDescriptor.ts`, add a detection function (similar to `isWhizToysDevice`) and a layout builder.
2. Extend `getDeviceLayout` to call it before the final `return undefined`.
3. If the device also needs a custom parse strategy, add a VID:PID entry to the `descriptors` map.
4. No IPC, store, or renderer changes are needed.
