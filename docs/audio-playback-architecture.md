# Audio Track Subscription and Playback Architecture

## Executive Summary

This document defines the architecture for reliable audio track subscription and playback in the Scogo AI IT Support Assistant Chrome Extension. The system handles audio responses from a Gemini Realtime-powered LiveKit agent, ensuring reliable playback despite browser autoplay policies, network issues, and resource constraints.

## System Context

### Audio Flow
```
User speaks (microphone)
  → LiveKit Room
  → Python Agent (Gemini Realtime)
  → Audio Response Track Published
  → Chrome Extension (Offscreen Document)
  → trackSubscribed Event
  → Audio Element Creation & Playback
```

### Technology Stack
- **Frontend**: Chrome Extension (Manifest V3) with Offscreen Document
- **Real-time Communication**: LiveKit Client SDK v1.15.7
- **Agent**: LiveKit Python Agents SDK with Gemini Realtime API
- **Audio Model**: Gemini 2.0 Flash (gemini-2.0-flash-exp)

### Current State
- Initial greeting audio plays successfully
- Subsequent agent responses may not be received or played
- No browser autoplay policy handling
- No playback state monitoring or recovery
- Basic cleanup but potential memory leaks

---

## Architecture Components

### 1. Audio Track Subscription Strategy

#### Subscription Mode: AUTOMATIC (Default)
```javascript
Room({
  adaptiveStream: true,
  dynacast: true,
  autoSubscribe: true  // Default - automatic track subscription
})
```

**Rationale**: Automatic subscription is simpler and more reliable for single-agent voice assistant scenarios. Manual subscription adds unnecessary complexity.

#### Subscription Flow
```
Room.connect()
  ↓
Agent Joins Room
  ↓
Agent Publishes Audio Track (Gemini Response)
  ↓
trackSubscribed Event Fires
  ↓
Audio Element Lifecycle Begins
```

#### Event Handling Architecture
```javascript
room.on('trackSubscribed', (track, publication, participant) => {
  if (track.kind === 'audio') {
    handleAudioTrackSubscribed(track, publication, participant)
  }
})

room.on('trackUnsubscribed', (track, publication, participant) => {
  if (track.kind === 'audio') {
    handleAudioTrackUnsubscribed(track, publication, participant)
  }
})

room.on('AudioPlaybackStatusChanged', () => {
  handleAudioPlaybackStatusChange()
})
```

---

### 2. Audio Element Lifecycle Management

#### Lifecycle Stages

```
┌──────────────┐
│   CREATION   │  trackSubscribed event
└──────┬───────┘
       ↓
┌──────────────┐
│CONFIGURATION │  Set properties, add listeners
└──────┬───────┘
       ↓
┌──────────────┐
│  PLAYBACK    │  Initiate play with retry logic
│  INITIATION  │
└──────┬───────┘
       ↓
┌──────────────┐
│   ACTIVE     │  Monitor state, handle errors
│  PLAYBACK    │
└──────┬───────┘
       ↓
┌──────────────┐
│   CLEANUP    │  trackUnsubscribed or session end
└──────────────┘
```

#### Stage 1: Creation
**Trigger**: `trackSubscribed` event with `track.kind === 'audio'`

**Actions**:
```javascript
const audioElement = track.attach()  // Create HTMLAudioElement
```

**Output**: HTMLAudioElement with srcObject set to MediaStream

#### Stage 2: Configuration
**Actions**:
```javascript
// Set playback properties
audioElement.autoplay = true  // Browser hint for autoplay

// Create cleanup controller
const abortController = new AbortController()
const signal = abortController.signal

// Setup monitoring listeners
audioElement.addEventListener('playing', handlePlaying, { signal })
audioElement.addEventListener('pause', handlePause, { signal })
audioElement.addEventListener('error', handleError, { signal })
audioElement.addEventListener('ended', handleEnded, { signal })
audioElement.addEventListener('stalled', handleStalled, { signal })

// Create metadata object
const metadata = {
  element: audioElement,
  track: track,
  participant: participant,
  publication: publication,
  abortController: abortController,
  state: 'created',
  playAttempts: 0,
  createdAt: Date.now(),
  lastError: null,
  retryTimers: []
}

// Store in registry
remoteAudioElements.push(metadata)
```

