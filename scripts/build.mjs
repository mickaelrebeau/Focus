import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const service = process.env.RAILWAY_SERVICE_NAME

if (service === 'worker') {
  console.log('[build] Service worker — build Nuxt ignoré')
  process.exit(0)
}

console.log('[build] Build Nuxt production...')
const nuxtBin = join(root, 'node_modules/nuxt/bin/nuxt.mjs')
const result = spawnSync(process.execPath, [nuxtBin, 'build'], {
  stdio: 'inherit',
  cwd: root,
})
process.exit(result.status ?? 1)
