import { spawn, ChildProcessWithoutNullStreams } from 'child_process'
import { resolve, join } from 'path'
import { app } from 'electron'
import type { MappedAction } from '@shared/types'
import log from '../logger'

let cgkeyProc: ChildProcessWithoutNullStreams | null = null

function getCgkeyPath(): string {
  if (app.isPackaged) {
    // In packaged app, resources are in process.resourcesPath
    return join(process.resourcesPath, 'cgkey')
  }
  return resolve(__dirname, '../../../resources/cgkey')
}

function ensureProc(): ChildProcessWithoutNullStreams {
  if (cgkeyProc && !cgkeyProc.killed) return cgkeyProc

  const bin = getCgkeyPath()
  cgkeyProc = spawn(bin, [], { stdio: ['pipe', 'pipe', 'pipe'] })

  cgkeyProc.on('error', (err) => log.error('[ActionExecutor] cgkey error:', err.message))
  cgkeyProc.on('exit', (code) => {
    log.warn(`[ActionExecutor] cgkey exited with code ${code}`)
    cgkeyProc = null
  })
  cgkeyProc.stderr.on('data', (d: Buffer) => log.warn('[cgkey]', d.toString().trim()))

  return cgkeyProc
}

function send(cmd: string): void {
  try {
    ensureProc().stdin.write(cmd + '\n')
  } catch (err) {
    log.error('[ActionExecutor] send failed:', err)
  }
}

export function execute(action: MappedAction, down: boolean): void {
  if (action.type === 'noop') return

  const mods = action.modifiers?.join(' ') ?? ''

  if (action.type === 'mouseButton') {
    if (down) send(`mouseclick ${action.mouseButton ?? 'left'}`)
    return
  }

  const key = action.key
  if (!key) return

  if (action.toggle) {
    send(down ? `keydown ${key} ${mods}`.trim() : `keyup ${key} ${mods}`.trim())
  } else {
    if (down) send(`keypress ${key} ${mods}`.trim())
  }
}

export function shutdownCgkey(): void {
  if (cgkeyProc && !cgkeyProc.killed) {
    cgkeyProc.stdin.end()
    cgkeyProc.kill()
    cgkeyProc = null
  }
}
