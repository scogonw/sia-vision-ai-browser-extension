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

  get (sessionId) {
    return sessions.get(sessionId) || null
  }

  list () {
    return Array.from(sessions.values())
  }

  findByRoomName (roomName) {
    if (!roomName) return null
    for (const session of sessions.values()) {
      if (session.roomName === roomName) {
        return session
      }
    }
    return null
  }

  updateScreenFrame (sessionId, framePayload) {
    const existing = sessions.get(sessionId) || {}
    const screenShare = {
      active: true,
      framesReceived: (existing.screenShare?.framesReceived || 0) + 1,
      lastFrameAt: framePayload.capturedAt,
      lastFrameDigest: framePayload.digest,
      lastFrameSummary: {
        width: framePayload.width,
        height: framePayload.height,
        approxBytes: framePayload.byteLength,
        averageColor: framePayload.averageColor,
        variance: framePayload.variance,
        source: framePayload.source || 'screen-track'
      },
      lastFrame: framePayload.imageBase64
    }

    const merged = {
      ...existing,
      screenShare,
      updatedAt: new Date().toISOString()
    }

    sessions.set(sessionId, merged)
    logger.debug({ sessionId }, 'Session screen frame updated')
    return screenShare
  }

  markScreenShareInactive (sessionId) {
    const existing = sessions.get(sessionId)
    if (!existing || !existing.screenShare?.active) {
      return null
    }

    const merged = {
      ...existing,
      screenShare: {
        ...existing.screenShare,
        active: false,
        lastFrameAt: existing.screenShare.lastFrameAt,
        inactiveAt: new Date().toISOString()
      },
      updatedAt: new Date().toISOString()
    }

    sessions.set(sessionId, merged)
    logger.debug({ sessionId }, 'Session screen share marked inactive')
    return merged.screenShare
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
