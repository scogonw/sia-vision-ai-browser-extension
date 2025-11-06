import crypto from 'node:crypto'
import { sessionStore } from '../services/session-store.js'

const MAX_FRAME_BYTES = 512 * 1024 // 512KB safety limit to stay within JSON body limits

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

export const getSessionById = (req, res) => {
  const sessionId = req.params.sessionId
  const includeFrame = req.query.includeFrame === 'true'
  const session = sessionStore.get(sessionId)

  if (!session) {
    return res.status(404).json({ error: 'Session not found' })
  }

  const payload = { ...session }
  if (!includeFrame && payload.screenShare?.lastFrame) {
    payload.screenShare = {
      ...payload.screenShare,
      lastFrame: undefined
    }
  }

  res.json({ session: payload })
}

export const getSessionByRoomName = (req, res) => {
  const session = sessionStore.findByRoomName(req.params.roomName)
  if (!session) {
    return res.status(404).json({ error: 'Session not found' })
  }
  res.json({ session })
}

export const uploadScreenFrame = (req, res) => {
  const sessionId = req.params.sessionId || req.body?.sessionId
  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' })
  }

  const image = req.body?.imageBase64
  if (!image) {
    return res.status(400).json({ error: 'imageBase64 is required' })
  }

  const sanitizedImage = image.startsWith('data:')
    ? image.substring(image.indexOf(',') + 1)
    : image

  let frameBuffer
  try {
    frameBuffer = Buffer.from(sanitizedImage, 'base64')
  } catch {
    return res.status(400).json({ error: 'Invalid base64 image data' })
  }

  if (frameBuffer.byteLength > MAX_FRAME_BYTES) {
    return res.status(413).json({ error: 'Frame too large' })
  }

  const digest = req.body?.digest || crypto.createHash('sha1').update(frameBuffer).digest('hex')

  const capturedAt = req.body?.capturedAt
    ? new Date(req.body.capturedAt).toISOString()
    : new Date().toISOString()

  const framePayload = {
    sessionId,
    imageBase64: sanitizedImage,
    width: Number(req.body?.width) || 0,
    height: Number(req.body?.height) || 0,
    capturedAt,
    averageColor: req.body?.averageColor || null,
    variance: typeof req.body?.variance === 'number' ? req.body.variance : null,
    byteLength: frameBuffer.byteLength,
    digest,
    source: req.body?.source || 'screen-track'
  }

  const screenShare = sessionStore.updateScreenFrame(sessionId, framePayload)

  sessionStore.upsert(sessionId, {
    sessionId,
    lastEvent: 'screen_frame',
    lastEventAt: capturedAt
  })

  res.json({ success: true, screenShare })
}

export const markScreenShareInactive = (req, res) => {
  const sessionId = req.params.sessionId || req.body?.sessionId
  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId is required' })
  }

  const screenShare = sessionStore.markScreenShareInactive(sessionId)
  if (!screenShare) {
    return res.status(404).json({ error: 'Screen share not active' })
  }

  res.json({ success: true, screenShare })
}
