import { env } from '../config/env.js'
import { sessionStore } from '../services/session-store.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Get version from package.json
const getVersion = () => {
  try {
    const packagePath = path.join(__dirname, '../../package.json')
    const packageData = JSON.parse(fs.readFileSync(packagePath, 'utf8'))
    return packageData.version || 'unknown'
  } catch {
    return 'unknown'
  }
}

export const getHealth = (req, res) => {
  // Get session store size
  const sessions = sessionStore.list()

  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: env.nodeEnv,
    version: getVersion(),
    uptime: process.uptime(),
    services: {
      livekit: {
        configured: !!(env.livekit.apiKey && env.livekit.apiSecret),
        host: env.livekit.host
      },
      storage: {
        sessions: sessions.length
      }
    }
  }

  res.json(health)
}