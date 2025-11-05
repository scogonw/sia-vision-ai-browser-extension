import { build } from 'esbuild'
import { readFileSync, writeFileSync, mkdirSync, cpSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import dotenv from 'dotenv'
import { ensureIcons } from './generate-icons.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const rootEnv = dotenv.config({ path: join(__dirname, '../../.env') })
if (rootEnv.error) {
  dotenv.config({ path: join(__dirname, '../../.env.example') })
}

const env = process.env

const outdir = join(__dirname, '../dist')
mkdirSync(outdir, { recursive: true })
mkdirSync(join(outdir, 'popup'), { recursive: true })

ensureIcons()

const define = {}
const exposedEnvKeys = [
  'BACKEND_BASE_URL',
  'GOOGLE_OAUTH_CLIENT_ID',
  'GOOGLE_OAUTH_REDIRECT_URI'
]

for (const key of exposedEnvKeys) {
  define[`process.env.${key}`] = JSON.stringify(env[key] || '')
}

await build({
  entryPoints: {
    'background.js': join(__dirname, '../src/background/index.js'),
    'popup/popup.js': join(__dirname, '../src/popup/popup.js')
  },
  bundle: true,
  format: 'esm',
  outdir,
  sourcemap: true,
  target: ['chrome110'],
  loader: {
    '.css': 'text'
  },
  define
})

const manifest = JSON.parse(readFileSync(join(__dirname, '../src/manifest.json'), 'utf-8'))
if (manifest.oauth2 && env.GOOGLE_OAUTH_CLIENT_ID) {
  manifest.oauth2.client_id = env.GOOGLE_OAUTH_CLIENT_ID
}
if (manifest.host_permissions && env.BACKEND_BASE_URL) {
  try {
    const backendUrl = new URL(env.BACKEND_BASE_URL)
    const pattern = `${backendUrl.protocol}//${backendUrl.host}/*`
    if (!manifest.host_permissions.includes(pattern)) {
      manifest.host_permissions.push(pattern)
    }
  } catch (error) {
    console.warn('Invalid BACKEND_BASE_URL for host permissions', error)
  }
}
writeFileSync(join(outdir, 'manifest.json'), JSON.stringify(manifest, null, 2))
cpSync(join(__dirname, '../src/popup/popup.html'), join(outdir, 'popup/popup.html'))
cpSync(join(__dirname, '../src/popup/popup.css'), join(outdir, 'popup/popup.css'))

// Copy public assets
try {
  cpSync(join(__dirname, '../public'), outdir, { recursive: true })
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}

console.log('Extension build complete. Load extension/dist in Chrome.')
