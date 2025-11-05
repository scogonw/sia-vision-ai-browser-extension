import { Router } from 'express'
import { getClientConfig } from '../controllers/config-controller.js'
import { createLiveKitToken } from '../controllers/token-controller.js'
import { listSessions, upsertSessionLog } from '../controllers/session-controller.js'
import { submitFeedback } from '../controllers/feedback-controller.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.get('/config', getClientConfig)
router.post('/token/livekit', authenticate, createLiveKitToken)
router.post('/session/log', authenticate, upsertSessionLog)
router.get('/session', authenticate, listSessions)
router.post('/feedback', authenticate, submitFeedback)

export default router
