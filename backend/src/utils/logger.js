import pino from 'pino'
import { env } from '../config/env.js'

const baseLogger = pino({
  level: env.logLevel,
  transport: env.nodeEnv === 'development'
    ? {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:standard' }
      }
    : undefined
})

export const logger = baseLogger