#### Stage 3: Playback Initiation
**Prerequisite Check**:
```javascript
if (!room.canPlaybackAudio) {
  // Browser blocking audio playback
  // Add to pending queue for user gesture
  pendingAudioElements.push(metadata)
  showAudioEnablePrompt()
  return
}
```

**Playback with Retry**:
```javascript
async function initiatePlayback(metadata, retryCount = 0) {
  const MAX_RETRIES = 3
  const RETRY_DELAYS = [100, 300, 900]  // Exponential backoff

  try {
    metadata.playAttempts++
    metadata.state = 'initiating'

    const playPromise = metadata.element.play()
    await playPromise

    // Success - verify after delay
    setTimeout(() => verifyPlayback(metadata), 500)

  } catch (error) {
    metadata.lastError = error

    if (error.name === 'NotAllowedError') {
      // Autoplay policy blocked
      handleAutoplayBlocked(metadata)
    } else if (retryCount < MAX_RETRIES) {
      // Retry with backoff
      const delay = RETRY_DELAYS[retryCount]
      const timerId = setTimeout(() => {
        initiatePlayback(metadata, retryCount + 1)
      }, delay)
      metadata.retryTimers.push(timerId)
    } else {
      // Permanent failure
      handlePlaybackFailure(metadata)
    }
  }
}
```

#### Stage 4: Active Playback Monitoring
**State Tracking**:
```javascript
// Possible states: 'created', 'initiating', 'playing', 'paused', 'error', 'ended'

function handlePlaying(event) {
  metadata.state = 'playing'
  log('[AudioPlayback] Audio started playing', {
    participant: metadata.participant.identity
  })
}

function handlePause(event) {
  if (metadata.state === 'playing') {
    // Unexpected pause - attempt recovery
    log('[AudioPlayback] Unexpected pause detected, attempting recovery')
    initiatePlayback(metadata)
  }
}

function handleError(event) {
  metadata.state = 'error'
  metadata.lastError = event.target.error
  log('[AudioPlayback] Playback error', { error: event.target.error })

  // Attempt recovery
  initiatePlayback(metadata)
}

function handleEnded(event) {
  metadata.state = 'ended'
  log('[AudioPlayback] Track ended naturally')
  // Track will be cleaned up via trackUnsubscribed event
}
```

**Playback Verification**:
```javascript
function verifyPlayback(metadata) {
  if (metadata.element.paused && metadata.state === 'initiating') {
    // Playback did not start successfully
    log('[AudioPlayback] Playback verification failed - element still paused')
    initiatePlayback(metadata)
  } else if (!metadata.element.paused) {
    metadata.state = 'playing'
  }
}
```

#### Stage 5: Cleanup
**Trigger**: `trackUnsubscribed` event or `endSession()`

**Cleanup Sequence** (order critical):
```javascript
function cleanupAudioElement(metadata) {
  log('[AudioPlayback] Cleaning up audio element')

  // 1. Clear all retry timers
  metadata.retryTimers.forEach(timerId => clearTimeout(timerId))
  metadata.retryTimers = []

  // 2. Remove all event listeners via AbortController
  metadata.abortController.abort()

  // 3. Stop playback
  try {
    metadata.element.pause()
  } catch (e) {
    log('[AudioPlayback] Error pausing element', e)
  }

  // 4. Detach from LiveKit track
  metadata.track.detach(metadata.element)

  // 5. Clear MediaStream reference
  metadata.element.srcObject = null

  // 6. Remove from DOM if attached
  if (metadata.element.parentNode) {
    metadata.element.parentNode.removeChild(metadata.element)
  }

  // 7. Remove from registry
  const index = remoteAudioElements.indexOf(metadata)
  if (index > -1) {
    remoteAudioElements.splice(index, 1)
  }

  // 8. Clear references for garbage collection
  metadata.element = null
  metadata.track = null
  metadata.participant = null

  log('[AudioPlayback] Cleanup complete. Remaining elements:',
      remoteAudioElements.length)
}
```

