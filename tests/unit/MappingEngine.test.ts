import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock electron-log before any imports that pull it in
vi.mock('../../src/main/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

import { MappingEngine } from '../../src/main/mapper/MappingEngine'
import type { Profile, JoystickEvent } from '../../src/shared/types'

// Mock ActionExecutor
vi.mock('../../src/main/mapper/ActionExecutor', () => ({
  execute: vi.fn(),
}))

import { execute } from '../../src/main/mapper/ActionExecutor'

const mockProfile: Profile = {
  id: 'p1',
  name: 'Test',
  mappings: [
    {
      id: 'm1',
      trigger: { type: 'button', index: 0, condition: 'press' },
      action: { type: 'key', key: 'space' },
      enabled: true,
    },
    {
      id: 'm2',
      trigger: { type: 'button', index: 1, condition: 'held' },
      action: { type: 'key', key: 'w', toggle: true },
      enabled: true,
    },
    {
      id: 'm3',
      trigger: { type: 'axis', index: 0, condition: 'threshold', threshold: 0.8, thresholdDir: 'above' },
      action: { type: 'key', key: 'right' },
      enabled: true,
    },
  ],
  deadZones: {},
  axisCount: 4,
  buttonCount: 8,
  createdAt: 0,
  updatedAt: 0,
}

const btn = (index: number, value: 0 | 1): JoystickEvent => ({
  devicePath: '/test', type: 'button', index, value, rawValue: value, timestamp: 0,
})

const axis = (index: number, value: number): JoystickEvent => ({
  devicePath: '/test', type: 'axis', index, value, rawValue: 0, timestamp: 0,
})

describe('MappingEngine', () => {
  let engine: MappingEngine

  beforeEach(() => {
    engine = new MappingEngine()
    engine.setActiveProfile(mockProfile)
    vi.mocked(execute).mockClear()
  })

  it('fires key press on button press', () => {
    engine.processEvent(btn(0, 1))
    expect(execute).toHaveBeenCalledWith({ type: 'key', key: 'space' }, true)
  })

  it('does not fire on repeated press without release', () => {
    engine.processEvent(btn(0, 1))
    engine.processEvent(btn(0, 1))
    expect(execute).toHaveBeenCalledTimes(1)
  })

  it('fires keydown/keyup for held mapping', () => {
    engine.processEvent(btn(1, 1))
    engine.processEvent(btn(1, 0))
    expect(execute).toHaveBeenNthCalledWith(1, expect.objectContaining({ key: 'w' }), true)
    expect(execute).toHaveBeenNthCalledWith(2, expect.objectContaining({ key: 'w' }), false)
  })

  it('fires on axis threshold crossing', () => {
    engine.processEvent(axis(0, 0.9))
    expect(execute).toHaveBeenCalledWith(expect.objectContaining({ key: 'right' }), true)
  })

  it('fires off when axis falls below threshold', () => {
    engine.processEvent(axis(0, 0.9))
    engine.processEvent(axis(0, 0.5))
    expect(execute).toHaveBeenCalledTimes(2)
    expect(execute).toHaveBeenNthCalledWith(2, expect.objectContaining({ key: 'right' }), false)
  })

  it('does not fire when disabled', () => {
    engine.setEnabled(false)
    engine.processEvent(btn(0, 1))
    expect(execute).not.toHaveBeenCalled()
  })

  it('skips disabled mappings', () => {
    const profile: Profile = {
      ...mockProfile,
      mappings: [{ ...mockProfile.mappings[0], enabled: false }],
    }
    engine.setActiveProfile(profile)
    engine.processEvent(btn(0, 1))
    expect(execute).not.toHaveBeenCalled()
  })
})
