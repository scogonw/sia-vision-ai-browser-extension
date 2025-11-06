import { Router } from 'express'
import { getClientConfig } from '../controllers/config-controller.js'
import { createLiveKitToken } from '../controllers/token-controller.js'
import {
  getSessionById,
  getSessionByRoomName,
  listSessions,
  markScreenShareInactive,
  upsertSessionLog,
  uploadScreenFrame
} from '../controllers/session-controller.js'
import { submitFeedback } from '../controllers/feedback-controller.js'
import { getHealth } from '../controllers/health-controller.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.get('/health', getHealth)
router.get('/config', getClientConfig)
router.post('/token/livekit', authenticate, createLiveKitToken)
router.post('/session/log', authenticate, upsertSessionLog)
router.get('/session', authenticate, listSessions)
router.get('/session/:sessionId', authenticate, getSessionById)
router.get('/session/by-room/:roomName', authenticate, getSessionByRoomName)
router.post('/session/:sessionId/screen-frame', authenticate, uploadScreenFrame)
router.delete('/session/:sessionId/screen-frame', authenticate, markScreenShareInactive)
router.post('/feedback', authenticate, submitFeedback)

export default router
