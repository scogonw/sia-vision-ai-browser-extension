import { Room, ConnectionState as LiveKitConnectionState, ConnectionQuality } from 'livekit-client'

/**
 * Connection state machine for LiveKit room connections
 */
export enum ConnectionState {
  IDLE = 'idle',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  DEGRADED = 'degraded',
  DISCONNECTING = 'disconnecting',
  FAILED = 'failed'
}

/**
 * Error classification for retry logic
 */
export enum ErrorType {
  TRANSIENT = 'transient',  // Retry possible
  FATAL = 'fatal'           // Retry not possible
}

/**
 * Connection state change event
 */
export interface ConnectionStateChangeEvent {
  from: ConnectionState
  to: ConnectionState
  reason?: string
  timestamp: number
}

/**
 * Connection metrics
 */
export interface ConnectionMetrics {
  connectionAttempts: number
  reconnectionAttempts: number
  lastConnectedAt?: number
  lastDisconnectedAt?: number
  totalDowntime: number
  errors: Array<{
    type: ErrorType
    message: string
    timestamp: number
  }>
}

/**
 * Manages LiveKit connection lifecycle with reconnection logic
 */
export class ConnectionManager {
  private state: ConnectionState = ConnectionState.IDLE
  private room: Room | null = null
  private reconnectionAttempts = 0
  private maxReconnectionAttempts = 3
  private reconnectionTimer: number | null = null
  private degradedTimer: number | null = null
  private stateChangeListeners: Array<(event: ConnectionStateChangeEvent) => void> = []
  private metrics: ConnectionMetrics = {
    connectionAttempts: 0,
    reconnectionAttempts: 0,
    totalDowntime: 0,
    errors: []
  }

  constructor(room?: Room) {
    if (room) {
      this.attachToRoom(room)
    }
  }

  /**
   * Attach to an existing LiveKit room
   */
  attachToRoom(room: Room): void {
    this.room = room
    this.registerRoomEvents()
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state
  }

  /**
   * Get connection metrics
   */
  getMetrics(): ConnectionMetrics {
    return { ...this.metrics }
  }

  /**
   * Register a state change listener
   */
  onStateChange(listener: (event: ConnectionStateChangeEvent) => void): () => void {
    this.stateChangeListeners.push(listener)
    // Return unsubscribe function
    return () => {
      const index = this.stateChangeListeners.indexOf(listener)
      if (index > -1) {
        this.stateChangeListeners.splice(index, 1)
      }
    }
  }

  /**
   * Transition to a new state
   */
  private transitionTo(newState: ConnectionState, reason?: string): void {
    const validTransitions: Record<ConnectionState, ConnectionState[]> = {
      [ConnectionState.IDLE]: [ConnectionState.CONNECTING],
      [ConnectionState.CONNECTING]: [ConnectionState.CONNECTED, ConnectionState.FAILED, ConnectionState.RECONNECTING],
      [ConnectionState.CONNECTED]: [ConnectionState.RECONNECTING, ConnectionState.DEGRADED, ConnectionState.DISCONNECTING],
      [ConnectionState.RECONNECTING]: [ConnectionState.CONNECTED, ConnectionState.FAILED],
      [ConnectionState.DEGRADED]: [ConnectionState.RECONNECTING, ConnectionState.CONNECTED, ConnectionState.DISCONNECTING],
      [ConnectionState.DISCONNECTING]: [ConnectionState.IDLE, ConnectionState.FAILED],
      [ConnectionState.FAILED]: [ConnectionState.IDLE, ConnectionState.CONNECTING]
    }

    const allowedTransitions = validTransitions[this.state]
    if (!allowedTransitions.includes(newState)) {
      console.warn(`[ConnectionManager] Invalid state transition: ${this.state} -> ${newState}`)
      return
    }

    const oldState = this.state
    this.state = newState

    const event: ConnectionStateChangeEvent = {
      from: oldState,
      to: newState,
      reason,
      timestamp: Date.now()
    }

    console.log(`[ConnectionManager] State: ${oldState} -> ${newState}${reason ? ` (${reason})` : ''}`)

    // Notify listeners
    this.stateChangeListeners.forEach(listener => {
      try {
        listener(event)
      } catch (error) {
        console.error('[ConnectionManager] Error in state change listener:', error)
      }
    })

    // Handle state-specific actions
    this.handleStateActions(newState, oldState)
  }

