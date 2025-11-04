import express from 'express';
import { TokenService } from '../services/token-service.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();
const tokenService = new TokenService();

/**
 * POST /api/v1/token
 * Generate a LiveKit access token for a user
 */
router.post('/token', authMiddleware, async (req, res, next) => {
  try {
    const { userId, sessionType } = req.body;

    if (!userId) {
      return res.status(400).json({
        error: 'userId is required'
      });
    }

    // Generate token
    const tokenData = await tokenService.generateToken({
      userId: userId,
      sessionType: sessionType || 'it-support',
      metadata: req.body.metadata || {}
    });

    res.json(tokenData);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/session/log
 * Log session events
 */
router.post('/session/log', authMiddleware, async (req, res, next) => {
  try {
    const { sessionId, eventType, data } = req.body;

    if (!sessionId || !eventType) {
      return res.status(400).json({
        error: 'sessionId and eventType are required'
      });
    }

    // In production, store this in a database
    console.log('Session event:', {
      sessionId,
      eventType,
      data,
      timestamp: new Date().toISOString()
    });

    res.json({
      success: true,
      message: 'Event logged successfully'
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/session/:sessionId
 * Get session information
 */
router.get('/session/:sessionId', authMiddleware, async (req, res, next) => {
  try {
    const { sessionId } = req.params;

    // In production, retrieve from database
    res.json({
      sessionId,
      status: 'active',
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    next(error);
  }
});

export default router;
