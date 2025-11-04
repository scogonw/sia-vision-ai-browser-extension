// Session Manager for LiveKit connections
import { Room, RoomEvent, Track, createLocalAudioTrack, createLocalScreenTrack } from 'livekit-client';

export class SessionManager {
  constructor() {
    this.room = null;
    this.isConnected = false;
    this.screenTrack = null;
    this.audioTrack = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 3;
    this.connectionState = 'idle';
    this.byteStreamWriter = null;
  }

  async startSession(livekitUrl, token) {
    try {
      console.log('Starting LiveKit session...');

      // Initialize room
      this.room = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: { width: 1280, height: 720 }
        }
      });

      // Set up event listeners
      this.setupRoomEventListeners();

      // Connect to room
      await this.room.connect(livekitUrl, token);
      console.log('Connected to LiveKit room:', this.room.name);

      this.isConnected = true;
      this.connectionState = 'connected';

      // Enable microphone
      await this.enableMicrophone();

      // Enable screen sharing
      await this.enableScreenShare();

      return { success: true };
    } catch (error) {
      console.error('Failed to start session:', error);
      return { success: false, error: error.message };
    }
  }

  async enableMicrophone() {
    try {
      console.log('Enabling microphone...');

      this.audioTrack = await createLocalAudioTrack({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      });

      await this.room.localParticipant.publishTrack(this.audioTrack, {
        name: 'microphone',
        source: Track.Source.Microphone
      });

      console.log('Microphone enabled');
    } catch (error) {
      console.error('Failed to enable microphone:', error);
      throw error;
    }
  }

  async enableScreenShare() {
    try {
      console.log('Enabling screen share...');

      // Request screen sharing permission
      const streamId = await new Promise((resolve, reject) => {
        chrome.desktopCapture.chooseDesktopMedia(
          ['screen', 'window', 'tab'],
          (streamId) => {
            if (streamId) {
              resolve(streamId);
            } else {
              reject(new Error('User cancelled screen sharing'));
            }
          }
        );
      });

      // Get the media stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: streamId
          }
        }
      });

      // Get the video track
      const videoTrack = stream.getVideoTracks()[0];

      // Publish the screen share track
      await this.room.localParticipant.publishTrack(videoTrack, {
        name: 'screen-share',
        source: Track.Source.ScreenShare,
        simulcast: false
      });

      console.log('Screen sharing enabled');

      // Handle screen share stopped
      videoTrack.onended = () => {
        console.log('Screen sharing stopped by user');
        this.handleScreenShareStopped();
      };

      // Start frame sampling for vision input
      this.startFrameSampling(videoTrack);

    } catch (error) {
      console.error('Failed to enable screen share:', error);
      // Don't throw - allow voice-only mode
    }
  }

  async startFrameSampling(videoTrack) {
    // Create a video element to capture frames
    const video = document.createElement('video');
    video.srcObject = new MediaStream([videoTrack]);
    video.play();

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Sample frames at 1 fps
    const captureFrame = async () => {
      if (!this.isConnected || !this.room) return;

      try {
        canvas.width = Math.min(video.videoWidth, 1024);
        canvas.height = Math.min(video.videoHeight, 1024);

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Convert to JPEG blob
        const blob = await new Promise(resolve => {
          canvas.toBlob(resolve, 'image/jpeg', 0.85);
        });

        if (blob) {
          // Send frame via byte stream
          await this.sendFrameViaByteStream(blob);
        }
      } catch (error) {
        console.error('Error capturing frame:', error);
      }

      // Continue sampling
      if (this.isConnected) {
        setTimeout(captureFrame, 1000); // 1 fps
      }
    };

    // Start capturing when video is ready
    video.onloadedmetadata = () => {
      captureFrame();
    };
  }

  async sendFrameViaByteStream(blob) {
    try {
      // Use LiveKit's byte stream API to send frames
      if (!this.byteStreamWriter) {
        this.byteStreamWriter = await this.room.localParticipant.publishByteStream(
          'screen-frames',
          {
            name: 'vision-input',
            reliable: false // Use unreliable for better performance
          }
        );
      }

      // Convert blob to array buffer
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);

      // Send the frame
      await this.byteStreamWriter.write(uint8Array);
    } catch (error) {
      console.error('Error sending frame via byte stream:', error);
    }
  }

  setupRoomEventListeners() {
    // Participant connected
    this.room.on(RoomEvent.ParticipantConnected, (participant) => {
      console.log('Participant connected:', participant.identity);

      if (participant.identity === 'ai-agent' || participant.metadata?.includes('agent')) {
        this.notifyPopup({ type: 'AGENT_JOINED' });
      }
    });

    // Track subscribed (agent audio)
    this.room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
      console.log('Track subscribed:', track.kind, 'from', participant.identity);

      if (track.kind === Track.Kind.Audio) {
        // Attach and play agent audio
        const audioElement = track.attach();
        document.body.appendChild(audioElement);
        audioElement.play().catch(e => console.error('Failed to play audio:', e));
      }
    });

    // Connection quality changed
    this.room.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
      console.log('Connection quality:', quality, 'for', participant.identity);
    });

    // Reconnecting
    this.room.on(RoomEvent.Reconnecting, () => {
      console.log('Reconnecting...');
      this.connectionState = 'reconnecting';
    });

    // Reconnected
    this.room.on(RoomEvent.Reconnected, () => {
      console.log('Reconnected');
      this.connectionState = 'connected';
      this.reconnectAttempts = 0;
    });

    // Disconnected
    this.room.on(RoomEvent.Disconnected, (reason) => {
      console.log('Disconnected:', reason);
      this.handleDisconnection(reason);
    });
  }

  async toggleMute(muted) {
    if (this.audioTrack) {
      if (muted) {
        this.audioTrack.mute();
      } else {
        this.audioTrack.unmute();
      }
      return true;
    }
    return false;
  }

  async endSession() {
    try {
      console.log('Ending session...');

      // Stop all tracks
      if (this.screenTrack) {
        this.screenTrack.stop();
      }
      if (this.audioTrack) {
        this.audioTrack.stop();
      }

      // Close byte stream writer
      if (this.byteStreamWriter) {
        await this.byteStreamWriter.close();
        this.byteStreamWriter = null;
      }

      // Disconnect from room
      if (this.room) {
        await this.room.disconnect();
      }

      // Cleanup
      this.isConnected = false;
      this.connectionState = 'idle';
      this.room = null;

      this.notifyPopup({ type: 'SESSION_DISCONNECTED' });
    } catch (error) {
      console.error('Error ending session:', error);
    }
  }

  handleScreenShareStopped() {
    console.log('Handling screen share stopped');
    // User can continue with voice-only, or we can prompt them to reshare
    this.notifyPopup({
      type: 'SCREEN_SHARE_STOPPED',
      message: 'Screen sharing has stopped. Voice support is still active.'
    });
  }

  handleDisconnection(reason) {
    this.isConnected = false;
    this.connectionState = 'disconnected';

    this.notifyPopup({
      type: 'SESSION_DISCONNECTED',
      reason: reason
    });
  }

  notifyPopup(message) {
    // Send message to popup
    chrome.runtime.sendMessage(message).catch(err => {
      // Popup might not be open
      console.log('Could not send to popup:', err.message);
    });
  }

  getConnectionState() {
    return {
      isConnected: this.isConnected,
      connectionState: this.connectionState,
      roomName: this.room?.name
    };
  }
}
