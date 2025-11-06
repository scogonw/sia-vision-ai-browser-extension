import { AuthHandler } from '../lib/auth-handler.js'

const authHandler = new AuthHandler()

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId })
})

// Offscreen document management
let offscreenDocumentCreated = false
let isStartingSession = false // Prevent duplicate START_SESSION calls
let offscreenDocumentId = null

async function ensureOffscreenDocument() {
  if (offscreenDocumentCreated) {
    return
  }

  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  })

  if (existingContexts.length > 0) {
    offscreenDocumentCreated = true
    offscreenDocumentId = existingContexts[0].documentId
    return
  }

  await chrome.offscreen.createDocument({
    url: 'offscreen/offscreen.html',
    reasons: ['USER_MEDIA'],
    justification: 'LiveKit requires access to WebRTC APIs for real-time communication'
  })

  offscreenDocumentCreated = true
  const contextsAfterCreate = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT']
  })
  offscreenDocumentId = contextsAfterCreate[0]?.documentId || null
  console.log('[Background] Offscreen document created')
}

// Send message to offscreen document
async function sendToOffscreen(message) {
  await ensureOffscreenDocument()

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        ...message,
        source: 'background'
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
        } else if (response && !response.success) {
          reject(new Error(response.error || 'Unknown error'))
        } else {
          resolve(response)
        }
      }
    )
  })
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    console.log('[Background] onMessage received:', {
      type: message?.type,
      source: message?.source,
      senderUrl: sender?.url || null,
      senderOrigin: sender?.origin || null,
      frameId: sender?.frameId ?? null
    })
  } catch (error) {
    console.log('[Background] Failed to log incoming message', error)
  }

  if (message?.source === 'background') {
    // Ignore messages that originate from this service worker to prevent loops
    return false
  }

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
          if (isStartingSession) {
            console.log('[Background] ⚠️  START_SESSION already in progress, rejecting duplicate call')
            sendResponse({ success: false, error: 'Session start already in progress' })
            break
          }
          isStartingSession = true
          console.log('[Background] START_SESSION - Forwarding to offscreen document')
          try {
            const response = await sendToOffscreen({ type: 'START_SESSION' })
            console.log('[Background] START_SESSION - Response:', response)
            sendResponse(response)
          } finally {
            isStartingSession = false
          }
          break
        }
        case 'END_SESSION': {
          console.log('[Background] END_SESSION - Forwarding to offscreen document')
          const response = await sendToOffscreen({ type: 'END_SESSION' })
          console.log('[Background] END_SESSION - Response:', response)
          sendResponse(response)
          break
        }
        case 'MUTE_MICROPHONE': {
          console.log('[Background] MUTE_MICROPHONE - Forwarding to offscreen document')
          const response = await sendToOffscreen({
            type: 'MUTE_MICROPHONE',
            muted: message.muted
          })
          sendResponse(response)
          break
        }
        case 'START_SCREEN_SHARE': {
          console.log('[Background] START_SCREEN_SHARE - Forwarding to offscreen document')
          const response = await sendToOffscreen({ type: 'START_SCREEN_SHARE' })
          console.log('[Background] START_SCREEN_SHARE - Response:', response)
          sendResponse(response)
          break
        }
        case 'STOP_SCREEN_SHARE': {
          console.log('[Background] STOP_SCREEN_SHARE - Forwarding to offscreen document')
          const response = await sendToOffscreen({ type: 'STOP_SCREEN_SHARE' })
          console.log('[Background] STOP_SCREEN_SHARE - Response:', response)
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
        case 'DEBUG_LOG': {
          // Log messages from offscreen document to service worker console
          console.log('[Offscreen]', message.message)
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
