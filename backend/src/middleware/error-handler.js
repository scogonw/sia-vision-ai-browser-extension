import { logger } from '../utils/logger.js'

// eslint-disable-next-line no-unused-vars
export const errorHandler = (err, req, res, next) => {
  logger.error({ err, path: req.path }, 'Unhandled error')
  const status = err.status || 500
  res.status(status).json({
    error: err.message || 'Internal Server Error'
  })
}
