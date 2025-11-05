const statusText = document.getElementById('status-text')
const loginButton = document.getElementById('login-button')
const startButton = document.getElementById('start-button')
const endButton = document.getElementById('end-button')
const muteButton = document.getElementById('mute-button')
const feedbackButton = document.getElementById('feedback-button')
const feedbackSection = document.getElementById('feedback-section')
const ratingSelect = document.getElementById('rating')
const commentInput = document.getElementById('comment')
const submitFeedback = document.getElementById('submit-feedback')
const errorBanner = document.getElementById('error')
const sessionSection = document.getElementById('session-section')
const authSection = document.getElementById('auth-section')
const controls = document.getElementById('controls')

let isMuted = false
let currentSession = null

const sendMessage = (payload) => new Promise((resolve) => {
  chrome.runtime.sendMessage(payload, resolve)
})

const showError = (message) => {
  errorBanner.textContent = message
  errorBanner.classList.remove('hidden')
}

const clearError = () => {
  errorBanner.textContent = ''
  errorBanner.classList.add('hidden')
}

const updateUiState = (state) => {
  switch (state) {
    case 'authenticated':
      authSection.classList.add('hidden')
      sessionSection.classList.remove('hidden')
      statusText.textContent = 'Ready to connect to IT support.'
      break
    case 'connecting':
      statusText.textContent = 'Connecting to LiveKit session...'
      startButton.disabled = true
      break
    case 'connected':
      startButton.classList.add('hidden')
      endButton.classList.remove('hidden')
      controls.classList.remove('hidden')
      statusText.textContent = 'Session active. Screen is being shared.'
      break
    case 'idle':
      startButton.classList.remove('hidden')
      startButton.disabled = false
      endButton.classList.add('hidden')
      controls.classList.add('hidden')
      feedbackSection.classList.add('hidden')
      statusText.textContent = 'Ready to connect to IT support.'
      currentSession = null
      break
    default:
      break
  }
}

const authenticate = async () => {
  clearError()
  const response = await sendMessage({ type: 'LOGIN' })
  if (!response?.success) {
    showError(response?.error || 'Authentication failed')
    return
  }
  updateUiState('authenticated')
}

const checkAuth = async () => {
  const response = await sendMessage({ type: 'AUTH_STATUS' })
  if (response?.isAuthenticated) {
    updateUiState('authenticated')
  }
}

const startSession = async () => {
  clearError()
  updateUiState('connecting')
  const response = await sendMessage({ type: 'START_SESSION' })
  if (!response?.success) {
    showError(response?.error || 'Could not start session')
    updateUiState('idle')
    return
  }
  currentSession = response.sessionInfo
  updateUiState('connected')
}

const endSession = async () => {
  clearError()
  await sendMessage({ type: 'END_SESSION' })
  updateUiState('idle')
}

const toggleMute = async () => {
  isMuted = !isMuted
  muteButton.textContent = isMuted ? 'Unmute' : 'Mute'
  await sendMessage({ type: 'MUTE_MICROPHONE', muted: isMuted })
}

const openFeedback = () => {
  if (!currentSession) {
    showError('You need an active session to provide feedback.')
    return
  }
  feedbackSection.classList.remove('hidden')
}

const submitFeedbackForm = async () => {
  if (!currentSession) return
  clearError()
  const rating = Number(ratingSelect.value)
  const comment = commentInput.value

  const response = await sendMessage({
    type: 'SUBMIT_FEEDBACK',
    payload: {
      sessionId: currentSession.sessionId,
      rating,
      comment
    }
  })

  if (!response?.success) {
    showError(response?.error || 'Failed to submit feedback')
    return
  }

  feedbackSection.classList.add('hidden')
  commentInput.value = ''
  statusText.textContent = 'Thanks for the feedback!'
}

loginButton.addEventListener('click', authenticate)
startButton.addEventListener('click', startSession)
endButton.addEventListener('click', endSession)
muteButton.addEventListener('click', toggleMute)
feedbackButton.addEventListener('click', openFeedback)
submitFeedback.addEventListener('click', submitFeedbackForm)

checkAuth()
