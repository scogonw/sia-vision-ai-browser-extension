# Interface: LiveKit WebRTC Platform

## Overview
LiveKit is a cloud-based WebRTC infrastructure for real-time audio/video streaming, used as the transport layer between Chrome extension and AI agent.

## Endpoints
```
WebSocket: wss://<your-project>.livekit.cloud
HTTP API: https://<your-project>.livekit.cloud
```

## Authentication
```javascript
// JWT Token Generation (Backend)
const token = new AccessToken(apiKey, apiSecret, {
  identity: userId,
  name: userName,
})
token.addGrant({
  room: roomName,
  roomJoin: true,
  canPublish: true,
  canSubscribe: true,
})
const jwt = token.toJwt()
```

## Room Management

### Creating/Joining Room
```javascript
// Client SDK
import { Room } from 'livekit-client'

const room = new Room()
await room.connect(livekitHost, livekitToken)
```

### Publishing Tracks
```javascript
// Audio (Microphone)
const audioTrack = await createLocalAudioTrack({
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
})
await room.localParticipant.publishTrack(audioTrack, {
  source: Track.Source.Microphone,
})

// Screen Share
const screenTracks = await createLocalScreenTracks({
  audio: true,
  resolution: VideoPresets.h1080,
})
for (const track of screenTracks) {
  await room.localParticipant.publishTrack(track)
}
```

### Subscribing to Tracks
```javascript
room.on('trackSubscribed', (track, publication, participant) => {
  if (track.kind === 'audio') {
    const audioElement = track.attach()
    audioElement.play()
  }
})
```

## Room Naming Convention
```
support-{organization}-{userId}-{randomHex}
Example: support-default-dev-user-242d0ee3
```

## Agent Worker Pattern
```python
# Python Agent SDK
from livekit.agents import JobContext, WorkerOptions, cli

async def entrypoint(ctx: JobContext):
    await ctx.connect()  # Join room automatically
    # Agent logic here
    await asyncio.Event().wait()  # Keep alive

cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
```

## Configuration Requirements

### Environment Variables
```bash
LIVEKIT_API_KEY=<your-key>
LIVEKIT_API_SECRET=<your-secret>
LIVEKIT_HOST=wss://<your-project>.livekit.cloud
```

### Permissions
- Microphone access (user prompt)
- Screen capture (user prompt)
- Network WebSocket connections

## Track Types
- **Audio**: Microphone input, AI voice output
- **Video**: Screen share (optional)
- **Data**: Custom metadata (not used currently)

## Events

### Connection Events
- `connected`: Room connection established
- `disconnected`: Connection lost
- `reconnecting`: Attempting reconnection
- `connectionQualityChanged`: Network quality indicator

### Participant Events
- `participantConnected`: New participant (e.g., AI agent) joined
- `participantDisconnected`: Participant left

### Track Events
- `trackPublished`: New track available
- `trackSubscribed`: Track data received
- `trackUnpublished`: Track removed

## Performance Characteristics
- Latency: 100-300ms typical
- Audio codec: Opus (default)
- Video codec: VP8/VP9/H.264
- Adaptive bitrate: Automatic

## Error Handling
- **Connection Failed**: Check API key/secret, network connectivity
- **Token Invalid**: Regenerate JWT token
- **Track Publish Failed**: Check permissions, codec support
- **Worker Connection Closed**: Agent disconnected, check agent logs

## Best Practices
1. Use unique room names per session
2. Clean up tracks on session end (unpublish)
3. Handle reconnection logic
4. Monitor connection quality
5. Set appropriate video resolution for screen share
6. Use echoCancellation/noiseSuppression for voice

## Container Networking (Docker)
```yaml
# docker-compose.yml
services:
  agent:
    environment:
      - LIVEKIT_HOST=wss://scogo-vision-ai-unf1hkjy.livekit.cloud  # External URL
```
**Note**: Use external LiveKit cloud URL, not localhost, from containers.

## Related Interfaces
- Google Gemini Live API
- Chrome Extension Media APIs