  /**
   * Handle actions for state transitions
   */
  private handleStateActions(newState: ConnectionState, oldState: ConnectionState): void {
    // Track connection metrics
    if (newState === ConnectionState.CONNECTED) {
      this.metrics.lastConnectedAt = Date.now()
      this.reconnectionAttempts = 0
      this.clearReconnectionTimer()
      this.clearDegradedTimer()
    }

    if (oldState === ConnectionState.CONNECTED && newState !== ConnectionState.CONNECTED) {
      this.metrics.lastDisconnectedAt = Date.now()
    }

    // Start reconnection on failure
    if (newState === ConnectionState.RECONNECTING && this.reconnectionAttempts < this.maxReconnectionAttempts) {
      this.scheduleReconnection()
    }

    // Handle failed state
    if (newState === ConnectionState.FAILED) {
      this.clearReconnectionTimer()
      this.clearDegradedTimer()
    }
  }

  /**
   * Register LiveKit room event handlers
   */
  private registerRoomEvents(): void {
    if (!this.room) return

    // Connection state changes
    this.room.on('connectionStateChanged', (livekitState: LiveKitConnectionState) => {
      this.handleLiveKitStateChange(livekitState)
    })

    // Connection quality changes
    this.room.on('connectionQualityChanged', (quality: ConnectionQuality) => {
      this.handleConnectionQualityChange(quality)
    })

    // Disconnected event
    this.room.on('disconnected', (reason?: string) => {
      console.log('[ConnectionManager] Room disconnected:', reason)
      this.handleDisconnection(reason)
    })

    // Reconnecting event
    this.room.on('reconnecting', () => {
      console.log('[ConnectionManager] Room is reconnecting')
      if (this.state === ConnectionState.CONNECTED || this.state === ConnectionState.DEGRADED) {
        this.transitionTo(ConnectionState.RECONNECTING, 'LiveKit reconnecting')
      }
    })

    // Reconnected event
    this.room.on('reconnected', () => {
      console.log('[ConnectionManager] Room reconnected')
      if (this.state === ConnectionState.RECONNECTING) {
        this.transitionTo(ConnectionState.CONNECTED, 'LiveKit reconnected')
      }
    })
  }

  /**
   * Handle LiveKit connection state changes
   */
  private handleLiveKitStateChange(livekitState: LiveKitConnectionState): void {
    console.log('[ConnectionManager] LiveKit state:', livekitState)

    switch (livekitState) {
      case LiveKitConnectionState.Connecting:
        if (this.state === ConnectionState.IDLE) {
          this.transitionTo(ConnectionState.CONNECTING, 'LiveKit connecting')
        }
        break

      case LiveKitConnectionState.Connected:
        if (this.state === ConnectionState.CONNECTING || this.state === ConnectionState.RECONNECTING) {
          this.transitionTo(ConnectionState.CONNECTED, 'LiveKit connected')
        }
        break

      case LiveKitConnectionState.Reconnecting:
        if (this.state === ConnectionState.CONNECTED || this.state === ConnectionState.DEGRADED) {
          this.transitionTo(ConnectionState.RECONNECTING, 'LiveKit reconnecting')
        }
        break

      case LiveKitConnectionState.Disconnected:
        if (this.state !== ConnectionState.IDLE && this.state !== ConnectionState.DISCONNECTING) {
          this.transitionTo(ConnectionState.FAILED, 'LiveKit disconnected')
        }
        break
    }
  }

