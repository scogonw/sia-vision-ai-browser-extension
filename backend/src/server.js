import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import router from './routes/index.js'
import { env } from './config/env.js'
import { logger } from './utils/logger.js'
import { requestLogger } from './middleware/request-logger.js'
import { errorHandler } from './middleware/error-handler.js'
import { sessionStore } from './services/session-store.js'

const app = express()

app.use(helmet())
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(cors({ origin: env.corsOrigins, credentials: true }))
app.use(requestLogger)

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.use('/api', router)
app.use(errorHandler)

const server = app.listen(env.port, () => {
  logger.info(`Backend listening on port ${env.port}`)
})

const cleanupInterval = setInterval(() => sessionStore.cleanupExpired(), 60 * 60 * 1000)

const shutdown = () => {
  clearInterval(cleanupInterval)
  server.close(() => {
    logger.info('Server closed')
    process.exit(0)
  })
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
