import { config, ensureConfig } from './config.js'

const AUTH_TOKEN_KEY = 'scogo_auth_token'
const USER_INFO_KEY = 'scogo_user_info'
const EXPIRES_AT_KEY = 'scogo_token_expires_at'

const getFromStorage = async (key) => {
  const result = await chrome.storage.local.get([key])
  return result[key]
}

const setInStorage = async (data) => {
  await chrome.storage.local.set(data)
}

const clearStorage = async () => {
  await chrome.storage.local.remove([AUTH_TOKEN_KEY, USER_INFO_KEY, EXPIRES_AT_KEY])
}

const isExpired = (expiresAt) => {
  if (!expiresAt) return true
  return Date.now() > Number(expiresAt)
}

export class AuthHandler {
  async isAuthenticated () {
    const token = await getFromStorage(AUTH_TOKEN_KEY)
    const expiresAt = await getFromStorage(EXPIRES_AT_KEY)
    return Boolean(token && !isExpired(expiresAt))
  }

  async getToken () {
    const token = await getFromStorage(AUTH_TOKEN_KEY)
    const expiresAt = await getFromStorage(EXPIRES_AT_KEY)
    if (token && !isExpired(expiresAt)) {
      return token
    }
    return this.authenticate()
  }

  async authenticate () {
    ensureConfig()
    if (!config.googleClientId) {
      throw new Error('Google OAuth client ID is not configured')
    }

    const redirectUri = chrome.identity.getRedirectURL()
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    authUrl.searchParams.set('client_id', config.googleClientId)
    authUrl.searchParams.set('response_type', 'token')
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('scope', 'openid email profile')
    authUrl.searchParams.set('prompt', 'select_account consent')
    authUrl.searchParams.set('include_granted_scopes', 'true')

    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl.toString(),
      interactive: true
    })

    const fragment = new URL(responseUrl).hash.substring(1)
    const params = new URLSearchParams(fragment)
    const accessToken = params.get('access_token')
    const expiresIn = Number(params.get('expires_in') || '0')

    if (!accessToken) {
      throw new Error('Authentication failed: no access token received')
    }

    const expiresAt = Date.now() + expiresIn * 1000
    await setInStorage({
      [AUTH_TOKEN_KEY]: accessToken,
      [EXPIRES_AT_KEY]: expiresAt,
      [USER_INFO_KEY]: params.get('email') || null
    })

    return accessToken
  }

  async logout () {
    await clearStorage()
  }
}
