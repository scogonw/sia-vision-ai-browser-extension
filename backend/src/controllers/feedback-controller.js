import { sessionStore } from '../services/session-store.js'

export const submitFeedback = (req, res) => {
  const { sessionId, rating, comment } = req.body || {}
  if (!sessionId || typeof rating !== 'number') {
    return res.status(400).json({ error: 'sessionId and numeric rating are required' })
  }

  const session = sessionStore.upsert(sessionId, {
    feedback: {
      rating,
      comment: comment || null,
      submittedAt: new Date().toISOString()
    }
  })

  res.json(session)
}
