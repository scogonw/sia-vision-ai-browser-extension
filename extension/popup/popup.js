// Popup UI Controller
class PopupController {
  constructor() {
    this.currentState = 'idle';
    this.sessionStartTime = null;
    this.durationInterval = null;
    this.isMuted = false;
  }

  async initialize() {
    // Check authentication status
    const token = await this.getStoredToken();

    if (token && !this.isTokenExpired(token)) {
      this.showView('idle');
    } else {
      this.showView('auth');
    }

    // Set up event listeners
    this.setupEventListeners();

    // Check if there's an active session
    await this.checkActiveSession();
  }

  setupEventListeners() {
    // Auth button
    document.getElementById('auth-btn')?.addEventListener('click', () => {
      this.handleAuth();
    });

    // Start support button
    document.getElementById('start-support-btn')?.addEventListener('click', () => {
      this.handleStartSupport();
    });

    // Mute button
    document.getElementById('mute-btn')?.addEventListener('click', () => {
      this.handleMuteToggle();
    });

    // End call button
    document.getElementById('end-call-btn')?.addEventListener('click', () => {
      this.handleEndCall();
    });

    // Logout button
    document.getElementById('logout-btn')?.addEventListener('click', () => {
      this.handleLogout();
    });

    // Retry button
    document.getElementById('retry-btn')?.addEventListener('click', () => {
      this.handleRetry();
    });

    // Listen for background messages
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleBackgroundMessage(message);
    });
  }

  async handleAuth() {
    this.showView('connecting');

    try {
      // Send message to background to handle OAuth
      const response = await chrome.runtime.sendMessage({
        type: 'AUTHENTICATE'
      });

      if (response.success) {
        this.showView('idle');
      } else {
        this.showError('Authentication failed. Please try again.');
      }
    } catch (error) {
      console.error('Auth error:', error);
      this.showError('Authentication failed. Please try again.');
    }
  }

  async handleStartSupport() {
    this.showView('connecting');

    try {
      // Request microphone permission first
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop()); // Stop the test stream

      // Send message to background to start session
      const response = await chrome.runtime.sendMessage({
        type: 'START_SESSION'
      });

      if (response.success) {
        this.sessionStartTime = Date.now();
        this.startDurationTimer();
        this.showView('connected');

        // Request screen sharing
        setTimeout(() => this.requestScreenShare(), 1000);
      } else {
        this.showError(response.error || 'Failed to start session. Please try again.');
      }
    } catch (error) {
      console.error('Start session error:', error);
      if (error.name === 'NotAllowedError') {
        this.showError('Microphone access is required for IT support. Please grant permission and try again.');
      } else {
        this.showError('Failed to start session. Please try again.');
      }
    }
  }

  async requestScreenShare() {
    try {
      // Get available sources
      const sources = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          type: 'GET_SCREEN_SOURCES'
        }, resolve);
      });

      // For now, we'll use chrome.desktopCapture
      // In a production app, you'd show a custom picker UI
      console.log('Screen sharing will be initiated by the background script');
    } catch (error) {
      console.error('Screen share request error:', error);
    }
  }

  handleMuteToggle() {
    this.isMuted = !this.isMuted;

    const btn = document.getElementById('mute-btn');
    const icon = btn.querySelector('.icon');
    const text = btn.querySelector('span');

    if (this.isMuted) {
      text.textContent = 'Unmute';
      icon.innerHTML = `
        <path d="M1 1l22 22M17 8l-10 10"/>
        <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/>
        <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"/>
        <line x1="12" y1="19" x2="12" y2="23"/>
        <line x1="8" y1="23" x2="16" y2="23"/>
      `;
    } else {
      text.textContent = 'Mute';
      icon.innerHTML = `
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>
      `;
    }

    // Send message to background
    chrome.runtime.sendMessage({
      type: 'TOGGLE_MUTE',
      muted: this.isMuted
    });
  }

  async handleEndCall() {
    const confirmed = confirm('Are you sure you want to end this support session?');

    if (confirmed) {
      this.stopDurationTimer();
      this.showView('connecting');

      try {
        await chrome.runtime.sendMessage({
          type: 'END_SESSION'
        });

        // Show feedback dialog (in a real app, this would be more sophisticated)
        setTimeout(() => {
          alert('Thank you for using Scogo AI Support! Please rate your experience.');
          this.showView('idle');
        }, 500);
      } catch (error) {
        console.error('End session error:', error);
        this.showView('idle');
      }
    }
  }

  async handleLogout() {
    const confirmed = confirm('Are you sure you want to sign out?');

    if (confirmed) {
      await chrome.runtime.sendMessage({
        type: 'LOGOUT'
      });

      this.showView('auth');
    }
  }

  handleRetry() {
    this.showView('idle');
  }

  handleBackgroundMessage(message) {
    switch (message.type) {
      case 'SESSION_CONNECTED':
        this.showView('connected');
        break;
      case 'SESSION_DISCONNECTED':
        this.stopDurationTimer();
        this.showView('idle');
        break;
      case 'SESSION_ERROR':
        this.showError(message.error);
        break;
      case 'AGENT_JOINED':
        console.log('AI agent joined the session');
        break;
    }
  }

  async checkActiveSession() {
    const response = await chrome.runtime.sendMessage({
      type: 'CHECK_SESSION'
    });

    if (response.active) {
      this.sessionStartTime = response.startTime;
      this.startDurationTimer();
      this.showView('connected');
    }
  }

  showView(viewName) {
    // Hide all views
    document.querySelectorAll('.view').forEach(view => {
      view.classList.remove('active');
    });

    // Show the specified view
    const view = document.getElementById(`${viewName}-view`);
    if (view) {
      view.classList.add('active');
    }

    this.currentState = viewName;
  }

  showError(message) {
    document.getElementById('error-message').textContent = message;
    this.showView('error');
  }

  startDurationTimer() {
    this.durationInterval = setInterval(() => {
      if (this.sessionStartTime) {
        const duration = Date.now() - this.sessionStartTime;
        const minutes = Math.floor(duration / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        document.getElementById('session-duration').textContent =
          `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      }
    }, 1000);
  }

  stopDurationTimer() {
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }
  }

  async getStoredToken() {
    const result = await chrome.storage.local.get('auth_token');
    return result.auth_token;
  }

  isTokenExpired(token) {
    if (!token || !token.expires_at) return true;
    return Date.now() > token.expires_at;
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const controller = new PopupController();
  controller.initialize();
});
