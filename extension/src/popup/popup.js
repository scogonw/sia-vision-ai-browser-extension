// DOM Elements
const statusText = document.getElementById('status-text')
const statusDot = document.getElementById('status-dot')
const loginButton = document.getElementById('login-button')
const startButton = document.getElementById('start-button')
const endButton = document.getElementById('end-button')
const muteButton = document.getElementById('mute-button')
const feedbackButton = document.getElementById('feedback-button')
const feedbackSection = document.getElementById('feedback-section')
const ratingStars = document.getElementById('rating-stars')
const commentInput = document.getElementById('comment')
const submitFeedbackBtn = document.getElementById('submit-feedback')
const cancelFeedbackBtn = document.getElementById('cancel-feedback')
const errorBanner = document.getElementById('error')
const errorText = document.getElementById('error-text')
const successBanner = document.getElementById('success')
const successText = document.getElementById('success-text')
const sessionSection = document.getElementById('session-section')
const authSection = document.getElementById('auth-section')
const activeControls = document.getElementById('active-controls')
const callTimer = document.getElementById('call-timer')

// State
let isMuted = false
let currentSession = null
let callStartTime = null
let timerInterval = null
let selectedRating = 0

// Utility Functions
const sendMessage = (payload) => new Promise((resolve) => {
  chrome.runtime.sendMessage(payload, resolve)
})

const showError = (message) => {
  errorText.textContent = message
  errorBanner.classList.remove('hidden')
  setTimeout(() => {
    errorBanner.classList.add('hidden')
  }, 5000)
}

const showSuccess = (message) => {
  successText.textContent = message
  successBanner.classList.remove('hidden')
  setTimeout(() => {
    successBanner.classList.add('hidden')
  }, 3000)
}

const clearAlerts = () => {
  errorBanner.classList.add('hidden')
  successBanner.classList.add('hidden')
}

const updateStatusDot = (state) => {
  statusDot.className = 'status-dot ' + state
}

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

const startCallTimer = () => {
  callStartTime = Date.now()
  timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - callStartTime) / 1000)
    callTimer.textContent = formatTime(elapsed)
  }, 1000)
}

const stopCallTimer = () => {
  if (timerInterval) {
    clearInterval(timerInterval)
    timerInterval = null
  }
  callTimer.textContent = '00:00'
}

// UI State Management
const updateUiState = (state) => {
  switch (state) {
    case 'authenticated':
      authSection.classList.add('hidden')
      sessionSection.classList.remove('hidden')
      statusText.textContent = 'Ready to help'
      updateStatusDot('idle')
      break

    case 'connecting':
      statusText.textContent = 'Connecting...'
      updateStatusDot('connecting')
      startButton.disabled = true
      break

    case 'connected':
      startButton.classList.add('hidden')
      activeControls.classList.remove('hidden')
      feedbackButton.classList.remove('hidden')
      statusText.textContent = 'Session active'
      updateStatusDot('listening')
      startCallTimer()
      break

    case 'idle':
      startButton.classList.remove('hidden')
      startButton.disabled = false
      activeControls.classList.add('hidden')
      feedbackButton.classList.add('hidden')
      feedbackSection.classList.add('hidden')
      statusText.textContent = 'Ready to help'
      updateStatusDot('idle')
      stopCallTimer()
      isMuted = false
      muteButton.classList.remove('muted')
      currentSession = null
      break

    default:
      break
  }
}

// Authentication
const authenticate = async () => {
  clearAlerts()
  try {
    const response = await sendMessage({ type: 'LOGIN' })
    if (!response?.success) {
      showError(response?.error || 'Authentication failed')
      return
    }
    updateUiState('authenticated')
    showSuccess('Authentication successful!')
  } catch (error) {
    showError('Authentication error: ' + error.message)
  }
}

const checkAuth = async () => {
  try {
    const response = await sendMessage({ type: 'AUTH_STATUS' })
    if (response?.isAuthenticated) {
      updateUiState('authenticated')
    }
  } catch (error) {
    console.error('Auth check failed:', error)
  }
}

// Request microphone permission in the side panel
const requestMicrophonePermission = async () => {
  try {
    console.log('[Popup] Requesting microphone permission in side panel...')
    // Request microphone permission in the visible side panel context
    // This will trigger the browser's permission prompt
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    })
    console.log('[Popup] Microphone permission granted in side panel')
    // Stop the stream immediately - we just needed to request permission
    stream.getTracks().forEach(track => track.stop())
    return true
  } catch (error) {
    console.error('[Popup] Microphone permission denied:', error)
    if (error.name === 'NotAllowedError') {
      throw new Error('Microphone access denied. Please allow microphone access to start the session.')
    } else if (error.name === 'NotFoundError') {
      throw new Error('No microphone found. Please connect a microphone and try again.')
    } else {
      throw new Error(`Failed to access microphone: ${error.message}`)
    }
  }
}

