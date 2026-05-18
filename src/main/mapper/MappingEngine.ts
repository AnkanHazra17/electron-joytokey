import { EventEmitter } from 'events'
import type { JoystickEvent, Mapping, Profile } from '@shared/types'
import { HAT_CENTERED, AXIS_NEUTRAL } from '@shared/constants'
import { applyDeadZone } from './DeadZoneFilter'
import { execute } from './ActionExecutor'
import log from '../logger'

export class MappingEngine extends EventEmitter {
  private activeProfile: Profile | null = null
  private enabled = true
  // Track button held state for press/release discrimination
  private buttonState = new Map<string, boolean>()
  // Axis hysteresis: true when axis is "above" threshold (to avoid re-firing)
  private axisTriggered = new Map<string, boolean>()

  setActiveProfile(profile: Profile | null): void {
    this.activeProfile = profile
    this.buttonState.clear()
    this.axisTriggered.clear()
    log.info(`[MappingEngine] active profile: ${profile?.name ?? 'none'}`)
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
    if (!enabled) {
      // Release all held keys
      this.buttonState.forEach((held, key) => {
        if (held) {
          const mapping = this.findHeldMapping(key)
          if (mapping?.action.toggle) execute(mapping.action, false)
        }
      })
      this.buttonState.clear()
    }
    log.info(`[MappingEngine] ${enabled ? 'enabled' : 'disabled'}`)
  }

  isEnabled(): boolean { return this.enabled }

  processEvent(raw: JoystickEvent): void {
    this.emit('input:event', raw)
    if (!this.enabled || !this.activeProfile) return

    const evt = applyDeadZone(raw, this.activeProfile.deadZones)

    for (const mapping of this.activeProfile.mappings) {
      if (!mapping.enabled) continue
      if (mapping.trigger.type !== evt.type) continue
      if (mapping.trigger.index !== evt.index) continue
      this.evaluate(mapping, evt)
    }
  }

  private evaluate(mapping: Mapping, evt: JoystickEvent): void {
    const { trigger, action } = mapping
    const stateKey = `${evt.type}:${evt.index}`

    if (evt.type === 'button') {
      const isDown = evt.value === 1
      const wasDown = this.buttonState.get(stateKey) ?? false

      if (trigger.condition === 'press' && isDown && !wasDown) {
        execute(action, true)
      } else if (trigger.condition === 'release' && !isDown && wasDown) {
        execute(action, true)
      } else if (trigger.condition === 'held') {
        if (isDown !== wasDown) execute(action, isDown)
      }

      this.buttonState.set(stateKey, isDown)
    }

    if (evt.type === 'axis' && trigger.condition === 'threshold') {
      const threshold = trigger.threshold ?? 0.8
      const dir = trigger.thresholdDir ?? 'above'
      const isTriggered =
        dir === 'above' ? evt.value >= threshold : evt.value <= threshold
      const wasTriggered = this.axisTriggered.get(stateKey) ?? false

      if (isTriggered && !wasTriggered) execute(action, true)
      else if (!isTriggered && wasTriggered) execute(action, false)

      this.axisTriggered.set(stateKey, isTriggered)
    }

    if (evt.type === 'hat' && trigger.hatDir !== undefined) {
      const isActive = evt.value !== HAT_CENTERED && evt.value === trigger.hatDir
      const wasActive = this.buttonState.get(stateKey + `:h${trigger.hatDir}`) ?? false

      if (trigger.condition === 'press' && isActive && !wasActive) execute(action, true)
      else if (trigger.condition === 'release' && !isActive && wasActive) execute(action, true)
      else if (trigger.condition === 'held' && isActive !== wasActive) execute(action, isActive)

      this.buttonState.set(stateKey + `:h${trigger.hatDir}`, isActive)
    }
  }

  private findHeldMapping(stateKey: string): Mapping | undefined {
    if (!this.activeProfile) return undefined
    const [type, idxStr] = stateKey.split(':')
    const index = Number(idxStr)
    return this.activeProfile.mappings.find(
      (m) => m.trigger.type === type && m.trigger.index === index && m.action.toggle
    )
  }
}

export const mappingEngine = new MappingEngine()
