#!/usr/bin/env node
/**
 * Verifies native module prebuilt binaries are in place for Electron.
 * node-hid ships NAPI prebuilts — no recompilation needed (NAPI is ABI-stable).
 * Writes a .rebuild-cache file so this check is skipped on subsequent installs.
 */
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const electronPkgPath = resolve(root, 'node_modules/electron/package.json')
if (!existsSync(electronPkgPath)) {
  console.log('[rebuild] electron not installed yet — skipping check')
  process.exit(0)
}

const electronVersion = JSON.parse(readFileSync(electronPkgPath, 'utf8')).version
const cacheFile = resolve(root, '.rebuild-cache')

if (existsSync(cacheFile)) {
  const cache = JSON.parse(readFileSync(cacheFile, 'utf8'))
  if (cache.electronVersion === electronVersion) {
    console.log(`[rebuild] already verified for electron@${electronVersion} — skipping`)
    process.exit(0)
  }
}

// Verify node-hid NAPI prebuilt exists (darwin-arm64 or darwin-x64)
const arch = process.arch
const prebuiltPath = resolve(root, `node_modules/node-hid/prebuilds/HID-darwin-${arch}/node-napi-v4.node`)
if (!existsSync(prebuiltPath)) {
  console.error(`[rebuild] node-hid prebuilt not found at ${prebuiltPath}`)
  process.exit(1)
}

console.log(`[rebuild] node-hid NAPI prebuilt present for darwin-${arch} ✓`)
writeFileSync(cacheFile, JSON.stringify({ electronVersion, arch, verifiedAt: Date.now() }))
console.log('[rebuild] done ✓')
