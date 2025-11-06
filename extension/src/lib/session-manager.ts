import { Room, createLocalAudioTrack, createLocalScreenTracks, Track, DataPacket_Kind } from 'livekit-client'
import { ensureConfig } from './config.js'
import { AuthHandler } from './auth-handler.js'
import { ConnectionManager, ConnectionState, ConnectionStateChangeEvent } from './connection-manager.js'
import { AudioPlaybackManager } from './audio-playback-manager.js'

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
    this.remoteAudioElements = [] // Track remote audio elements for cleanup (deprecated - use audioPlaybackManager)
    this.state = 'idle'
    this.startSessionPromise = null
    this.currentSessionInfo = null
    this.sessionStartCounter = 0
    this.auth = new AuthHandler()
    this.cachedAuthToken = null
    this.screenCaptureInterval = null
    this.screenCaptureImageCapture = null
    this.screenCaptureInFlight = false
    this.connectionManager = new ConnectionManager()
    this.audioPlaybackManager = new AudioPlaybackManager()
    this.connectionStateUnsubscribe = null
    log('[SessionManager] SessionManager instance created')

    // Subscribe to connection state changes
    this.connectionStateUnsubscribe = this.connectionManager.onStateChange((event) => {
      this.handleConnectionStateChange(event)
    })
  }

  handleConnectionStateChange(event: ConnectionStateChangeEvent) {
    log(`[SessionManager] Connection state changed: ${event.from} -> ${event.to}${event.reason ? ` (${event.reason})` : ''}`)

    // Send state change to background for UI updates
    chrome.runtime.sendMessage({
      type: 'CONNECTION_STATE_CHANGED',
      state: event.to,
      from: event.from,
      reason: event.reason,
      timestamp: event.timestamp
    }).catch(() => {})

    // Handle reconnection failures
    if (event.to === ConnectionState.FAILED) {
      log('[SessionManager] Connection failed, session may need manual restart')
      chrome.runtime.sendMessage({
        type: 'CONNECTION_FAILED',
        reason: event.reason || 'Unknown connection failure'
      }).catch(() => {})
    }

    // Handle successful reconnection
    if (event.to === ConnectionState.CONNECTED && event.from === ConnectionState.RECONNECTING) {
      log('[SessionManager] Reconnection successful')
      chrome.runtime.sendMessage({
        type: 'CONNECTION_RECOVERED',
        message: 'Connection restored successfully'
      }).catch(() => {})
    }
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
      this.cachedAuthToken = token
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

      // Attach ConnectionManager to room
      this.connectionManager.attachToRoom(this.room)

      // Attach AudioPlaybackManager to room
      this.audioPlaybackManager.attachToRoom(this.room)

      log(`[SessionManager] Registering room event listeners (request #${callId})`)
      this.registerEvents(sessionId)

      log(`[SessionManager] Connecting to LiveKit room (request #${callId})...`)
      this.connectionManager.startConnecting()
      await this.room.connect(host, livekitToken)
      this.connectionManager.markConnected()
      log(`[SessionManager] Successfully connected to LiveKit room (request #${callId})`)

      // Enable audio playback in user gesture context
      log(`[SessionManager] Enabling audio playback (request #${callId})`)
      try {
        await this.audioPlaybackManager.enableAudioPlayback()
        log(`[SessionManager] Audio playback enabled (request #${callId})`)
      } catch (error) {
        log(`[SessionManager] Failed to enable audio playback (request #${callId}): ${error.message}`)
        // Continue anyway - user can enable manually later
      }

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

    this.startScreenCaptureLoop()

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
      this.stopScreenCaptureLoop()
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
    this.stopScreenCaptureLoop()
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

    // Step 1: Signal disconnection to ConnectionManager
    this.connectionManager.startDisconnecting()

    // Step 2: Remove all event listeners from the room before disconnecting
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
    this.cachedAuthToken = null

    // Mark connection as disconnected
    this.connectionManager.markDisconnected()

    // Cleanup AudioPlaybackManager
    this.audioPlaybackManager.cleanup()

    log('[SessionManager] ===== SESSION CLEANUP COMPLETE =====')
    const finalState = {
      hasRoom: !!this.room,
      hasAudioTrack: !!this.audioTrack,
      hasScreenTrack: !!this.screenTrack,
      remoteAudioElementsCount: this.remoteAudioElements.length,
      audioPlaybackManagerElements: this.audioPlaybackManager.getActiveElementsCount()
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

  async ensureAuthToken () {
    if (this.cachedAuthToken) return this.cachedAuthToken
    this.cachedAuthToken = await this.auth.getToken()
    return this.cachedAuthToken
  }

  async computeDigest (arrayBuffer) {
    const hashBuffer = await crypto.subtle.digest('SHA-1', arrayBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  }

  async encodeFrameBitmap (bitmap) {
    const maxWidth = 1280
    const maxHeight = 720
    const scale = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height)
    const targetWidth = Math.max(1, Math.round(bitmap.width * scale))
    const targetHeight = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = new OffscreenCanvas(targetWidth, targetHeight)
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight)

    const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight)
    const data = imageData.data
    let rTotal = 0
    let gTotal = 0
    let bTotal = 0
    let varianceAccumulator = 0
    let samples = 0
    const sampleStep = Math.max(1, Math.floor((targetWidth * targetHeight) / 50000))

    for (let i = 0; i < data.length; i += 4 * sampleStep) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      rTotal += r
      gTotal += g
      bTotal += b
      samples++
    }

    const avgR = samples > 0 ? Math.round(rTotal / samples) : 0
    const avgG = samples > 0 ? Math.round(gTotal / samples) : 0
    const avgB = samples > 0 ? Math.round(bTotal / samples) : 0

    for (let i = 0; i < data.length; i += 4 * sampleStep) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const diffR = r - avgR
      const diffG = g - avgG
      const diffB = b - avgB
      varianceAccumulator += diffR * diffR + diffG * diffG + diffB * diffB
    }

    const variance = samples > 0 ? Number((varianceAccumulator / samples).toFixed(2)) : 0

    const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.6 })
    const arrayBuffer = await blob.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    let binary = ''
    const chunkSize = 0x8000
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize)
      binary += String.fromCharCode(...chunk)
    }
    const base64 = btoa(binary)
    const digest = await this.computeDigest(arrayBuffer)

    return {
      base64,
      width: targetWidth,
      height: targetHeight,
      byteLength: arrayBuffer.byteLength,
      digest,
      averageColor: { r: avgR, g: avgG, b: avgB },
      variance
    }
  }

  async sendScreenFrameToBackend (frame) {
    if (!this.currentSessionInfo?.sessionId) return
    try {
      const token = await this.ensureAuthToken()
      await fetch(`${process.env.BACKEND_BASE_URL}/api/session/${this.currentSessionInfo.sessionId}/screen-frame`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          imageBase64: frame.base64,
          width: frame.width,
          height: frame.height,
          capturedAt: new Date().toISOString(),
          averageColor: frame.averageColor,
          variance: frame.variance,
          digest: frame.digest,
          source: 'screen-track'
        })
      })
    } catch (error) {
      log('[SessionManager] Failed to send screen frame to backend: ' + error.message)
    }
  }

  async sendScreenFrameDataMessage (frame) {
    if (!this.room?.localParticipant) return
    try {
      const payload = {
        type: 'SCREEN_FRAME',
        sessionId: this.currentSessionInfo?.sessionId,
        width: frame.width,
        height: frame.height,
        averageColor: frame.averageColor,
        variance: frame.variance,
        digest: frame.digest,
        capturedAt: Date.now()
      }
      await this.room.localParticipant.publishData(
        JSON.stringify(payload),
        DataPacket_Kind.LOSSY,
        'screen-share'
      )
    } catch (error) {
      log('[SessionManager] Failed to publish screen frame data message: ' + error.message)
    }
  }

  startScreenCaptureLoop () {
    if (!this.screenTrack?.mediaStreamTrack) {
      return
    }
    if (typeof ImageCapture === 'undefined') {
      log('[SessionManager] ImageCapture API not available, skipping screen frame capture')
      return
    }

    this.stopScreenCaptureLoop()
    this.screenCaptureImageCapture = new ImageCapture(this.screenTrack.mediaStreamTrack)

    const capture = async () => {
      if (this.screenCaptureInFlight || !this.screenCaptureImageCapture) {
        return
      }
      this.screenCaptureInFlight = true
      try {
        const bitmap = await this.screenCaptureImageCapture.grabFrame()
        const encoded = await this.encodeFrameBitmap(bitmap)
        if (typeof bitmap.close === 'function') {
          bitmap.close()
        }
        await Promise.all([
          this.sendScreenFrameToBackend(encoded),
          this.sendScreenFrameDataMessage(encoded)
        ])
      } catch (error) {
        log('[SessionManager] Screen capture error: ' + error.message)
      } finally {
        this.screenCaptureInFlight = false
      }
    }

    capture().catch(() => {})
    this.screenCaptureInterval = setInterval(capture, 2000)
  }

  stopScreenCaptureLoop () {
    if (this.screenCaptureInterval) {
      clearInterval(this.screenCaptureInterval)
      this.screenCaptureInterval = null
    }
    this.screenCaptureImageCapture = null
    this.screenCaptureInFlight = false
    if (this.currentSessionInfo?.sessionId) {
      const token = this.cachedAuthToken
      if (token) {
        fetch(`${process.env.BACKEND_BASE_URL}/api/session/${this.currentSessionInfo.sessionId}/screen-frame`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`
          }
        }).catch(() => {})
      }
    }
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
        log('[SessionManager] 🔊 Audio track subscribed, delegating to AudioPlaybackManager')
        // Delegate to AudioPlaybackManager for reliable playback
        this.audioPlaybackManager.handleTrackSubscribed(track, publication, participant)
      }
      chrome.runtime.sendMessage({
        type: 'TRACK_SUBSCRIBED',
        participant: participant.identity,
        track: publication?.trackSid
      })
    })

    this.room.on('trackUnsubscribed', (track, publication, participant) => {
      if (track.kind === 'audio') {
        log('[SessionManager] Audio track unsubscribed, delegating to AudioPlaybackManager')
        // Delegate to AudioPlaybackManager for cleanup
        this.audioPlaybackManager.handleTrackUnsubscribed(track, publication, participant)
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