---

### 3. Browser Autoplay Policy Handling

#### Autoplay Policy Challenge
Modern browsers block audio playback that isn't initiated by user interaction. This affects WebRTC audio playback.

#### Strategy: Proactive User Gesture

**Session Start Flow**:
```javascript
// In popup/side panel UI
async function startSession() {
  // This click handler provides the required user gesture

  // 1. Start LiveKit session
  const sessionInfo = await sessionManager.startSession()

  // 2. Explicitly enable audio playback (CRITICAL)
  await sessionManager.enableAudioPlayback()

  // 3. Session is now ready for audio
}
```

**SessionManager Enhancement**:
```javascript
async enableAudioPlayback() {
  if (!this.room) {
    throw new Error('Room not connected')
  }

  try {
    // Call Room.startAudio() in user gesture context
    await this.room.startAudio()
    log('[SessionManager] Audio playback enabled via user gesture')

    // Process any pending audio elements
    await this.processPendingAudio()

  } catch (error) {
    log('[SessionManager] Failed to enable audio playback', error)
    throw error
  }
}

async processPendingAudio() {
  const pending = [...this.pendingAudioElements]
  this.pendingAudioElements = []

  for (const metadata of pending) {
    await initiatePlayback(metadata)
  }
}
```

#### Fallback UI for Blocked Audio
```javascript
function showAudioEnablePrompt() {
  // Show UI button in side panel
  chrome.runtime.sendMessage({
    type: 'AUDIO_BLOCKED',
    message: 'Click to enable audio'
  })
}

// In side panel
function handleAudioBlocked() {
  // Show prominent button
  const button = document.getElementById('enable-audio-button')
  button.style.display = 'block'

  button.onclick = async () => {
    await sessionManager.enableAudioPlayback()
    button.style.display = 'none'
  }
}
```

---

### 4. Multiple Audio Track Handling

#### Scenario Analysis
With Gemini Realtime API:
- Agent publishes ONE audio track per spoken response
- Each response is a separate track publication and subscription
- Tracks typically don't overlap (agent waits for current response to finish)
- Overlap may occur during interruptions or network delays

#### Strategy: CONCURRENT PLAYBACK (No Queuing)

**Rationale**:
1. Gemini Realtime handles conversational turn-taking at the AI level
2. Natural overlap (like human interruption) may be desirable
3. Simpler architecture without queuing complexity
4. Allows for future features like background sounds or notifications

**Implementation**:
```javascript
// Allow multiple audio elements to exist and play simultaneously
// remoteAudioElements array naturally supports this

room.on('trackSubscribed', (track, publication, participant) => {
  if (track.kind === 'audio') {
    // Create new element regardless of existing elements
    // Do NOT stop or fade previous tracks
    handleAudioTrackSubscribed(track, publication, participant)
  }
})
```

**Current Count Tracking** (for debugging):
```javascript
log('[AudioPlayback] Active audio elements:', remoteAudioElements.length)
```

#### Future Enhancement: Optional Overlap Prevention
If overlap becomes problematic:
```javascript
function handleAudioTrackSubscribed(track, publication, participant) {
  // Optional: Stop previous track from same participant
  if (ENABLE_OVERLAP_PREVENTION) {
    const previousTracks = remoteAudioElements.filter(
      m => m.participant.identity === participant.identity
    )
    previousTracks.forEach(m => fadeOutAndCleanup(m))
  }

  // Continue with normal subscription
  // ...
}
```

---

### 5. Error Detection and Recovery

#### Error Categories

| Error Type | Detection Method | Recovery Strategy |
|-----------|------------------|------------------|
| Autoplay Policy | `NotAllowedError` from play() | User gesture via Room.startAudio() |
| Network Stall | `stalled` event | Wait and retry |
| Track Ended | `ended` event | No action (natural end) |
| Playback Error | `error` event | Retry with backoff |
| Context Suspended | `AudioPlaybackStatusChanged` | Resume AudioContext |
| Verification Failure | element.paused after play() | Retry |

#### Recovery Architecture

