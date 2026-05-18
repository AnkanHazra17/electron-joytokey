import activeWin from 'active-win'
import { ACTIVE_WIN_POLL_MS } from '@shared/constants'
import type { Profile } from '@shared/types'
import log from '../logger'

type OnMatchFn = (profileId: string) => void

export class ProfileMatcher {
  private timer: ReturnType<typeof setInterval> | null = null
  private lastBundleId: string | null = null

  start(getProfiles: () => Profile[], onMatch: OnMatchFn): void {
    this.timer = setInterval(async () => {
      try {
        const win = await activeWin()
        const owner = win?.owner as { bundleId?: string } | undefined
        const bundleId = owner?.bundleId ?? null
        if (bundleId === this.lastBundleId) return
        this.lastBundleId = bundleId

        if (!bundleId) return
        const profiles = getProfiles()
        const match = profiles.find((p) => p.appBundleId === bundleId)
        if (match) {
          log.info(`[ProfileMatcher] auto-activating profile "${match.name}" for ${bundleId}`)
          onMatch(match.id)
        }
      } catch { /* Accessibility permission not granted */ }
    }, ACTIVE_WIN_POLL_MS)
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
  }
}

export const profileMatcher = new ProfileMatcher()
