const getEnv = (key, fallback = '') => {
  const value = (typeof process !== 'undefined' && process.env && process.env[key]) || ''
  if (!value && fallback) {
    return fallback
  }
  return value
}

export const config = {
  backendBaseUrl: getEnv('BACKEND_BASE_URL'),
  googleClientId: getEnv('GOOGLE_OAUTH_CLIENT_ID'),
  googleRedirectUri: getEnv('GOOGLE_OAUTH_REDIRECT_URI')
}

export const ensureConfig = () => {
  if (!config.backendBaseUrl) {
    throw new Error('Missing BACKEND_BASE_URL in environment')
  }
  return config
}
