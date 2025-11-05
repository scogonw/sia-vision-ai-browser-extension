import { AuthHandler } from '../lib/auth-handler.js'

const authHandler = new AuthHandler()

// Offscreen document management
let offscreenDocumentCreated = false

async function ensureOffscreenDocument() {
  if (offscreenDocumentCreated) {
    return
  }

  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  })

  if (existingContexts.length > 0) {
    offscreenDocumentCreated = true
    return
  }

  await chrome.offscreen.createDocument({
    url: 'offscreen/offscreen.html',
    reasons: ['USER_MEDIA'],
    justification: 'LiveKit requires access to WebRTC APIs for real-time communication'
  })

  offscreenDocumentCreated = true
  console.log('[Background] Offscreen document created')
}

// Send message to offscreen document
async function sendToOffscreen(message) {
  await ensureOffscreenDocument()
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
      } else if (response && !response.success) {
        reject(new Error(response.error || 'Unknown error'))
      } else {
        resolve(response)
      }
    })
  })
}

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
          const response = await sendToOffscreen({ type: 'START_SESSION' })
          sendResponse(response)
          break
        }
        case 'END_SESSION': {
          const response = await sendToOffscreen({ type: 'END_SESSION' })
          sendResponse(response)
          break
        }
        case 'MUTE_MICROPHONE': {
          const response = await sendToOffscreen({
            type: 'MUTE_MICROPHONE',
            muted: message.muted
          })
          sendResponse(response)
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
