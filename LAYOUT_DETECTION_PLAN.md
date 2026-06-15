# Layout Detection & Tile-Based Key Mapping — Implementation Plan

## Overview

The WhizToys device has a fixed 3×3 physical tile grid. HID only tells us button indices (0–7). This feature:

1. Detects that the connected device is a WhizToys and derives its grid layout
2. Flows that layout metadata to the renderer via device info
3. Renders the UI as the actual physical grid, showing mapped keys on each tile
4. Allows clicking a tile to assign a key binding directly from the grid view

---

## Background

From `HID_DEVICE.md`: the tile-to-button order comes from `WhizCarpet::getOrderedTileLayout()` in firmware, which iterates `_carpet_id_map` in row-major key order. This means:

- Button 1 (index 0) → top-left tile
- Button 2 (index 1) → top-center tile
- ...
- Button 8 (index 7) → bottom-center tile
- Position [2,2] (bottom-right) → no firmware button yet (placeholder)

The desktop app cannot infer row/column from HID alone — only button indices. Layout must be defined statically per device type.

---

## Step 1 — Add Layout Types

**File:** `src/shared/types.ts`

Add two new interfaces and extend `HidDeviceInfo`:

```typescript
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
```

Extend `HidDeviceInfo`:

```typescript
export interface HidDeviceInfo {
  // ...existing fields...
  layout?: DeviceLayout  // undefined = no spatial layout known for this device
}
```

**Why:** All IPC-transported device info already flows through `HidDeviceInfo`. Adding layout there means no new IPC channels are needed.

---

## Step 2 — Add Layout Computation

**File:** `src/main/hid/DeviceDescriptor.ts`

Add a new exported function:

```typescript
export function getDeviceLayout(
  vendorId: number,
  productId: number,
  product: string,
  manufacturer: string
): DeviceLayout | undefined {
  if (isWhizToysDevice(product, manufacturer)) {
    return {
      rows: 3,
      cols: 3,
      tiles: [
        { row: 0, col: 0, buttonIndex: 0, label: '1' },
        { row: 0, col: 1, buttonIndex: 1, label: '2' },
        { row: 0, col: 2, buttonIndex: 2, label: '3' },
        { row: 1, col: 0, buttonIndex: 3, label: '4' },
        { row: 1, col: 1, buttonIndex: 4, label: '5' },
        { row: 1, col: 2, buttonIndex: 5, label: '6' },
        { row: 2, col: 0, buttonIndex: 6, label: '7' },
        { row: 2, col: 1, buttonIndex: 7, label: '8' },
        { row: 2, col: 2, buttonIndex: -1, label: '9' }, // not in firmware yet
      ],
    }
  }
  return undefined  // DualShock, Xbox, generic — no spatial layout
}
```

---

## Step 3 — Attach Layout in HidManager

**File:** `src/main/hid/HidManager.ts`

When building the `HidDeviceInfo` object during device enumeration, call `getDeviceLayout()` and attach the result:

```typescript
import { getStrategy, getDeviceLayout, isWhizToysDevice } from './DeviceDescriptor'

// inside the device mapping:
const layout = getDeviceLayout(d.vendorId, d.productId, d.product ?? '', d.manufacturer ?? '')
return {
  path: d.path,
  vendorId: d.vendorId,
  // ...other fields...
  layout,
}
```

Layout flows automatically via the existing `devices:changed` event and `devices:list` invoke — no new IPC channels needed.

---

## Step 4 — Rework GridPage

**File:** `src/renderer/src/pages/GridPage.tsx`

Transform from a simple wrapper into the feature hub for layout-aware mapping:

### Responsibilities
- Read `selectedDevicePath` from `uiStore`
- Find the selected device from `useDevices()` to get its `layout`
- Read `activeProfile` from `useProfiles()` to display current key bindings on tiles
- Get live input events from `useJoystickEvents(selectedDevicePath)`
- Manage `assigningButton: number | null` local state
- Render `<KeyAssignModal>` when a tile is clicked
- On modal save: upsert the new mapping into the active profile via `save()`

### Render logic
```
if no device connected      → "Connect your device from the Devices tab"
if device has no layout     → "No layout available for this device type"
if device has layout        → <DeviceGrid layout events mappings onTileClick />
```

