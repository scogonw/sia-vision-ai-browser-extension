import { Room, createLocalAudioTrack, createLocalScreenTracks, Track } from 'livekit-client'
import { ensureConfig } from './config.js'
import { AuthHandler } from './auth-handler.js'

export class SessionManager {
  constructor () {
    this.room = null
    this.audioTrack = null
    this.screenTrack = null
    this.screenAudioTrack = null
    this.state = 'idle'
    this.auth = new AuthHandler()
  }

  async startSession () {
    ensureConfig()

    // Ensure any previous session is completely cleaned up before starting a new one
    if (this.room || this.audioTrack || this.screenTrack) {
      console.log('[SessionManager] Cleaning up previous session before starting new one')
      await this.endSession()
    }

    try {
      // Permission should already be granted in the side panel before this is called
      // Step 1: Get LiveKit token from backend
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

      // Step 2: Create and connect to LiveKit room
      this.room = new Room({
        adaptiveStream: true,
        dynacast: true,
        disconnectOnPageLeave: false
      })

      this.registerEvents(sessionId)
      await this.room.connect(host, livekitToken)

      // Step 3: Create and publish microphone track (permission already granted in side panel)
      await this.publishMicrophone()

      // Note: Screen sharing is now optional and controlled by user via "Share Screen" button
      // No automatic screen sharing prompt

      this.state = 'connected'
      return { sessionId, roomName }
    } catch (error) {
      // If anything fails, clean up the audio track and room
      console.error('[SessionManager] Session start failed:', error)
      if (this.audioTrack) {
        this.audioTrack.stop()
        this.audioTrack = null
      }
      if (this.room) {
        await this.room.disconnect()
        this.room = null
      }
      this.state = 'idle'
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
    await this.stopTracks()
    if (this.room) {
      await this.room.disconnect()
      this.room = null
    }
    this.state = 'idle'
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
        const audioEl = track.attach()
        audioEl.autoplay = true
        audioEl.play().catch(() => {
          console.warn('Unable to autoplay audio')
        })
      }
      chrome.runtime.sendMessage({
        type: 'TRACK_SUBSCRIBED',
        participant: participant.identity,
        track: publication?.trackSid
      })
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
