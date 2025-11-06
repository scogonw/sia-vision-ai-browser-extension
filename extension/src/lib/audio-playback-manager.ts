import { Room, RemoteAudioTrack, RemoteParticipant, RemoteTrackPublication } from 'livekit-client'

/**
 * Audio element metadata for tracking and cleanup
 */
interface AudioElementMetadata {
  element: HTMLAudioElement
  track: RemoteAudioTrack
  participant: RemoteParticipant
  publication: RemoteTrackPublication
  createdAt: number
  playbackAttempts: number
  isPlaying: boolean
  abortController: AbortController
}

/**
 * Playback verification result
 */
interface PlaybackVerification {
  success: boolean
  attempts: number
  error?: Error
}

/**
 * AudioPlaybackManager handles reliable audio track subscription and playback
 * Leverages LiveKit's built-in audio attachment with additional reliability features
 */
export class AudioPlaybackManager {
  private audioElements: Map<string, AudioElementMetadata> = new Map()
  private room: Room | null = null
  private autoplayEnabled = false
  private pendingAudioElements: AudioElementMetadata[] = []
  private maxPlaybackAttempts = 3
  private playbackVerificationDelay = 500 // ms

  constructor() {
    console.log('[AudioPlaybackManager] Instance created')
  }

  /**
   * Attach to a LiveKit room and set up event listeners
   */
  attachToRoom(room: Room): void {
    this.room = room
    console.log('[AudioPlaybackManager] Attached to room')

    // Check if audio is already enabled
    this.autoplayEnabled = room.canPlaybackAudio

    // Listen for audio playback status changes
    room.on('AudioPlaybackStatusChanged', () => {
      const canPlayback = room.canPlaybackAudio
      console.log(`[AudioPlaybackManager] Audio playback status changed: ${canPlayback}`)

      if (canPlayback && !this.autoplayEnabled) {
        this.autoplayEnabled = true
        // Process pending audio elements
        this.processPendingAudio()
      }
    })
  }

  /**
   * Enable audio playback (must be called in user gesture context)
   */
  async enableAudioPlayback(): Promise<void> {
    if (!this.room) {
      throw new Error('Room not attached')
    }

    if (this.autoplayEnabled) {
      console.log('[AudioPlaybackManager] Audio playback already enabled')
      return
    }

    try {
      console.log('[AudioPlaybackManager] Enabling audio playback via Room.startAudio()')
      await this.room.startAudio()
      this.autoplayEnabled = true
      console.log('[AudioPlaybackManager] Audio playback enabled successfully')

      // Process any pending audio elements
      await this.processPendingAudio()
    } catch (error) {
      console.error('[AudioPlaybackManager] Failed to enable audio playback:', error)
      throw error
    }
  }

  /**
   * Handle audio track subscription
   */
  async handleTrackSubscribed(
    track: RemoteAudioTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant
  ): Promise<void> {
    const trackId = `${participant.identity}-${publication.trackSid}`
    console.log(`[AudioPlaybackManager] Audio track subscribed: ${trackId}`)

    // Use LiveKit's built-in attach() method to create audio element
    const audioElement = track.attach()
    audioElement.autoplay = true

    // Create abort controller for cleanup
    const abortController = new AbortController()

    // Create metadata for tracking
    const metadata: AudioElementMetadata = {
      element: audioElement,
      track,
      participant,
      publication,
      createdAt: Date.now(),
      playbackAttempts: 0,
      isPlaying: false,
      abortController
    }

    // Store in registry
    this.audioElements.set(trackId, metadata)
    console.log(`[AudioPlaybackManager] Audio elements count: ${this.audioElements.size}`)

    // Set up event listeners with AbortController for automatic cleanup
    this.setupAudioElementListeners(metadata)

    // Initiate playback
    if (this.autoplayEnabled) {
      await this.initiatePlayback(metadata)
    } else {
      console.log('[AudioPlaybackManager] Audio playback not enabled, queuing for later')
      this.pendingAudioElements.push(metadata)

      // Notify that audio needs to be enabled
      this.notifyAudioBlocked()
    }
  }

  /**
   * Set up audio element event listeners
   */
  private setupAudioElementListeners(metadata: AudioElementMetadata): void {
    const { element, abortController } = metadata
    const signal = abortController.signal

    // Playback started successfully
    element.addEventListener('playing', () => {
      console.log('[AudioPlaybackManager] Audio playback started')
      metadata.isPlaying = true
    }, { signal })

    // Playback paused
    element.addEventListener('pause', () => {
      console.log('[AudioPlaybackManager] Audio playback paused')
      metadata.isPlaying = false
    }, { signal })

    // Playback ended
    element.addEventListener('ended', () => {
      console.log('[AudioPlaybackManager] Audio playback ended')
      metadata.isPlaying = false
    }, { signal })

    // Playback stalled
    element.addEventListener('stalled', () => {
      console.warn('[AudioPlaybackManager] Audio playback stalled, will retry')
      this.retryPlayback(metadata)
    }, { signal })

    // Playback error
    element.addEventListener('error', (event) => {
      console.error('[AudioPlaybackManager] Audio playback error:', event)
      this.retryPlayback(metadata)
    }, { signal })
  }