### Key assign flow
1. User clicks a tile → `setAssigningButton(buttonIndex)`
2. `<KeyAssignModal>` opens with `trigger = { type: 'button', index: buttonIndex, condition: 'press' }`
3. User presses a key → modal calls `onSave(action)`
4. Find existing mapping for this button in `activeProfile.mappings` (match by `trigger.type === 'button' && trigger.index === buttonIndex`)
5. If found: replace it. If not: push a new `Mapping` with a `uuidv4()` id
6. Call `save({ ...activeProfile, mappings: updatedMappings, updatedAt: Date.now() })`
7. Close modal

---

## Step 5 — Refactor DeviceGrid

**File:** `src/renderer/src/components/DeviceGrid/DeviceGrid.tsx`

Replace hardcoded `TILES` array with props:

```typescript
interface DeviceGridProps {
  layout: DeviceLayout
  events: Map<string, JoystickEvent>
  mappings: Mapping[]
  onTileClick: (buttonIndex: number) => void
}
```

### Render
- CSS grid: `grid-cols-{layout.cols}` (dynamic from layout)
- For each `TileInfo` in `layout.tiles`:
  - `pressed` = `events.get('button:N')?.value === 1`
  - `mappedKey` = find mapping where `trigger.type === 'button' && trigger.index === tile.buttonIndex`, then format its action label
  - `onClick` = `() => onTileClick(tile.buttonIndex)` (only if `buttonIndex >= 0`)
- Render a `<GridTile>` at each position

### Action label formatting helper
```typescript
function formatAction(action: MappedAction): string {
  if (action.type === 'noop') return ''
  const mods = action.modifiers?.map(m => m[0].toUpperCase() + m.slice(1)) ?? []
  return [...mods, action.key ?? action.mouseButton ?? ''].filter(Boolean).join('+')
}
```

---

## Step 6 — Update GridTile

**File:** `src/renderer/src/components/DeviceGrid/GridTile.tsx`

Add two new optional props:

```typescript
interface GridTileProps {
  label: string
  pressed: boolean
  unavailable?: boolean
  mappedKey?: string    // formatted label of assigned action (e.g. "Space", "Ctrl+S")
  onClick?: () => void  // undefined = not interactive
}
```

### Visual changes
- When `onClick` is defined: add `cursor-pointer` and `hover:border-(--accent)/60` styles
- When `mappedKey` is set: show it in small text below the tile number (accent color when present, muted when not)
- Tile layout: flex column, tile number on top, key label below

```
┌─────────┐
│    1    │
│  Space  │  ← mappedKey
└─────────┘
```

---

## What Does NOT Change

| Component | Reason |
|---|---|
| `KeyAssignModal` | Works as-is, no modifications needed |
| `HidParser` / `HidReader` | Layout is metadata only, doesn't affect binary parsing |
| `MappingEngine` | No change — still processes button events by index |
| `MappingPage` | Remains available for axis, hat, and advanced mapping |
| `src/shared/ipcChannels.ts` | No new IPC channels needed |
| `ConfigStore` / `migrations.ts` | Layout is computed, not persisted |

---

## File Change Summary

| File | Type | Description |
|---|---|---|
| `src/shared/types.ts` | Modify | Add `TileInfo`, `DeviceLayout`; extend `HidDeviceInfo` |
| `src/main/hid/DeviceDescriptor.ts` | Modify | Add `getDeviceLayout()` function |
| `src/main/hid/HidManager.ts` | Modify | Attach `layout` when building device info objects |
| `src/renderer/src/pages/GridPage.tsx` | Major rewrite | Layout-aware, per-device, key assign flow |
| `src/renderer/src/components/DeviceGrid/DeviceGrid.tsx` | Modify | Accept layout/events/mappings props, dynamic grid |
| `src/renderer/src/components/DeviceGrid/GridTile.tsx` | Modify | Add `mappedKey` display and click handler |

---

## Future Considerations

- If firmware ever exposes a GATT endpoint with tile layout metadata (per `HID_DEVICE.md` suggestion), `getDeviceLayout()` can be updated to fetch it dynamically instead of returning a static definition.
- For non-grid devices (e.g., linear button strips), `DeviceLayout` supports arbitrary `rows × cols` with sparse tile placement — no architectural changes needed.
- The `label` field on `TileInfo` can be extended to support custom user-defined tile labels per profile in the future.