  /**
   * Handle connection quality changes
   */
  private handleConnectionQualityChange(quality: ConnectionQuality): void {
    console.log('[ConnectionManager] Connection quality:', quality)

    if (quality === ConnectionQuality.Poor) {
      if (this.state === ConnectionState.CONNECTED) {
        this.transitionTo(ConnectionState.DEGRADED, 'Poor connection quality')
        this.startDegradedMonitoring()
      }
    } else if (quality === ConnectionQuality.Good || quality === ConnectionQuality.Excellent) {
      if (this.state === ConnectionState.DEGRADED) {
        this.transitionTo(ConnectionState.CONNECTED, 'Connection quality improved')
        this.clearDegradedTimer()
      }
    }
  }

  /**
   * Start monitoring degraded connection
   */
  private startDegradedMonitoring(): void {
    this.clearDegradedTimer()

    // If degraded for >20s, trigger reconnection
    this.degradedTimer = window.setTimeout(() => {
      if (this.state === ConnectionState.DEGRADED) {
        console.log('[ConnectionManager] Connection degraded for >20s, triggering reconnection')
        this.transitionTo(ConnectionState.RECONNECTING, 'Degraded connection timeout')
      }
    }, 20000)
  }

  /**
   * Handle disconnection
   */
  private handleDisconnection(reason?: string): void {
    const error = this.classifyError(reason || 'Unknown disconnection')

    this.metrics.errors.push({
      type: error.type,
      message: error.message,
      timestamp: Date.now()
    })

    if (error.type === ErrorType.TRANSIENT && this.reconnectionAttempts < this.maxReconnectionAttempts) {
      this.transitionTo(ConnectionState.RECONNECTING, `Transient error: ${error.message}`)
    } else {
      this.transitionTo(ConnectionState.FAILED, `Fatal error: ${error.message}`)
    }
  }

  /**
   * Classify errors as transient or fatal
   */
  private classifyError(errorMessage: string): { type: ErrorType; message: string } {
    const error = errorMessage.toLowerCase()

    // Transient errors (retry possible)
    const transientPatterns = [
      'network',
      'timeout',
      'connection',
      'websocket',
      'econnrefused',
      'enotfound',
      'etimedout',
      'temporary',
      'unavailable'
    ]

    // Fatal errors (no retry)
    const fatalPatterns = [
      'unauthorized',
      'forbidden',
      'invalid token',
      'authentication',
      'permission denied',
      'not allowed'
    ]

    if (fatalPatterns.some(pattern => error.includes(pattern))) {
      return { type: ErrorType.FATAL, message: errorMessage }
    }

    if (transientPatterns.some(pattern => error.includes(pattern))) {
      return { type: ErrorType.TRANSIENT, message: errorMessage }
    }

    // Default to transient for unknown errors (safer to retry)
    return { type: ErrorType.TRANSIENT, message: errorMessage }
  }

