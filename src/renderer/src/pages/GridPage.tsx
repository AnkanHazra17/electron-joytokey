import { useState, useEffect } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useDevices } from '../hooks/useDevices'
import { useProfiles } from '../hooks/useProfiles'
import { useJoystickEvents } from '../hooks/useJoystickEvents'
import { useUiStore } from '../store/uiStore'
import { DeviceGrid, resetLayoutOrder } from '../components/DeviceGrid/DeviceGrid'
import { KeyAssignModal } from '../components/KeyAssignModal'
import type { InputTrigger, MappedAction, Mapping } from '@shared/types'

export function GridPage() {
  const { devices } = useDevices()
  const { profiles, activeProfileId, save } = useProfiles()
  const { selectedDevicePath, setSelectedDevice } = useUiStore()
  const [assigningButton, setAssigningButton] = useState<number | null>(null)
  const [editMode, setEditMode] = useState(false)
  const [resetToken, setResetToken] = useState(0)

  // Auto-pick the first open device if nothing is explicitly selected
  const effectivePath = selectedDevicePath ?? devices.find((d) => d.isOpen)?.path ?? null

  useEffect(() => {
    if (!selectedDevicePath && effectivePath) {
      setSelectedDevice(effectivePath)
    }
  }, [effectivePath, selectedDevicePath, setSelectedDevice])

  const { events } = useJoystickEvents(effectivePath)
  const selectedDevice = devices.find((d) => d.path === effectivePath)
  const layout = selectedDevice?.layout
  const hasConnected = !!selectedDevice?.isOpen
  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? null

  const deviceKey = selectedDevice
    ? `${selectedDevice.vendorId}:${selectedDevice.productId}`
    : null

  const handleTileClick = (buttonIndex: number) => {
    if (!activeProfile) return
    setAssigningButton(buttonIndex)
  }

  const handleSave = async (action: MappedAction) => {
    if (!activeProfile || assigningButton === null) return
    const trigger: InputTrigger = { type: 'button', index: assigningButton, condition: 'held' }
    const existing = activeProfile.mappings.find(
      (m) => m.trigger.type === 'button' && m.trigger.index === assigningButton
    )
    const updatedMappings: Mapping[] = existing
      ? activeProfile.mappings.map((m) =>
          m.id === existing.id ? { ...m, action, trigger } : m
        )
      : [...activeProfile.mappings, { id: uuidv4(), trigger, action, enabled: true }]
    await save({ ...activeProfile, mappings: updatedMappings, updatedAt: Date.now() })
    setAssigningButton(null)
  }

  const handleReset = () => {
    if (!deviceKey || !layout) return
    resetLayoutOrder(deviceKey, layout.tiles.length)
    setResetToken((t) => t + 1)
  }

  const assignTrigger: InputTrigger | null =
    assigningButton !== null
      ? { type: 'button', index: assigningButton, condition: 'held' }
      : null

  return (
    <div className="flex flex-col items-center gap-6 p-6">
      {/* Header */}
      <div className="w-full flex items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Key Mapping</h2>
        <div className="flex items-center gap-2">
          {layout && hasConnected && editMode && (
            <button
              onClick={handleReset}
              className="text-xs px-2 py-0.5 rounded-md border border-(--border) text-(--text-muted) hover:text-(--danger) hover:border-(--danger)/40 transition-colors"
            >
              Reset
            </button>
          )}
          {layout && hasConnected && (
            <button
              onClick={() => setEditMode((e) => !e)}
              className={`text-xs px-2.5 py-0.5 rounded-full border transition-colors ${
                editMode
                  ? 'bg-(--accent)/15 border-(--accent)/40 text-(--accent)'
                  : 'border-(--border) text-(--text-muted) hover:text-(--text) hover:border-(--accent)/40'
              }`}
            >
              {editMode ? 'Done' : 'Edit Layout'}
            </button>
          )}
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              hasConnected
                ? 'bg-(--success)/15 text-(--success)'
                : 'bg-(--border) text-(--text-muted)'
            }`}
          >
            {hasConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Body */}
      {!selectedDevice || !hasConnected ? (
        <p className="text-xs text-(--text-muted) mt-8">
          Connect your device from the Devices tab to see the layout.
        </p>
      ) : !layout || !deviceKey ? (
        <p className="text-xs text-(--text-muted) mt-8">
          No layout available for this device type.
        </p>
      ) : (
        <>
          <DeviceGrid
            key={resetToken}
            layout={layout}
            events={events}
            mappings={activeProfile?.mappings ?? []}
            connected={hasConnected}
            editMode={editMode}
            deviceKey={deviceKey}
            onTileClick={handleTileClick}
            onResetLayout={handleReset}
          />
          <p className="text-xs text-(--text-muted)">
            {editMode
              ? 'Drag tiles to rearrange the layout. Click Done when finished.'
              : activeProfile
                ? 'Press a tile to see it glow. Click a tile to assign a key.'
                : 'Select a profile on the Profiles tab to assign keys to tiles.'}
          </p>
        </>
      )}

      <KeyAssignModal
        open={assigningButton !== null}
        trigger={assignTrigger}
        onClose={() => setAssigningButton(null)}
        onSave={handleSave}
      />
    </div>
  )
}
