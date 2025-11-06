import { SessionManager } from '../lib/session-manager.js'

console.log('[Offscreen] Initializing offscreen document')

const sessionManager = new SessionManager()

// Handle messages from the service worker
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.source !== 'background') {
    try {
      console.log('[Offscreen] Ignoring message without background source:', {
        type: message?.type,
        source: message?.source,
        senderUrl: sender?.url || null,
        senderOrigin: sender?.origin || null
      })
    } catch (error) {
      console.log('[Offscreen] Failed to log ignored message', error)
    }
    return false
  }

  console.log('[Offscreen] Received message:', message.type, {
    senderUrl: sender?.url || null,
    senderOrigin: sender?.origin || null
  })

  ;(async () => {
    try {
      switch (message.type) {
        case 'START_SESSION': {
          console.log('[Offscreen] Starting LiveKit session')
          const sessionInfo = await sessionManager.startSession()
          sendResponse({ success: true, sessionInfo })
          break
        }

        case 'END_SESSION': {
          console.log('[Offscreen] Ending LiveKit session')
          await sessionManager.endSession()
          sendResponse({ success: true })
          break
        }

        case 'MUTE_MICROPHONE': {
          console.log('[Offscreen] Toggling microphone:', message.muted)
          await sessionManager.setMicrophoneMuted(message.muted)
          sendResponse({ success: true })
          break
        }

        case 'START_SCREEN_SHARE': {
          console.log('[Offscreen] Starting screen share')
          await sessionManager.startScreenShare()
          sendResponse({ success: true })
          break
        }

        default:
          sendResponse({ success: false, error: 'Unknown message type' })
      }
    } catch (error) {
      console.error('[Offscreen] Error handling message:', error)
      // Serialize error properly for DOMExceptions and other error types
      const errorMessage = error.message || error.toString() || 'Unknown error occurred'
      sendResponse({ success: false, error: errorMessage })
    }
  })()

  // Return true to indicate we'll send the response asynchronously
  return true
})

console.log('[Offscreen] Message listener registered')
