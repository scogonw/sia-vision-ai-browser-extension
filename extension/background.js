// Background Service Worker
import { SessionManager } from './lib/session-manager.js';

// Configuration
const CONFIG = {
  // Update these with your actual backend URLs
  TOKEN_SERVICE_URL: 'https://api.scogo.ai/api/v1/token',
  LIVEKIT_URL: 'wss://your-livekit-instance.livekit.cloud',

  // For development, you can use environment-specific URLs
  // These would be replaced during build
};

class BackgroundController {
  constructor() {
    this.sessionManager = new SessionManager();
    this.sessionActive = false;
    this.sessionStartTime = null;
    this.authToken = null;
  }

  async initialize() {
    console.log('Background controller initialized');

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep channel open for async response
    });

    // Load stored auth token
    const stored = await chrome.storage.local.get('auth_token');
    if (stored.auth_token) {
      this.authToken = stored.auth_token;
    }
  }

  async handleMessage(message, sender, sendResponse) {
    console.log('Received message:', message.type);

    try {
      switch (message.type) {
        case 'AUTHENTICATE':
          await this.handleAuthenticate(sendResponse);
          break;

        case 'START_SESSION':
          await this.handleStartSession(sendResponse);
          break;

        case 'END_SESSION':
          await this.handleEndSession(sendResponse);
          break;

        case 'TOGGLE_MUTE':
          await this.handleToggleMute(message.muted, sendResponse);
          break;

        case 'CHECK_SESSION':
          this.handleCheckSession(sendResponse);
          break;

        case 'LOGOUT':
          await this.handleLogout(sendResponse);
          break;

        case 'GET_SCREEN_SOURCES':
          await this.handleGetScreenSources(sendResponse);
          break;

        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleAuthenticate(sendResponse) {
    try {
      // For MVP, we'll use a simple token-based auth
      // In production, this would use Google OAuth 2.0

      // Simulate OAuth flow
      // In a real implementation, you'd use chrome.identity.launchWebAuthFlow

      const mockToken = {
        access_token: 'mock_access_token_' + Date.now(),
        expires_at: Date.now() + (6 * 60 * 60 * 1000), // 6 hours
        user: {
          email: 'user@example.com',
          name: 'Test User'
        }
      };

      // Store token
      await chrome.storage.local.set({ auth_token: mockToken });
      this.authToken = mockToken;

      sendResponse({ success: true, token: mockToken });
    } catch (error) {
      console.error('Authentication error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleStartSession(sendResponse) {
    try {
      if (this.sessionActive) {
        sendResponse({ success: false, error: 'Session already active' });
        return;
      }

      // Get LiveKit token from backend
      const livekitToken = await this.getLiveKitToken();

      if (!livekitToken) {
        sendResponse({ success: false, error: 'Failed to get session token' });
        return;
      }

      // Start LiveKit session
      const result = await this.sessionManager.startSession(
        CONFIG.LIVEKIT_URL,
        livekitToken.accessToken
      );

      if (result.success) {
        this.sessionActive = true;
        this.sessionStartTime = Date.now();

        // Log session start
        await this.logSessionEvent('session_started', {
          roomName: livekitToken.roomName
        });

        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: result.error });
      }
    } catch (error) {
      console.error('Start session error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleEndSession(sendResponse) {
    try {
      await this.sessionManager.endSession();

      // Log session end
      const duration = this.sessionStartTime
        ? Date.now() - this.sessionStartTime
        : 0;

      await this.logSessionEvent('session_ended', {
        duration: duration
      });

      this.sessionActive = false;
      this.sessionStartTime = null;

      sendResponse({ success: true });
    } catch (error) {
      console.error('End session error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleToggleMute(muted, sendResponse) {
    try {
      const result = await this.sessionManager.toggleMute(muted);
      sendResponse({ success: result });
    } catch (error) {
      console.error('Toggle mute error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  handleCheckSession(sendResponse) {
    sendResponse({
      active: this.sessionActive,
      startTime: this.sessionStartTime
    });
  }

  async handleLogout(sendResponse) {
    try {
      // End any active session
      if (this.sessionActive) {
        await this.sessionManager.endSession();
        this.sessionActive = false;
      }

      // Clear stored credentials
      await chrome.storage.local.clear();
      this.authToken = null;

      sendResponse({ success: true });
    } catch (error) {
      console.error('Logout error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async handleGetScreenSources(sendResponse) {
    try {
      chrome.desktopCapture.chooseDesktopMedia(
        ['screen', 'window', 'tab'],
        (streamId) => {
          sendResponse({ streamId: streamId });
        }
      );
    } catch (error) {
      console.error('Get screen sources error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async getLiveKitToken() {
    try {
      if (!this.authToken) {
        throw new Error('Not authenticated');
      }

      // For development, return a mock token
      // In production, this would call your backend
      console.log('Getting LiveKit token from backend...');

      // Mock response for development
      // Replace with actual API call:
      /*
      const response = await fetch(CONFIG.TOKEN_SERVICE_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.authToken.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: this.authToken.user.email,
          sessionType: 'it-support'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get LiveKit token');
      }

      return await response.json();
      */

      // For now, return mock data
      // You'll need to replace this with actual LiveKit credentials
      return {
        accessToken: 'YOUR_LIVEKIT_TOKEN_HERE',
        serverUrl: CONFIG.LIVEKIT_URL,
        roomName: `support-${Date.now()}`,
        expiresAt: Date.now() + (6 * 60 * 60 * 1000)
      };
    } catch (error) {
      console.error('Error getting LiveKit token:', error);
      return null;
    }
  }

  async logSessionEvent(eventType, data) {
    try {
      const event = {
        type: eventType,
        timestamp: Date.now(),
        data: data
      };

      // Store locally
      const stored = await chrome.storage.local.get('session_logs');
      const logs = stored.session_logs || [];
      logs.push(event);

      // Keep only last 100 events
      if (logs.length > 100) {
        logs.shift();
      }

      await chrome.storage.local.set({ session_logs: logs });

      // In production, also send to backend analytics
      console.log('Session event:', eventType, data);
    } catch (error) {
      console.error('Error logging session event:', error);
    }
  }
}

// Initialize background controller
const controller = new BackgroundController();
controller.initialize();
