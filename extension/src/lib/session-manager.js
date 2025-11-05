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

    this.room = new Room({
      adaptiveStream: true,
      dynacast: true,
      disconnectOnPageLeave: false
    })

    this.registerEvents(sessionId)
    await this.room.connect(host, livekitToken)

    await this.publishMicrophone()

    // Try to publish screen share, but don't fail if user denies permission
    try {
      await this.publishScreenShare()
    } catch (error) {
      console.warn('[SessionManager] Screen share permission denied or unavailable:', error.message)
      // Continue without screen share - audio-only session is still valid
    }

    this.state = 'connected'
    return { sessionId, roomName }
  }

  async publishMicrophone () {
    this.audioTrack = await createLocalAudioTrack({
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    })

    await this.room.localParticipant.publishTrack(this.audioTrack, {
      name: 'microphone',
      source: Track.Source.Microphone
    })
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
