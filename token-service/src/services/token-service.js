import { AccessToken } from 'livekit-server-sdk';
import { v4 as uuidv4 } from 'uuid';

export class TokenService {
  constructor() {
    this.apiKey = process.env.LIVEKIT_API_KEY;
    this.apiSecret = process.env.LIVEKIT_API_SECRET;
    this.serverUrl = process.env.LIVEKIT_URL;

    if (!this.apiKey || !this.apiSecret || !this.serverUrl) {
      throw new Error('LiveKit credentials not configured');
    }
  }

  async generateToken(request) {
    try {
      const { userId, sessionType, metadata } = request;

      // Create unique room name
      const roomName = `support-${sessionType}-${uuidv4()}`;

      // Create access token
      const accessToken = new AccessToken(this.apiKey, this.apiSecret, {
        identity: userId,
        name: userId,
        metadata: JSON.stringify({
          userId,
          sessionType,
          ...metadata
        })
      });

      // Add grants
      accessToken.addGrant({
        room: roomName,
        roomJoin: true,
        canPublish: true,
        canPublishData: true,
        canSubscribe: true
      });

      // Generate JWT
      const jwt = await accessToken.toJwt();

      // Log session creation (in production, save to database)
      console.log('Token generated:', {
        userId,
        roomName,
        sessionType,
        timestamp: new Date().toISOString()
      });

      // Return token info
      return {
        accessToken: jwt,
        serverUrl: this.serverUrl,
        roomName: roomName,
        expiresAt: Date.now() + (6 * 60 * 60 * 1000), // 6 hours
        sessionId: uuidv4()
      };
    } catch (error) {
      console.error('Error generating token:', error);
      throw new Error('Failed to generate access token');
    }
  }

  async validateToken(token) {
    // Implement token validation if needed
    // This would verify the JWT signature and expiration
    return true;
  }
}
