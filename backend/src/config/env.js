import dotenv from 'dotenv'
import Joi from 'joi'

const envFileLoaded = dotenv.config()
if (envFileLoaded.error && process.env.NODE_ENV !== 'production') {
  console.warn('[config] No .env file found, relying on process environment')
}

const envSchema = Joi.object({
  NODE_ENV: Joi.string().default('development'),
  PORT: Joi.number().integer().min(1).max(65535).default(4000),
  CORS_ORIGINS: Joi.string().default('http://localhost:5173'),
  BACKEND_BASE_URL: Joi.string().uri().required(),
  GOOGLE_OAUTH_CLIENT_ID: Joi.string().allow('').default(''),
  GOOGLE_OAUTH_REDIRECT_URI: Joi.string().uri().allow('').default(''),
  GOOGLE_TOKEN_INFO_URL: Joi.string().uri().default('https://oauth2.googleapis.com/tokeninfo'),
  LIVEKIT_API_KEY: Joi.string().required(),
  LIVEKIT_API_SECRET: Joi.string().required(),
  LIVEKIT_HOST: Joi.string().uri().required(),
  LIVEKIT_TOKEN_TTL_SECONDS: Joi.number().integer().min(60).default(60 * 60 * 6),
  SESSION_LOG_RETENTION_DAYS: Joi.number().integer().min(1).default(90),
  ALLOW_DEV_TOKENS: Joi.boolean().default(false),
  AGENT_API_KEY: Joi.string().allow('').default(''),
  GEMINI_API_KEY: Joi.string().allow('').default(''),
  KNOWLEDGE_BASE_PATH: Joi.string().default('agent/knowledge_base'),
  LOG_LEVEL: Joi.string().valid('fatal', 'error', 'warn', 'info', 'debug', 'trace').default('info')
}).unknown()

const { value, error } = envSchema.validate(process.env, { abortEarly: false })

if (error) {
  throw new Error(`Environment validation error: ${error.message}`)
}

const arrayFromCsv = (csv) => csv.split(',').map((origin) => origin.trim()).filter(Boolean)

export const env = {
  nodeEnv: value.NODE_ENV,
  port: value.PORT,
  corsOrigins: arrayFromCsv(value.CORS_ORIGINS),
  backendBaseUrl: value.BACKEND_BASE_URL,
  googleClientId: value.GOOGLE_OAUTH_CLIENT_ID,
  googleRedirectUri: value.GOOGLE_OAUTH_REDIRECT_URI,
  googleTokenInfoUrl: value.GOOGLE_TOKEN_INFO_URL,
  livekit: {
    host: value.LIVEKIT_HOST,
    apiKey: value.LIVEKIT_API_KEY,
    apiSecret: value.LIVEKIT_API_SECRET,
    tokenTtlSeconds: value.LIVEKIT_TOKEN_TTL_SECONDS
  },
  sessionLogRetentionDays: value.SESSION_LOG_RETENTION_DAYS,
  allowDevTokens: value.ALLOW_DEV_TOKENS,
  agentApiKey: value.AGENT_API_KEY,
  geminiApiKey: value.GEMINI_API_KEY,
  knowledgeBasePath: value.KNOWLEDGE_BASE_PATH,
  logLevel: value.LOG_LEVEL
}
