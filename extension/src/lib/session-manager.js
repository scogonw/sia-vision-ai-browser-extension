import { Room, createLocalAudioTrack, createLocalScreenTracks, Track } from 'livekit-client'
import { ensureConfig } from './config.js'
import { AuthHandler } from './auth-handler.js'

// Helper to log to background service worker console (visible to user)
const log = (message, data = null) => {
  const logMsg = data ? `${message} ${JSON.stringify(data)}` : message
  console.log(logMsg) // Also log locally
  // Send to background so it appears in service worker console
  try {
    chrome.runtime.sendMessage({
      type: 'DEBUG_LOG',
      message: logMsg
    }).catch(() => {}) // Ignore if background not ready
  } catch (e) {}
}

export class SessionManager {
  constructor () {
    this.room = null
    this.audioTrack = null
    this.screenTrack = null
    this.screenAudioTrack = null
    this.remoteAudioElements = [] // Track remote audio elements for cleanup
    this.state = 'idle'
    this.startSessionPromise = null
    this.currentSessionInfo = null
    this.sessionStartCounter = 0
    this.auth = new AuthHandler()
    log('[SessionManager] SessionManager instance created')
  }

  async startSession () {
    const callId = ++this.sessionStartCounter
    log(`[SessionManager] startSession request #${callId} received (state=${this.state}, hasPromise=${!!this.startSessionPromise})`)

    if (this.state === 'connected' && this.currentSessionInfo) {
      log(`[SessionManager] Session already active, returning existing session info (request #${callId})`)
      return this.currentSessionInfo
    }

    if (this.startSessionPromise) {
      log(`[SessionManager] Session start already in progress, awaiting existing promise (request #${callId})`)
      return this.startSessionPromise
    }

    this.state = 'connecting'
    this.startSessionPromise = this._startSessionInternal(callId)

    try {
      const sessionInfo = await this.startSessionPromise
      this.currentSessionInfo = sessionInfo
      return sessionInfo
    } finally {
      this.startSessionPromise = null
      if (this.state !== 'connected') {
        this.state = 'idle'
      }
      log(`[SessionManager] startSession request #${callId} finished (state=${this.state})`)
    }
  }

