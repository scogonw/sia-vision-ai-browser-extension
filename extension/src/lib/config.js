// Direct references to process.env allow esbuild to replace them at build time
export const config = {
  backendBaseUrl: process.env.BACKEND_BASE_URL || '',
  googleClientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
  googleRedirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI || '',
  isDev: process.env.NODE_ENV === 'development',
  allowDevTokens: process.env.ALLOW_DEV_TOKENS === 'true'
}

export const ensureConfig = () => {
  if (!config.backendBaseUrl) {
    throw new Error('Missing BACKEND_BASE_URL in environment')
  }
  return config
}
