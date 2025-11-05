import fetch from 'node-fetch'
import { env } from '../config/env.js'
import { logger } from '../utils/logger.js'

const DEV_USER = {
  email: 'developer@example.com',
  name: 'Local Developer',
  sub: 'dev-user'
}

export const authenticate = async (req, res, next) => {
  try {
    const authorization = req.headers.authorization || ''
    const token = authorization.startsWith('Bearer ')
      ? authorization.replace('Bearer ', '')
      : null

    if (!token) {
      return res.status(401).json({ error: 'Missing bearer token' })
    }

    if (env.allowDevTokens && token === 'dev-token') {
      req.user = DEV_USER
      return next()
    }

    const response = await fetch(`${env.googleTokenInfoUrl}?access_token=${token}`)
    if (!response.ok) {
      logger.warn({ status: response.status }, 'Failed to validate Google token')
      return res.status(401).json({ error: 'Invalid authentication token' })
    }

    const tokenInfo = await response.json()
    if (env.googleClientId && tokenInfo.aud !== env.googleClientId) {
      return res.status(401).json({ error: 'Token client mismatch' })
    }

    req.user = {
      email: tokenInfo.email,
      name: tokenInfo.name || tokenInfo.email.split('@')[0],
      sub: tokenInfo.sub
    }

    next()
  } catch (error) {
    next(error)
  }
}
