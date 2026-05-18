#!/usr/bin/env node
import { notarize } from '@electron/notarize'

export default async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context
  if (electronPlatformName !== 'darwin') return
  if (!process.env.APPLE_ID) {
    console.log('[notarize] APPLE_ID not set — skipping notarization')
    return
  }

  const appName = context.packager.appInfo.productFilename
  const appPath = `${appOutDir}/${appName}.app`

  console.log(`[notarize] notarizing ${appPath}…`)
  await notarize({
    tool: 'notarytool',
    appPath,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID
  })
  console.log('[notarize] done ✓')
}
