import crypto from 'node:crypto'
import { sessionStore } from '../services/session-store.js'

export const upsertSessionLog = (req, res) => {
  const sessionId = req.body?.sessionId || crypto.randomUUID()
  const payload = {
    ...req.body,
    sessionId,
    user: req.user,
    lastEvent: req.body?.event || 'unknown',
    lastEventAt: new Date().toISOString()
  }

  const stored = sessionStore.upsert(sessionId, payload)
  res.json(stored)
}

export const listSessions = (req, res) => {
  res.json({ sessions: sessionStore.list() })
}