```
Error Detected
  ↓
Classify Error Type
  ↓
  ├─→ Autoplay Policy → User Gesture Required → Pending Queue
  ├─→ Transient Error → Retry Queue → Exponential Backoff
  ├─→ Track Issue → Log & Continue → Monitor for resubscription
  └─→ Critical Error → Graceful Degradation → Continue without audio
```

#### Recovery Implementation

**Retry Logic**:
```javascript
const RECOVERY_CONFIG = {
  maxRetries: 3,
  retryDelays: [100, 300, 900],  // milliseconds, exponential backoff
  verificationDelay: 500          // ms to wait before verifying playback
}

async function attemptRecovery(metadata, error) {
  const { retryCount = 0 } = metadata

  if (error.name === 'NotAllowedError') {
    // Autoplay blocked - requires user gesture
    return handleAutoplayBlocked(metadata)
  }

  if (retryCount >= RECOVERY_CONFIG.maxRetries) {
    // Exhausted retries
    return handlePermanentFailure(metadata)
  }

  // Schedule retry with backoff
  const delay = RECOVERY_CONFIG.retryDelays[retryCount]
  log(`[AudioPlayback] Scheduling retry ${retryCount + 1} in ${delay}ms`)

  const timerId = setTimeout(() => {
    metadata.retryCount = retryCount + 1
    initiatePlayback(metadata, retryCount + 1)
  }, delay)

  metadata.retryTimers.push(timerId)
}

function handleAutoplayBlocked(metadata) {
  log('[AudioPlayback] Autoplay blocked, adding to pending queue')
  metadata.state = 'pending-user-gesture'
  pendingAudioElements.push(metadata)
  showAudioEnablePrompt()
}

function handlePermanentFailure(metadata) {
  log('[AudioPlayback] Permanent playback failure', {
    participant: metadata.participant.identity,
    error: metadata.lastError,
    attempts: metadata.playAttempts
  })

  metadata.state = 'failed'

  // Notify user
  chrome.runtime.sendMessage({
    type: 'AUDIO_PLAYBACK_FAILED',
    participantId: metadata.participant.identity
  })

  // Continue session without this audio
  // Don't cleanup immediately - track may be cleaned up via trackUnsubscribed
}
```

#### State-Based Recovery
```javascript
function handleStateBasedRecovery(metadata) {
  switch (metadata.state) {
    case 'error':
      // Media error occurred
      if (metadata.element.error) {
        log('[AudioPlayback] Media error code:', metadata.element.error.code)
      }
      attemptRecovery(metadata, new Error('Media error'))
      break

    case 'paused':
      // Unexpected pause
      if (metadata.element.readyState >= 2) {  // HAVE_CURRENT_DATA
        // Media loaded, try playing again
        initiatePlayback(metadata)
      }
      break

    case 'stalled':
      // Network buffering
      // Wait for 'playing' event or timeout
      const stallTimeout = setTimeout(() => {
        if (metadata.state === 'stalled') {
          attemptRecovery(metadata, new Error('Playback stalled'))
        }
      }, 5000)
      metadata.retryTimers.push(stallTimeout)
      break
  }
}
```

---

### 6. Memory Leak Prevention

#### Leak Sources
1. Event listeners not removed
2. Audio elements not garbage collected
3. MediaStream references retained
4. Timer references not cleared
5. Circular references in metadata

#### Prevention Strategy

#### 1. AbortController Pattern
```javascript
// Modern approach for automatic event listener cleanup
const abortController = new AbortController()
const { signal } = abortController

element.addEventListener('playing', handler, { signal })
element.addEventListener('pause', handler, { signal })
element.addEventListener('error', handler, { signal })
element.addEventListener('ended', handler, { signal })

// Single call removes all listeners
abortController.abort()
```

#### 2. Reference Nullification
```javascript
function cleanupReferences(metadata) {
  // Clear object references to enable garbage collection
  metadata.element = null
  metadata.track = null
  metadata.participant = null
  metadata.publication = null
  metadata.abortController = null
  metadata.lastError = null

  // Clear from registry
  const index = remoteAudioElements.indexOf(metadata)
  if (index > -1) {
    remoteAudioElements.splice(index, 1)
  }
}
```

