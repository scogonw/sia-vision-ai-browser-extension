import morgan from 'morgan'
import { logger } from '../utils/logger.js'

export const requestLogger = morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
})
