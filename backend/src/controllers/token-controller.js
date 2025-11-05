import crypto from 'node:crypto'
import { liveKitService } from '../services/livekit-service.js'
import { sessionStore } from '../services/session-store.js'

export const createLiveKitToken = (req, res) => {
  const user = req.user
  const sessionId = req.body?.sessionId || crypto.randomUUID()
  const organizationId = req.body?.organizationId || 'default'

  const roomName = liveKitService.createRoomName(organizationId, user.sub)
  const token = liveKitService.generateToken({
    identity: user.email,
    name: user.name,
    metadata: {
      userId: user.sub,
      email: user.email,
      sessionId
    },
    roomName
  })

  const now = new Date().toISOString()
  sessionStore.upsert(sessionId, {
    sessionId,
    roomName,
    user,
    organizationId,
    createdAt: now
  })

  res.json({
    token,
    roomName,
    host: liveKitService.host,
    sessionId,
    expiresAt: new Date(Date.now() + liveKitService.tokenTtlSeconds * 1000).toISOString()
  })
}