// Session Management
const startSession = async () => {
  clearAlerts()
  updateUiState('connecting')

  try {
    // Step 1: Request microphone permission in the side panel FIRST
    // This ensures the permission prompt appears to the user
    await requestMicrophonePermission()

    // Step 2: Now that permission is granted, start the session
    const response = await sendMessage({ type: 'START_SESSION' })
    if (!response?.success) {
      showError(response?.error || 'Could not start session')
      updateUiState('idle')
      return
    }
    currentSession = response.sessionInfo
    updateUiState('connected')
    showSuccess('Connected to support!')
  } catch (error) {
    showError('Connection error: ' + error.message)
    updateUiState('idle')
  }
}

const endSession = async () => {
  clearAlerts()
  try {
    await sendMessage({ type: 'END_SESSION' })
    const duration = callTimer.textContent
    updateUiState('idle')
    showSuccess(`Session ended (${duration})`)

    // Show feedback prompt after a short delay
    setTimeout(() => {
      if (!feedbackSection.classList.contains('hidden')) return
      openFeedback()
    }, 1500)
  } catch (error) {
    showError('Error ending session: ' + error.message)
  }
}

const toggleMute = async () => {
  isMuted = !isMuted

  try {
    await sendMessage({ type: 'MUTE_MICROPHONE', muted: isMuted })

    if (isMuted) {
      muteButton.classList.add('muted')
      statusText.textContent = 'Microphone muted'
      updateStatusDot('idle')
    } else {
      muteButton.classList.remove('muted')
      statusText.textContent = 'Session active'
      updateStatusDot('listening')
    }
  } catch (error) {
    showError('Error toggling mute: ' + error.message)
    // Revert state on error
    isMuted = !isMuted
  }
}

// Feedback System
const openFeedback = () => {
  feedbackSection.classList.remove('hidden')
  sessionSection.style.display = 'none'
  // Reset feedback form
  selectedRating = 0
  updateStarRating(0)
  commentInput.value = ''
}

const closeFeedback = () => {
  feedbackSection.classList.add('hidden')
  sessionSection.style.display = 'block'
}

const updateStarRating = (rating) => {
  const stars = ratingStars.querySelectorAll('.star-btn')
  stars.forEach((star, index) => {
    if (index < rating) {
      star.classList.add('active')
    } else {
      star.classList.remove('active')
    }
  })
}

const handleStarClick = (event) => {
  const star = event.target.closest('.star-btn')
  if (!star) return

  selectedRating = Number(star.dataset.rating)
  updateStarRating(selectedRating)
}

const submitFeedbackForm = async () => {
  if (selectedRating === 0) {
    showError('Please select a rating')
    return
  }

  if (!currentSession) {
    showError('No session data available')
    return
  }

  clearAlerts()

  try {
    const response = await sendMessage({
      type: 'SUBMIT_FEEDBACK',
      payload: {
        sessionId: currentSession.sessionId,
        rating: selectedRating,
        comment: commentInput.value
      }
    })

    if (!response?.success) {
      showError(response?.error || 'Failed to submit feedback')
      return
    }

    closeFeedback()
    showSuccess('Thank you for your feedback!')
    commentInput.value = ''
    selectedRating = 0
    updateStarRating(0)
  } catch (error) {
    showError('Error submitting feedback: ' + error.message)
  }
}

// Event Listeners
loginButton.addEventListener('click', authenticate)
startButton.addEventListener('click', startSession)
endButton.addEventListener('click', endSession)
muteButton.addEventListener('click', toggleMute)
feedbackButton.addEventListener('click', openFeedback)
submitFeedbackBtn.addEventListener('click', submitFeedbackForm)
cancelFeedbackBtn.addEventListener('click', closeFeedback)
ratingStars.addEventListener('click', handleStarClick)

// Star hover effect
ratingStars.addEventListener('mouseover', (event) => {
  const star = event.target.closest('.star-btn')
  if (!star) return
  const rating = Number(star.dataset.rating)
  updateStarRating(rating)
})

ratingStars.addEventListener('mouseout', () => {
  updateStarRating(selectedRating)
})

// Initialize
checkAuth()
