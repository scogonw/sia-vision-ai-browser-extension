# Pattern: Screen Share Analysis for AI Context

## Context
AI assistants need visual context to diagnose issues that users struggle to describe verbally, especially for UI/UX problems, error messages, or configuration screens.

## Solution
Leverage Google Gemini's native multimodal vision capabilities to analyze screen share frames directly without manual preprocessing:

1. **Screen Capture**: WebRTC screen tracks with intelligent frame extraction
2. **Frame Processing**: Compress images for optimal transmission latency
3. **Direct Transmission**: Send frames directly to Gemini Live API
4. **Native Understanding**: Gemini analyzes images without OCR or CV preprocessing
5. **Conversational Context**: Visual insights inform AI responses naturally

## Key Components

### Capture Loop (Client → LiveKit → Agent)
```
Screen Track → grabFrame() on-demand or periodic → Compress (JPEG 75-85%) → LiveKit Video Track → Agent
```

### Analysis Loop (AI Agent)
```
Receive Frame from LiveKit → Compress if needed → Send to Gemini Live API → Gemini analyzes natively → AI responds with visual context
```

## Implementation Details

### Frame Optimization for Low Latency
- **Resolution**: 1920x1080 or lower (sufficient for technical support)
- **Compression**: JPEG quality 75-85% (balance quality and speed)
- **Max size**: Target <500KB per frame for fast transmission
- **Smart Capture**: Send frames only when:
  - User explicitly requests help with what's on screen
  - AI asks to "see" something
  - Periodic (every 5-10s) during active troubleshooting

### Gemini Multimodal Integration
```python
# Agent receives screen frame from LiveKit video track
async def handle_screen_frame(frame_data: bytes):
    # Compress if needed (target <500KB)
    compressed = compress_jpeg(frame_data, quality=80)

    # Send directly to Gemini - NO manual analysis needed
    await gemini_session.send({
        "realtime_input": {
            "media_chunks": [{
                "data": base64.b64encode(compressed).decode(),
                "mime_type": "image/jpeg"
            }]
        }
    })

    # Gemini automatically:
    # - Recognizes UI elements, buttons, menus
    # - Reads text, error messages, dialogs
    # - Understands application state
    # - Identifies problems in settings, configurations
    # - Provides context-aware guidance
```

### No Preprocessing Required
**DO NOT implement**:
- ❌ OCR text extraction (pytesseract)
- ❌ OpenCV edge detection
- ❌ Manual color analysis
- ❌ Custom computer vision models

**Gemini handles natively**:
- ✅ Text recognition in any language
- ✅ UI element identification
- ✅ Error message understanding
- ✅ Application state recognition
- ✅ Visual anomaly detection

## Performance Characteristics
- **Capture latency**: <50ms per frame
- **Compression latency**: 50-100ms (JPEG encoding)
- **Transmission latency**: 100-300ms (depends on network)
- **Gemini analysis**: Integrated into response generation
- **Total latency**: ~200-500ms from capture to AI understanding
- **Bandwidth**: ~100-500KB per frame (with compression)

## Latency Optimization Strategies

### 1. Frame Rate Control
```javascript
// Extension: Intelligent frame capture
const FRAME_INTERVALS = {
  IDLE: null,              // No capture when not needed
  ON_DEMAND: 'immediate',  // User says "look at my screen"
  ACTIVE: 5000,           // Every 5s during troubleshooting
  URGENT: 2000            // Every 2s for real-time guidance
}
```

### 2. Compression Pipeline
```python
# Agent: Fast compression with quality control
def compress_frame_fast(frame_bytes: bytes) -> bytes:
    img = Image.open(io.BytesIO(frame_bytes))

    # Resize if too large (reduce processing time)
    if img.width > 1920 or img.height > 1080:
        img.thumbnail((1920, 1080), Image.LANCZOS)

    # Compress to JPEG (faster than PNG)
    output = io.BytesIO()
    img.save(output, format='JPEG', quality=80, optimize=True)

    return output.getvalue()
```

### 3. Concurrent Processing
```python
# Process audio and video in parallel
async def handle_multimodal_input(audio_chunk, video_frame):
    # Send both simultaneously - no blocking
    await asyncio.gather(
        gemini_session.send_audio(audio_chunk),
        gemini_session.send_image(video_frame)
    )
```

## LiveKit Integration

### Publishing Screen Share Track
```javascript
// Extension: Use LiveKit's built-in screen sharing
const screenTracks = await createLocalScreenTracks({
  audio: false,  // Separate microphone track
  resolution: VideoPresets.h1080,  // 1920x1080
  frameRate: 5  // Low frame rate for screen content
})

for (const track of screenTracks) {
  await room.localParticipant.publishTrack(track, {
    source: Track.Source.ScreenShare,
    simulcast: false  // Not needed for screen content
  })
}
```

### Subscribing to Screen Track (Agent)
```python
# Agent: LiveKit automatically routes screen track
@ctx.room.on("track_subscribed")
async def on_track_subscribed(
    track: rtc.Track,
    publication: rtc.TrackPublication,
    participant: rtc.RemoteParticipant
):
    if track.kind == rtc.TrackKind.KIND_VIDEO:
        if publication.source == rtc.TrackSource.SOURCE_SCREEN_SHARE:
            # Extract frames from video track
            async for frame in track:
                await process_screen_frame(frame)
```

## Privacy Considerations
- **Opt-in only**: Explicit user consent before screen sharing
- **Selective sharing**: Browser built-in tab/window selection
- **No permanent storage**: Frames processed in real-time only
- **User control**: Pause/resume screen sharing anytime
- **Data retention**: No frame storage beyond session lifetime
- **Compliance**: Follows GDPR/privacy regulations

## Environment Configuration
All critical values must be in environment variables:

```bash
# .env
SCREEN_SHARE_ENABLED=true
SCREEN_SHARE_COMPRESSION_QUALITY=80  # 1-100
SCREEN_SHARE_MAX_RESOLUTION=1920x1080
SCREEN_SHARE_FRAME_INTERVAL_MS=5000  # Periodic capture
```

## Trade-offs
- **Pros**:
  - Native Gemini understanding (no manual analysis)
  - Lower latency (no OCR/CV preprocessing)
  - Better accuracy (Gemini's vision models)
  - Simpler codebase (no pytesseract, OpenCV)
  - More maintainable (leverages platform capabilities)

- **Cons**:
  - Bandwidth usage (~100-500KB per frame)
  - Privacy concerns (mitigated by opt-in)
  - Requires Gemini multimodal API access

## Error Handling
```python
async def send_frame_to_gemini(frame_data: bytes):
    try:
        compressed = compress_frame_fast(frame_data)

        # Check size limit
        if len(compressed) > 2_000_000:  # 2MB limit
            logger.warning("Frame too large, skipping")
            return

        await gemini_session.send({
            "realtime_input": {
                "media_chunks": [{
                    "data": base64.b64encode(compressed).decode(),
                    "mime_type": "image/jpeg"
                }]
            }
        })

    except Exception as e:
        logger.error(f"Failed to send frame: {e}")
        # Continue without visual context (voice still works)
```

## Related Patterns
- Real-time Voice AI Interaction
- LiveKit WebRTC Integration
- Privacy-First Data Handling

## References
- [Google Gemini Live API - Multimodal](../interfaces/google-gemini-live-api.md)
- [LiveKit WebRTC](../interfaces/livekit-webrtc.md)