  /**
   * Calculate exponential backoff delay with jitter
   */
  private calculateBackoffDelay(attemptNumber: number): number {
    // Base delay: 1s, 2s, 4s
    const baseDelay = Math.min(1000 * Math.pow(2, attemptNumber), 4000)

    // Add jitter: ±25%
    const jitter = baseDelay * 0.25 * (Math.random() - 0.5) * 2

    return Math.round(baseDelay + jitter)
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnection(): void {
    this.clearReconnectionTimer()

    const delay = this.calculateBackoffDelay(this.reconnectionAttempts)
    console.log(`[ConnectionManager] Scheduling reconnection attempt ${this.reconnectionAttempts + 1}/${this.maxReconnectionAttempts} in ${delay}ms`)

    this.reconnectionTimer = window.setTimeout(async () => {
      await this.attemptReconnection()
    }, delay)
  }

  /**
   * Attempt to reconnect to the room
   */
  async attemptReconnection(): Promise<void> {
    if (!this.room) {
      console.error('[ConnectionManager] No room to reconnect')
      this.transitionTo(ConnectionState.FAILED, 'No room instance')
      return
    }

    this.reconnectionAttempts++
    this.metrics.reconnectionAttempts++

    console.log(`[ConnectionManager] Reconnection attempt ${this.reconnectionAttempts}/${this.maxReconnectionAttempts}`)

    try {
      // LiveKit handles reconnection internally
      // We just need to monitor the state changes
      // If room is already attempting reconnection, this is a no-op
      if (this.room.state === LiveKitConnectionState.Disconnected) {
        // Room completely disconnected, manual reconnection needed
        // This would require the SessionManager to recreate the connection
        console.log('[ConnectionManager] Room fully disconnected, manual reconnection required')
        this.transitionTo(ConnectionState.FAILED, 'Room disconnected, manual reconnection needed')
      }
    } catch (error) {
      console.error('[ConnectionManager] Reconnection attempt failed:', error)

      if (this.reconnectionAttempts >= this.maxReconnectionAttempts) {
        this.transitionTo(ConnectionState.FAILED, `Max reconnection attempts (${this.maxReconnectionAttempts}) reached`)
      } else {
        // Schedule next attempt
        this.scheduleReconnection()
      }
    }
  }

  /**
   * Manually trigger reconnection
   */
  async triggerReconnection(): Promise<void> {
    if (this.state === ConnectionState.CONNECTED || this.state === ConnectionState.DEGRADED) {
      this.reconnectionAttempts = 0
      this.transitionTo(ConnectionState.RECONNECTING, 'Manual reconnection triggered')
    }
  }

  /**
   * Start connecting (called when session starts)
   */
  startConnecting(): void {
    if (this.state === ConnectionState.IDLE) {
      this.metrics.connectionAttempts++
      this.transitionTo(ConnectionState.CONNECTING, 'Session start')
    }
  }

  /**
   * Mark as connected (called after successful connection)
   */
  markConnected(): void {
    if (this.state === ConnectionState.CONNECTING) {
      this.transitionTo(ConnectionState.CONNECTED, 'Connection established')
    }
  }

  /**
   * Start disconnecting
   */
  startDisconnecting(): void {
    if (this.state !== ConnectionState.IDLE && this.state !== ConnectionState.FAILED) {
      this.transitionTo(ConnectionState.DISCONNECTING, 'Session end')
      this.clearReconnectionTimer()
      this.clearDegradedTimer()
    }
  }

  /**
   * Mark as disconnected (cleanup complete)
   */
  markDisconnected(): void {
    if (this.state === ConnectionState.DISCONNECTING) {
      this.transitionTo(ConnectionState.IDLE, 'Cleanup complete')
    }
  }

  /**
   * Reset to initial state
   */
  reset(): void {
    this.clearReconnectionTimer()
    this.clearDegradedTimer()
    this.reconnectionAttempts = 0
    this.state = ConnectionState.IDLE
    this.room = null
    console.log('[ConnectionManager] Reset to idle state')
  }

  /**
   * Clear reconnection timer
   */
  private clearReconnectionTimer(): void {
    if (this.reconnectionTimer !== null) {
      clearTimeout(this.reconnectionTimer)
      this.reconnectionTimer = null
    }
  }

  /**
   * Clear degraded monitoring timer
   */
  private clearDegradedTimer(): void {
    if (this.degradedTimer !== null) {
      clearTimeout(this.degradedTimer)
      this.degradedTimer = null
    }
  }

  /**
   * Cleanup all resources
   */
  destroy(): void {
    this.clearReconnectionTimer()
    this.clearDegradedTimer()
    this.stateChangeListeners = []
    this.room = null
    this.state = ConnectionState.IDLE
    console.log('[ConnectionManager] Destroyed')
  }
}
