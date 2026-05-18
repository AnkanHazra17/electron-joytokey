import { useEffect, useRef, useState } from 'react'
import { IPC_CHANNELS } from '@shared/ipcChannels'
import type { JoystickEvent } from '@shared/types'

export function useJoystickEvents(devicePath: string | null) {
  // Map of `type:index` → latest JoystickEvent (no re-render on every event)
  const stateRef = useRef<Map<string, JoystickEvent>>(new Map())
  const [tick, setTick] = useState(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const unsub = window.joytokey.on(IPC_CHANNELS.INPUT_EVENT, (raw) => {
      const evt = raw as JoystickEvent
      if (devicePath && evt.devicePath !== devicePath) return
      stateRef.current.set(`${evt.type}:${evt.index}`, evt)

      // Throttle renders to 30 fps
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = null
          setTick((t) => t + 1)
        })
      }
    })
    return () => {
      unsub()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [devicePath])

  return { events: stateRef.current, tick }
}
