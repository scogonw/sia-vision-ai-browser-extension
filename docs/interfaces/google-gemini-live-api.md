# Interface: Google Gemini Live API

## Overview
Google Gemini Live API provides real-time, bidirectional audio streaming for speech-to-text, AI processing, and text-to-speech in a single WebSocket connection.

## Endpoint
```
wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent
```

## Authentication
- Method: API Key via GOOGLE_API_KEY or GEMINI_API_KEY environment variable
- Format: Header or query parameter (SDK handles automatically)

## Model Configuration
```python
google.realtime.RealtimeModel(
    model="models/gemini-2.0-flash-live-001",
    voice="Zephyr",  # or other available voices
    temperature=0.6,  # 0.0-1.0 for response randomness
)
```

## Message Types

### Setup (Client → Server)
```json
{
  "setup": {
    "model": "models/gemini-2.0-flash-live-001",
    "generation_config": {
      "response_modalities": ["AUDIO"],
      "speech_config": {
        "voice_config": { "prebuilt_voice_config": { "voice_name": "Zephyr" } }
      }
    },
    "system_instruction": {
      "parts": [{ "text": "You are an IT support assistant..." }]
    }
  }
}
```

### Audio Input (Client → Server)
```json
{
  "realtime_input": {
    "media_chunks": [
      { "data": "<base64-encoded-audio>", "mime_type": "audio/pcm" }
    ]
  }
}
```

### Image Input (Client → Server) - Multimodal
```json
{
  "realtime_input": {
    "media_chunks": [
      {
        "data": "<base64-encoded-image>",
        "mime_type": "image/png"  // or image/jpeg, image/webp
      }
    ]
  }
}
```

**Supported Image Formats**:
- image/png
- image/jpeg
- image/webp
- Maximum size: 20MB per image
- Recommended: Compress images for faster transmission

### Audio Output (Server → Client)
```json
{
  "serverContent": {
    "model_turn": {
      "parts": [
        { "inline_data": { "data": "<base64-audio>", "mime_type": "audio/pcm" } }
      ]
    }
  }
}
```

## Available Voices
- Puck (male)
- Charon (male)
- Kore (female)
- Fenrir (male)
- Aoede (female)
- **Zephyr (recommended)**

## Rate Limits
- Check current limits in Google AI Studio
- Typically: 60 requests/minute, 1000 requests/day for free tier
- Enterprise tier available for production

## Error Handling
- **Connection Refused**: Invalid API key or model not accessible
- **Rate Limit**: Retry with exponential backoff
- **Model Unavailable**: Check model name format and availability

## Integration Requirements
- Python SDK: `google-generativeai>=0.8.0`
- LiveKit Agents: `livekit-agents[google]>=1.2.0`
- Environment: `GOOGLE_API_KEY` or `GEMINI_API_KEY`

## Performance Characteristics
- Latency: ~200-500ms for transcription
- Audio streaming: Real-time, chunk-based
- Concurrent sessions: Managed by rate limits

## Multimodal Capabilities

### Image Understanding
Gemini 2.0 Flash Live provides native vision capabilities:
- **Screen Analysis**: Send screen share frames directly to model
- **Technical Support**: Identify UI elements, error messages, system states
- **Visual Context**: Understand application interfaces, settings screens
- **No Preprocessing Required**: No need for OCR, edge detection, or manual analysis

### Latency Optimization for Images
1. **Compression**: Use JPEG with 75-85% quality to reduce payload size
2. **Frame Selection**: Send frames only when user requests assistance or at key moments
3. **Concurrent Processing**: Stream audio while processing images asynchronously
4. **Resolution**: 1920x1080 or lower provides sufficient detail with lower latency

### Example: Screen Share Analysis
```python
# Agent receives screen frame from LiveKit
async def handle_screen_frame(frame_data: bytes):
    # Send directly to Gemini without preprocessing
    await session.send({
        "realtime_input": {
            "media_chunks": [{
                "data": base64.b64encode(frame_data).decode(),
                "mime_type": "image/jpeg"
            }]
        }
    })
    # Gemini understands the visual context automatically
```

## Best Practices
1. Use system instructions for consistent behavior
2. Stream audio in small chunks for lower latency
3. Handle connection drops with reconnection logic
4. Monitor API usage and rate limits
5. Use temperature 0.6-0.8 for natural conversation
6. **Leverage multimodal**: Send images directly without manual OCR/CV preprocessing
7. **Optimize payload**: Compress images before transmission
8. **Minimize roundtrips**: Batch audio + image when possible

## Related Interfaces
- LiveKit WebRTC
- Chrome Extension Media APIs