  async _startSessionInternal (callId) {
    log(`[SessionManager] ===== STARTING NEW SESSION (request #${callId}) =====`)
    ensureConfig()

    // Ensure any previous session is completely cleaned up before starting a new one
    const preStartState = {
      hasRoom: !!this.room,
      hasAudioTrack: !!this.audioTrack,
      hasScreenTrack: !!this.screenTrack,
      remoteAudioElementsCount: this.remoteAudioElements.length,
      currentState: this.state
    }
    log(`[SessionManager] Pre-start state check for request #${callId}:`, preStartState)

    if (this.room || this.audioTrack || this.screenTrack || this.remoteAudioElements.length > 0) {
      log(`[SessionManager] ⚠️  Found leftover session data for request #${callId}! Forcing complete cleanup...`)
      await this.endSession()
      // Add a small delay to ensure everything is cleaned up
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    try {
      // Permission should already be granted in the side panel before this is called
      // Step 1: Get LiveKit token from backend
      log(`[SessionManager] Fetching LiveKit token from backend (request #${callId})`)
      const token = await this.auth.getToken()
      const response = await fetch(`${process.env.BACKEND_BASE_URL}/api/token/livekit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ timestamp: Date.now() })
      })

      if (!response.ok) {
        throw new Error('Failed to create LiveKit token')
      }

      const { token: livekitToken, host, sessionId, roomName } = await response.json()
      log(`[SessionManager] Received LiveKit credentials (request #${callId}):`, { sessionId, roomName, host })

      // Step 2: Create and connect to LiveKit room
      log(`[SessionManager] Creating new LiveKit Room instance (request #${callId})`)
      this.room = new Room({
        adaptiveStream: true,
        dynacast: true,
        disconnectOnPageLeave: false
      })

      log(`[SessionManager] Registering room event listeners (request #${callId})`)
      this.registerEvents(sessionId)

      log(`[SessionManager] Connecting to LiveKit room (request #${callId})...`)
      await this.room.connect(host, livekitToken)
      log(`[SessionManager] Successfully connected to LiveKit room (request #${callId})`)

      // Step 3: Create and publish microphone track (permission already granted in side panel)
      log(`[SessionManager] Publishing microphone track (request #${callId})`)
      await this.publishMicrophone()

      // Note: Screen sharing is now optional and controlled by user via "Share Screen" button
      // No automatic screen sharing prompt

      this.state = 'connected'
      log(`[SessionManager] ===== SESSION START COMPLETE (request #${callId}) =====`)
      return { sessionId, roomName }
    } catch (error) {
      // If anything fails, clean up everything
      log(`[SessionManager] ❌ Session start failed for request #${callId}: ${error.message}`)
      log(`[SessionManager] Performing error cleanup for request #${callId}...`)
      await this.endSession()
      throw error
    }
  }

  async publishMicrophone () {
    // Permission should already be granted in the side panel
    // Now we can create the audio track in the offscreen document
    try {
      console.log('[SessionManager] Creating audio track (permission already granted)...')
      this.audioTrack = await createLocalAudioTrack({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      })

      await this.room.localParticipant.publishTrack(this.audioTrack, {
        name: 'microphone',
        source: Track.Source.Microphone
      })
      console.log('[SessionManager] Microphone track published to room')
    } catch (error) {
      console.error('[SessionManager] Failed to publish microphone track:', error)
      if (error.name === 'NotAllowedError') {
        throw new Error('Microphone access denied. Please allow microphone access in the side panel first.')
      } else if (error.name === 'NotFoundError') {
        throw new Error('No microphone found. Please connect a microphone and try again.')
      } else {
        throw new Error(`Failed to publish microphone: ${error.message}`)
      }
    }
  }

  async publishScreenShare () {
    const [screenTrack, screenAudioTrack] = await createLocalScreenTracks({
      resolution: { width: 1920, height: 1080 },
      frameRate: 15,
      audio: true
    })

    this.screenTrack = screenTrack
    this.screenAudioTrack = screenAudioTrack || null
    await this.room.localParticipant.publishTrack(screenTrack, {
      name: 'screen-share',
      source: Track.Source.ScreenShare,
      simulcast: false
    })

    if (screenAudioTrack) {
      await this.room.localParticipant.publishTrack(screenAudioTrack, {
        name: 'system-audio',
        source: Track.Source.ScreenShareAudio
      })
    }

    screenTrack.on('ended', () => {
      if (this.room?.localParticipant) {
        this.room.localParticipant.unpublishTrack(screenTrack)
        if (this.screenAudioTrack) {
          this.room.localParticipant.unpublishTrack(this.screenAudioTrack)
        }
      }
      this.screenTrack = null
      if (this.screenAudioTrack) {
        this.screenAudioTrack.stop()
        this.screenAudioTrack = null
      }
      chrome.runtime.sendMessage({ type: 'SCREEN_SHARE_ENDED' })
    })
  }

  async stopTracks () {
    if (this.audioTrack) {
      if (this.room?.localParticipant) {
        this.room.localParticipant.unpublishTrack(this.audioTrack)
      }
      this.audioTrack.stop()
      this.audioTrack = null
    }
    if (this.screenTrack) {
      if (this.room?.localParticipant) {
        this.room.localParticipant.unpublishTrack(this.screenTrack)
      }
      this.screenTrack.stop()
      this.screenTrack = null
    }
    if (this.screenAudioTrack) {
      if (this.room?.localParticipant) {
        this.room.localParticipant.unpublishTrack(this.screenAudioTrack)
      }
      this.screenAudioTrack.stop()
      this.screenAudioTrack = null
    }
  }

  async endSession () {
    log('[SessionManager] ===== STARTING COMPLETE SESSION CLEANUP =====')
    const currentState = {
      hasRoom: !!this.room,
      hasAudioTrack: !!this.audioTrack,
      hasScreenTrack: !!this.screenTrack,
      hasScreenAudioTrack: !!this.screenAudioTrack,
      remoteAudioElementsCount: this.remoteAudioElements.length,
      roomState: this.room?.state
    }
    log('[SessionManager] Current state:', currentState)

    // Step 1: Remove all event listeners from the room before disconnecting
    if (this.room) {
      log('[SessionManager] Removing all room event listeners')
      this.room.removeAllListeners()
    }

    // Step 2: Clean up remote audio elements
    if (this.remoteAudioElements.length > 0) {
      log(`[SessionManager] Cleaning up ${this.remoteAudioElements.length} remote audio elements`)
      this.remoteAudioElements.forEach((audioEl, index) => {
        try {
          log(`[SessionManager] Cleaning audio element ${index + 1}`)
          audioEl.pause()
          audioEl.srcObject = null
          if (audioEl.parentNode) {
            audioEl.parentNode.removeChild(audioEl)
          }
        } catch (error) {
          log(`[SessionManager] Error cleaning audio element ${index + 1}: ${error.message}`)
        }
      })
      this.remoteAudioElements = []
      log('[SessionManager] All remote audio elements cleared')
    }

    // Step 3: Stop and unpublish all local tracks
    log('[SessionManager] Stopping all local tracks')
    await this.stopTracks()

    // Step 4: Disconnect from room and wait for complete disconnection
    if (this.room) {
      log('[SessionManager] Disconnecting from LiveKit room')
      try {
        await this.room.disconnect(true) // true = stop all tracks
        log('[SessionManager] Room disconnected successfully')
      } catch (error) {
        log(`[SessionManager] Error disconnecting room: ${error.message}`)
      }
      this.room = null
    }

    // Step 5: Final state reset
    this.state = 'idle'
    this.currentSessionInfo = null
    log('[SessionManager] ===== SESSION CLEANUP COMPLETE =====')
    const finalState = {
      hasRoom: !!this.room,
      hasAudioTrack: !!this.audioTrack,
      hasScreenTrack: !!this.screenTrack,
      remoteAudioElementsCount: this.remoteAudioElements.length
    }
    log('[SessionManager] Final state:', finalState)
  }

  async setMicrophoneMuted (muted) {
    if (!this.audioTrack) return
    if (typeof this.audioTrack.setMuted === 'function') {
      this.audioTrack.setMuted(muted)
    } else {
      this.audioTrack.muted = muted
    }
  }

  async startScreenShare () {
    if (this.screenTrack) {
      console.warn('[SessionManager] Screen share already active')
      return
    }
    await this.publishScreenShare()
  }

  registerEvents (sessionId) {
    this.room.on('participantConnected', (participant) => {
      chrome.runtime.sendMessage({
        type: 'PARTICIPANT_CONNECTED',
        participant: participant.identity,
        sessionId
      })
    })

    this.room.on('trackSubscribed', (track, publication, participant) => {
      if (track.kind === 'audio') {
        log('[SessionManager] 🔊 Audio track subscribed, attaching to DOM')
        log('[SessionManager] Current remote audio elements count BEFORE attach: ' + this.remoteAudioElements.length)
        const audioEl = track.attach()
        audioEl.autoplay = true
        // Track this audio element for cleanup
        this.remoteAudioElements.push(audioEl)
        log('[SessionManager] Current remote audio elements count AFTER attach: ' + this.remoteAudioElements.length)
        audioEl.play().catch(() => {
          log('[SessionManager] Unable to autoplay audio')
        })
      }
      chrome.runtime.sendMessage({
        type: 'TRACK_SUBSCRIBED',
        participant: participant.identity,
        track: publication?.trackSid
      })
    })

    this.room.on('trackUnsubscribed', (track, publication, participant) => {
      if (track.kind === 'audio') {
        log('[SessionManager] Audio track unsubscribed, detaching from DOM')
        const attachedElements = track.detach()
        attachedElements.forEach(audioEl => {
          audioEl.pause()
          audioEl.srcObject = null
          audioEl.remove()
          // Remove from our tracking array
          const index = this.remoteAudioElements.indexOf(audioEl)
          if (index > -1) {
            this.remoteAudioElements.splice(index, 1)
          }
        })
        log('[SessionManager] Remote audio elements count after unsubscribe: ' + this.remoteAudioElements.length)
      }
    })

    this.room.on('connectionStateChanged', (state) => {
      chrome.runtime.sendMessage({
        type: 'CONNECTION_STATE_CHANGED',
        state,
        sessionId
      })
    })
  }
}