#### 3. Timer Management
```javascript
function clearAllTimers(metadata) {
  // Clear all retry timers
  metadata.retryTimers.forEach(timerId => {
    clearTimeout(timerId)
  })
  metadata.retryTimers = []
}
```

#### 4. MediaStream Release
```javascript
function releaseMediaStream(element) {
  // Critical: Release MediaStream to free system resources
  if (element.srcObject) {
    const tracks = element.srcObject.getTracks()
    tracks.forEach(track => track.stop())  // Stop all tracks
    element.srcObject = null
  }
}
```

#### 5. DOM Cleanup
```javascript
function cleanupDOM(element) {
  // Pause and remove from DOM
  try {
    element.pause()
  } catch (e) {
    // Ignore errors during cleanup
  }

  if (element.parentNode) {
    element.parentNode.removeChild(element)
  }

  // Some browsers require explicit property clearing
  element.src = ''
  element.load()  // Reset element state
}
```

#### Session-Level Cleanup
```javascript
async function endSession() {
  log('[SessionManager] Starting complete session cleanup')

  // 1. Remove Room event listeners first
  if (this.room) {
    this.room.removeAllListeners()
  }

  // 2. Clean up all audio elements
  // Use slice() to avoid mutation during iteration
  const elementsToClean = this.remoteAudioElements.slice()
  elementsToClean.forEach(metadata => {
    cleanupAudioElement(metadata)
  })

  // 3. Clear pending audio queue
  this.pendingAudioElements = []

  // 4. Verify cleanup
  if (this.remoteAudioElements.length > 0) {
    log('[SessionManager] WARNING: Audio elements remaining after cleanup',
        this.remoteAudioElements.length)
  }

  // 5. Disconnect from room
  if (this.room) {
    await this.room.disconnect(true)  // true = stop all tracks
    this.room = null
  }

  // 6. Reset state
  this.state = 'idle'
  this.currentSessionInfo = null

  log('[SessionManager] Session cleanup complete')
}
```

#### Cleanup Verification
```javascript
function verifyCleanup() {
  const checks = {
    audioElements: remoteAudioElements.length === 0,
    roomDisconnected: !this.room || this.room.state === 'disconnected',
    noActiveTimers: remoteAudioElements.every(m => m.retryTimers.length === 0),
    noDOM: document.querySelectorAll('audio').length === 0
  }

  log('[Cleanup Verification]', checks)

  if (!Object.values(checks).every(v => v)) {
    log('[Cleanup Verification] FAILED - potential memory leak detected')
  }
}
```

---

## Implementation Roadmap

### Phase 1: Core Audio Subscription (Priority: CRITICAL)
1. Add `Room.startAudio()` call in session start flow
2. Implement `AudioPlaybackStatusChanged` event listener
3. Add `canPlaybackAudio` check before playback initiation
4. Enhance logging for audio subscription events

### Phase 2: Playback Monitoring (Priority: HIGH)
1. Add audio element event listeners (playing, pause, error, ended)
2. Implement metadata tracking structure
3. Add playback state verification (500ms check)
4. Implement basic retry logic (3 attempts)

### Phase 3: Enhanced Recovery (Priority: MEDIUM)
1. Implement exponential backoff for retries
2. Add autoplay policy detection and pending queue
3. Create user gesture fallback UI
4. Add comprehensive error classification

### Phase 4: Memory Management (Priority: HIGH)
1. Implement AbortController for event listeners
2. Add proper cleanup sequence in trackUnsubscribed
3. Enhance endSession() cleanup with verification
4. Add timer management for retry logic

### Phase 5: Production Hardening (Priority: MEDIUM)
1. Add telemetry for playback success/failure rates
2. Implement cleanup verification checks
3. Add developer debugging tools
4. Performance testing and optimization

---

## Testing Strategy

### Unit Tests
1. Audio element lifecycle state transitions
2. Retry logic with mocked failures
3. Cleanup sequence completeness
4. Timer management

