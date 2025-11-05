import { env } from '../config/env.js'

export const getClientConfig = (req, res) => {
  res.json({
    backendBaseUrl: env.backendBaseUrl,
    googleClientId: env.googleClientId,
    googleRedirectUri: env.googleRedirectUri,
    livekitHost: env.livekit.host
  })
}
