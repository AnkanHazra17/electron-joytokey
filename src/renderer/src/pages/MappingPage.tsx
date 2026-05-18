import { useState } from 'react'
import { v4 as uuidv4 } from 'uuid'
import { useUiStore } from '../store/uiStore'
import { useProfiles } from '../hooks/useProfiles'
import { useJoystickEvents } from '../hooks/useJoystickEvents'
import { ButtonMap } from '../components/ButtonMap/ButtonMap'
import { KeyAssignModal } from '../components/KeyAssignModal'
import type { InputTrigger, MappedAction, Profile } from '@shared/types'

export function MappingPage() {
  const selectedDevicePath = useUiStore((s) => s.selectedDevicePath)
  const { profiles, activeProfileId, save } = useProfiles()
  const { events } = useJoystickEvents(selectedDevicePath)

  const [assignTrigger, setAssignTrigger] = useState<InputTrigger | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? null

  const handleCellClick = (type: 'button' | 'axis' | 'hat', index: number) => {
    setAssignTrigger({ type, index, condition: type === 'axis' ? 'threshold' : 'press' })
    setModalOpen(true)
  }

  const handleSave = async (action: MappedAction) => {
    if (!activeProfile || !assignTrigger) return
    const updated: Profile = {
      ...activeProfile,
      mappings: [
        ...activeProfile.mappings.filter(
          (m) => !(m.trigger.type === assignTrigger.type && m.trigger.index === assignTrigger.index)
        ),
        { id: uuidv4(), trigger: assignTrigger, action, enabled: true },
      ],
    }
    await save(updated)
  }

  if (!activeProfile) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 h-full text-[var(--text-muted)]">
        <p className="text-sm">No active profile selected.</p>
        <p className="text-xs">Go to Profiles to create or activate one.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 p-6 overflow-y-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Mapping — {activeProfile.name}</h2>
        {!selectedDevicePath && (
          <p className="text-xs text-[var(--warning)]">No device connected — connect one in Devices</p>
        )}
      </div>

      <ButtonMap
        profile={activeProfile}
        events={events}
        onCellClick={handleCellClick}
      />

      <KeyAssignModal
        open={modalOpen}
        trigger={assignTrigger}
        onClose={() => { setModalOpen(false); setAssignTrigger(null) }}
        onSave={handleSave}
      />
    </div>
  )
}