### Integration Tests
1. Full trackSubscribed to playback flow
2. Autoplay policy scenarios
3. Multiple track handling
4. Session start/end with audio

### Manual Testing Scenarios
1. **First session audio**: Verify initial greeting plays
2. **Subsequent responses**: Verify all agent responses play
3. **Browser autoplay blocking**: Test with restrictive browser settings
4. **Network interruption**: Disconnect during playback
5. **Multiple sessions**: Create/end session multiple times
6. **Memory leak test**: Create 100 sessions, check memory usage
7. **Concurrent audio**: Interrupt agent, verify both tracks play

### Metrics to Monitor
- Audio playback success rate
- Time from trackSubscribed to audio playing
- Retry attempt distribution
- Memory usage over multiple sessions
- Audio element cleanup success rate

---

## Troubleshooting Guide

### Issue: No audio playback
**Check**:
1. `room.canPlaybackAudio` value
2. Browser console for autoplay policy errors
3. `remoteAudioElements.length` - are tracks being subscribed?
4. Audio element `readyState` and `networkState`

**Fix**:
- Ensure `Room.startAudio()` is called in user gesture
- Check browser autoplay settings
- Verify agent is publishing audio tracks

### Issue: Audio plays once then stops
**Check**:
1. `trackUnsubscribed` events - is track being removed?
2. Agent logs - is agent continuing to publish?
3. Network stability

**Fix**:
- Check Gemini Realtime API session state
- Verify LiveKit connection stability
- Review agent conversation flow logic

### Issue: Memory leak (high memory usage)
**Check**:
1. `remoteAudioElements.length` after session end
2. Chrome DevTools Memory profiler for detached DOM nodes
3. Number of event listeners on window

**Fix**:
- Verify cleanup sequence is executing
- Check for missing `abortController.abort()` calls
- Ensure timers are being cleared

### Issue: Delayed audio playback
**Check**:
1. Time from `trackSubscribed` to `playing` event
2. Number of retry attempts
3. Network latency to LiveKit server

**Fix**:
- Optimize retry delays
- Check network connection quality
- Consider preemptive audio context creation

---

## Appendix: Code Structure

### Recommended File Organization
```
extension/src/lib/
├── session-manager.js           # Main SessionManager class
├── audio-playback-manager.js    # NEW: Audio playback logic
├── audio-element-registry.js    # NEW: Element tracking
└── audio-recovery-manager.js    # NEW: Error recovery logic
```

### Key Classes

#### AudioPlaybackManager
```javascript
class AudioPlaybackManager {
  constructor(room)

  // Lifecycle
  handleTrackSubscribed(track, publication, participant)
  handleTrackUnsubscribed(track, publication, participant)

  // Playback
  initiatePlayback(metadata, retryCount)
  verifyPlayback(metadata)

  // Recovery
  attemptRecovery(metadata, error)
  handleAutoplayBlocked(metadata)
  processPendingAudio()

  // Cleanup
  cleanupAudioElement(metadata)
  cleanupAll()
}
```

#### AudioElementRegistry
```javascript
class AudioElementRegistry {
  constructor()

  add(metadata)
  remove(metadata)
  getByTrack(track)
  getByParticipant(participant)
  getAll()
  clear()
  getActiveCount()
}
```

#### AudioRecoveryManager
```javascript
class AudioRecoveryManager {
  constructor(config)

  scheduleRetry(metadata, error, retryCount)
  handleAutoplayBlocked(metadata)
  handlePermanentFailure(metadata)
  clearRetries(metadata)
}
```

---

## Conclusion

This architecture provides a robust, production-ready solution for audio playback in the Scogo AI IT Support Assistant. Key strengths:

1. **Reliability**: Multi-layer retry and recovery mechanisms
2. **Browser Compatibility**: Proper autoplay policy handling
3. **Resource Management**: Comprehensive memory leak prevention
4. **Maintainability**: Clear separation of concerns and modular design
5. **Observability**: Extensive logging and state tracking

By following this architecture, the extension will provide a seamless voice interaction experience with the AI agent, handling edge cases gracefully and preventing common pitfalls in WebRTC audio playback.
