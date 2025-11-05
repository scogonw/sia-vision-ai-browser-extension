import { env } from '../config/env.js'
import { logger } from '../utils/logger.js'

const sessions = new Map()

export class SessionStore {
  upsert (sessionId, payload) {
    const existing = sessions.get(sessionId) || {}
    const merged = {
      ...existing,
      ...payload,
      updatedAt: new Date().toISOString()
    }
    sessions.set(sessionId, merged)
    logger.debug({ sessionId }, 'Session updated')
    return merged
  }

  list () {
    return Array.from(sessions.values())
  }

  cleanupExpired () {
    const cutoff = Date.now() - env.sessionLogRetentionDays * 24 * 60 * 60 * 1000
    for (const [sessionId, session] of sessions.entries()) {
      if (new Date(session.updatedAt).getTime() < cutoff) {
        sessions.delete(sessionId)
      }
    }
  }
}

export const sessionStore = new SessionStore()