  /**
   * Initiate playback with verification
   */
  private async initiatePlayback(metadata: AudioElementMetadata): Promise<void> {
    const { element } = metadata
    metadata.playbackAttempts++

    try {
      console.log(`[AudioPlaybackManager] Attempting playback (attempt ${metadata.playbackAttempts}/${this.maxPlaybackAttempts})`)

      // Attempt to play
      await element.play()

      // Verify playback started
      const verification = await this.verifyPlayback(metadata)

      if (verification.success) {
        console.log('[AudioPlaybackManager] Playback verified successfully')
      } else {
        console.warn('[AudioPlaybackManager] Playback verification failed')
        this.retryPlayback(metadata)
      }
    } catch (error) {
      console.error('[AudioPlaybackManager] Playback failed:', error)

      // Check if it's an autoplay error
      if (error instanceof Error && error.name === 'NotAllowedError') {
        console.log('[AudioPlaybackManager] Autoplay blocked, queuing for user gesture')
        this.autoplayEnabled = false
        this.pendingAudioElements.push(metadata)
        this.notifyAudioBlocked()
      } else {
        // Other errors - retry
        this.retryPlayback(metadata)
      }
    }
  }

  /**
   * Verify that playback actually started
   */
  private async verifyPlayback(metadata: AudioElementMetadata): Promise<PlaybackVerification> {
    return new Promise((resolve) => {
      setTimeout(() => {
        const { element } = metadata

        const isPlaying = !element.paused &&
                         !element.ended &&
                         element.currentTime > 0 &&
                         element.readyState > 2

        if (isPlaying) {
          metadata.isPlaying = true
          resolve({ success: true, attempts: metadata.playbackAttempts })
        } else {
          resolve({
            success: false,
            attempts: metadata.playbackAttempts,
            error: new Error('Playback did not start')
          })
        }
      }, this.playbackVerificationDelay)
    })
  }

  /**
   * Retry playback with exponential backoff
   */
  private async retryPlayback(metadata: AudioElementMetadata): Promise<void> {
    if (metadata.playbackAttempts >= this.maxPlaybackAttempts) {
      console.error(`[AudioPlaybackManager] Max playback attempts (${this.maxPlaybackAttempts}) reached, giving up`)
      return
    }

    // Calculate backoff delay: 100ms, 300ms, 900ms
    const delay = 100 * Math.pow(3, metadata.playbackAttempts - 1)
    console.log(`[AudioPlaybackManager] Retrying playback in ${delay}ms...`)

    setTimeout(() => {
      this.initiatePlayback(metadata)
    }, delay)
  }

  /**
   * Process pending audio elements after autoplay is enabled
   */
  private async processPendingAudio(): Promise<void> {
    if (this.pendingAudioElements.length === 0) {
      return
    }

    console.log(`[AudioPlaybackManager] Processing ${this.pendingAudioElements.length} pending audio elements`)

    const pending = [...this.pendingAudioElements]
    this.pendingAudioElements = []

    for (const metadata of pending) {
      await this.initiatePlayback(metadata)
    }
  }

  /**
   * Handle audio track unsubscription
   */
  handleTrackUnsubscribed(
    track: RemoteAudioTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant
  ): void {
    const trackId = `${participant.identity}-${publication.trackSid}`
    console.log(`[AudioPlaybackManager] Audio track unsubscribed: ${trackId}`)

    const metadata = this.audioElements.get(trackId)
    if (metadata) {
      this.cleanupAudioElement(metadata)
      this.audioElements.delete(trackId)
      console.log(`[AudioPlaybackManager] Audio elements count: ${this.audioElements.size}`)
    }
  }

  /**
   * Cleanup audio element
   */
  private cleanupAudioElement(metadata: AudioElementMetadata): void {
    const { element, track, abortController } = metadata

    console.log('[AudioPlaybackManager] Cleaning up audio element')

    // Abort all event listeners
    abortController.abort()

    // Use LiveKit's detach method
    const detachedElements = track.detach()
    detachedElements.forEach(el => {
      el.pause()
      el.srcObject = null
      if (el.parentNode) {
        el.parentNode.removeChild(el)
      }
    })

    // Also clean up our tracked element
    element.pause()
    element.srcObject = null
    if (element.parentNode) {
      element.parentNode.removeChild(element)
    }
  }

  /**
   * Notify that audio is blocked and needs user gesture
   */
  private notifyAudioBlocked(): void {
    try {
      chrome.runtime.sendMessage({
        type: 'AUDIO_BLOCKED',
        message: 'Click to enable audio'
      }).catch(() => {})
    } catch (e) {
      // Ignore if background not ready
    }
  }

  /**
   * Get active audio elements count
   */
  getActiveElementsCount(): number {
    return this.audioElements.size
  }

  /**
   * Check if autoplay is enabled
   */
  isAutoplayEnabled(): boolean {
    return this.autoplayEnabled
  }

  /**
   * Cleanup all audio elements
   */
  cleanup(): void {
    console.log(`[AudioPlaybackManager] Cleaning up ${this.audioElements.size} audio elements`)

    // Clean up all tracked elements
    for (const metadata of this.audioElements.values()) {
      this.cleanupAudioElement(metadata)
    }

    this.audioElements.clear()
    this.pendingAudioElements = []
    this.autoplayEnabled = false
    this.room = null

    console.log('[AudioPlaybackManager] Cleanup complete')
  }
}
