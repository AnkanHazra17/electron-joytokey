#!/usr/bin/env node
import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const electronPkg = JSON.parse(readFileSync(resolve(root, 'node_modules/electron/package.json'), 'utf8'))
const electronVersion = electronPkg.version
console.log(`[abi-check] electron version: ${electronVersion}`)

const cacheFile = resolve(root, '.rebuild-cache')
if (!existsSync(cacheFile)) {
  console.error('[abi-check] FAIL: .rebuild-cache not found — run `npm run rebuild` first')
  process.exit(1)
}

const cache = JSON.parse(readFileSync(cacheFile, 'utf8'))
if (cache.electronVersion !== electronVersion) {
  console.error(`[abi-check] FAIL: natives were built for electron@${cache.electronVersion} but current is @${electronVersion}`)
  console.error('[abi-check] Run `npm run rebuild` to fix this.')
  process.exit(1)
}

console.log('[abi-check] ABI version matches ✓')
