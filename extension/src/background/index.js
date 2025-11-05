import { SessionManager } from '../lib/session-manager.js'
import { AuthHandler } from '../lib/auth-handler.js'

const sessionManager = new SessionManager()
const authHandler = new AuthHandler()

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  ;(async () => {
    try {
      switch (message.type) {
        case 'AUTH_STATUS': {
          const isAuthenticated = await authHandler.isAuthenticated()
          sendResponse({ isAuthenticated })
          break
        }
        case 'LOGIN': {
          await authHandler.authenticate()
          sendResponse({ success: true })
          break
        }
        case 'START_SESSION': {
          const sessionInfo = await sessionManager.startSession()
          sendResponse({ success: true, sessionInfo })
          break
        }
        case 'END_SESSION': {
          await sessionManager.endSession()
          sendResponse({ success: true })
          break
        }
        case 'MUTE_MICROPHONE': {
          sessionManager.muteMicrophone(message.muted)
          sendResponse({ success: true })
          break
        }
        case 'LOG_EVENT': {
          await postToBackend('/api/session/log', message.payload)
          sendResponse({ success: true })
          break
        }
        case 'SUBMIT_FEEDBACK': {
          await postToBackend('/api/feedback', message.payload)
          sendResponse({ success: true })
          break
        }
        default:
          sendResponse({ success: false, error: 'Unknown message type' })
      }
    } catch (error) {
      console.error('Background error', error)
      sendResponse({ success: false, error: error.message })
    }
  })()

  return true
})

const postToBackend = async (path, payload) => {
  const token = await authHandler.getToken()
  const response = await fetch(`${process.env.BACKEND_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    throw new Error(`Backend request failed: ${response.status}`)
  }

  return response.json().catch(() => ({}))
}
