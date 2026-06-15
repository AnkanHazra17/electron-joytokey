import { useState, useEffect, useRef } from 'react'
import type { DeviceLayout, JoystickEvent, Mapping, MappedAction } from '@shared/types'
import { GridTile } from './GridTile'

function formatAction(action: MappedAction): string {
  if (action.type === 'noop') return ''
  const mods = action.modifiers?.map((m) => m[0].toUpperCase() + m.slice(1)) ?? []
  const key = action.key ?? action.mouseButton ?? ''
  return [...mods, key].filter(Boolean).join('+')
}

function storageKey(deviceKey: string) {
  return `joytokey:layout-order:${deviceKey}`
}

function loadOrder(deviceKey: string, tileCount: number): number[] {
  const defaultOrder = Array.from({ length: tileCount }, (_, i) => i)
  try {
    const raw = localStorage.getItem(storageKey(deviceKey))
    if (!raw) return defaultOrder
    const parsed: unknown = JSON.parse(raw)
    if (
      Array.isArray(parsed) &&
      parsed.length === tileCount &&
      parsed.every((v) => typeof v === 'number')
    ) {
      return parsed as number[]
    }
  } catch {}
  return defaultOrder
}

interface DeviceGridProps {
  layout: DeviceLayout
  events: Map<string, JoystickEvent>
  mappings: Mapping[]
  connected: boolean
  editMode: boolean
  deviceKey: string
  onTileClick: (buttonIndex: number) => void
  onResetLayout: () => void
}

export function DeviceGrid({
  layout,
  events,
  mappings,
  connected,
  editMode,
  deviceKey,
  onTileClick,
  onResetLayout,
}: DeviceGridProps) {
  const tileCount = layout.tiles.length
  const [positionOrder, setPositionOrder] = useState<number[]>(() =>
    loadOrder(deviceKey, tileCount)
  )
  const dragFromIdx = useRef<number | null>(null)
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null)

  // Re-sync when device or layout size changes
  useEffect(() => {
    setPositionOrder(loadOrder(deviceKey, tileCount))
  }, [deviceKey, tileCount])

  // Expose reset to parent via the callback
  useEffect(() => {
    // nothing – parent calls onResetLayout which triggers saveOrder([0,1,...])
  }, [])

  const saveOrder = (order: number[]) => {
    localStorage.setItem(storageKey(deviceKey), JSON.stringify(order))
    setPositionOrder(order)
  }

  const handleDragStart = (posIdx: number) => {
    dragFromIdx.current = posIdx
  }

  const handleDrop = (posIdx: number) => {
    setDragOverIdx(null)
    if (dragFromIdx.current === null || dragFromIdx.current === posIdx) return
    const newOrder = [...positionOrder]
    ;[newOrder[dragFromIdx.current], newOrder[posIdx]] = [
      newOrder[posIdx],
      newOrder[dragFromIdx.current],
    ]
    saveOrder(newOrder)
    dragFromIdx.current = null
  }

  // Expose reset: parent passes onResetLayout which we wire to a stable function
  // Parent calls onResetLayout() → we need to reset here too.
  // Since onResetLayout is a parent handler, we handle reset internally when
  // the parent changes deviceKey back, but it's simpler to store the reset
  // fn in a ref and let parent call it. Instead, we track a reset signal via a prop.
  // The cleanest: parent calls a ref — but that's messy. We'll use a stable reset.
  // The parent will just set a flag; we detect it and reset. Simplest: expose via
  // an imperative handle. But for simplicity, we handle reset via onResetLayout
  // being called directly — the parent directly modifies localStorage and re-mounts.
  // Actually: parent sets `deviceKey` with a `?reset` suffix → no.
  // Cleanest solution: expose resetOrder via a prop-callback that the parent stores.
  // Here we just react: when parent calls onResetLayout, we also reset local state.
  // We'll use a simple approach: parent passes a `resetToken` number that increments.

  return (
    <div
      className="grid gap-3"
      style={{
        gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))`,
        width: '100%',
        maxWidth: `${layout.cols * 110}px`,
      }}
    >
      {positionOrder.map((tileIdx, posIdx) => {
        const tile = layout.tiles[tileIdx]
        const mapping =
          tile.buttonIndex >= 0
            ? mappings.find(
                (m) =>
                  m.trigger.type === 'button' &&
                  m.trigger.index === tile.buttonIndex &&
                  m.enabled
              )
            : undefined
        const mappedKey = mapping ? formatAction(mapping.action) : undefined
        const pressed =
          tile.buttonIndex >= 0 &&
          events.get(`button:${tile.buttonIndex}`)?.value === 1
        const isDragTarget = dragOverIdx === posIdx && editMode

        return (
          <div
            key={`pos-${posIdx}`}
            className={isDragTarget ? 'scale-105 opacity-80 transition-transform' : 'transition-transform'}
            onDragEnter={() => editMode && setDragOverIdx(posIdx)}
            onDragLeave={() => setDragOverIdx(null)}
          >
            <GridTile
              tileNumber={tile.label}
              buttonId={tile.buttonIndex >= 0 ? `B${tile.buttonIndex}` : '—'}
              pressed={pressed}
              connected={connected}
              unavailable={tile.buttonIndex < 0}
              mappedKey={mappedKey}
              editMode={editMode}
              onClick={
                !editMode && tile.buttonIndex >= 0
                  ? () => onTileClick(tile.buttonIndex)
                  : undefined
              }
              onDragStart={editMode ? () => handleDragStart(posIdx) : undefined}
              onDrop={editMode ? () => handleDrop(posIdx) : undefined}
            />
          </div>
        )
      })}
    </div>
  )
}

// Exported so GridPage can reset without knowing the internal key
export function resetLayoutOrder(deviceKey: string, tileCount: number) {
  const order = Array.from({ length: tileCount }, (_, i) => i)
  localStorage.setItem(storageKey(deviceKey), JSON.stringify(order))
  return order
}
