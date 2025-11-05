// Request microphone permission in a full tab context
// This is necessary because side panels cannot show permission prompts

const statusEl = document.getElementById('status')

async function requestMicrophonePermission() {
  try {
    console.log('[Permission Request] Requesting microphone access...')
    statusEl.textContent = 'Requesting microphone access...'
    statusEl.className = 'status requesting'

    // Request microphone access - this will show the browser's permission prompt
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    })

    console.log('[Permission Request] Microphone access granted!')
    statusEl.textContent = '✓ Microphone access granted! You can close this tab now.'
    statusEl.className = 'status success'

    // Stop the stream immediately - we only needed to request permission
    stream.getTracks().forEach(track => track.stop())

    // Close the tab after a short delay
    setTimeout(() => {
      window.close()
    }, 2000)

  } catch (error) {
    console.error('[Permission Request] Microphone access denied:', error)
    statusEl.textContent = '✗ Microphone access denied. Please try again and click "Allow".'
    statusEl.className = 'status error'

    // Give user time to read the error before closing
    setTimeout(() => {
      window.close()
    }, 5000)
  }
}

// Start the permission request immediately when page loads
requestMicrophonePermission()
