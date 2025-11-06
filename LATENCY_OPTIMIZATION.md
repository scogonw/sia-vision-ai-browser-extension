# Latency Optimization Guide

## Problem
The system exhibited 8-10 second delays between user speech completion and AI response, creating a poor user experience that didn't feel like real-time conversation.

## Research Summary

Based on comprehensive research of LiveKit documentation, Google Gemini Live API docs, and industry best practices for voice AI systems, the following optimization strategies were identified:

### Key Findings

1. **Turn Detection Delay**: Default `min_endpointing_delay` of 500ms causes unnecessary waiting
2. **Preemptive Generation**: Can reduce latency by overlapping model inference with user audio
3. **Response Length**: Longer responses = longer generation time + longer audio playback
4. **Model Selection**: Gemini 2.5 Flash Lite is 1.5x faster than 2.0 Flash
5. **Temperature Setting**: Higher temperature (0.8) can sometimes speed up generation vs lower values

## Optimizations Implemented

### 1. AgentSession Turn Detection (agent/main.py)

```python
session = AgentSession(
    llm=google.realtime.RealtimeModel(...),
    # LATENCY OPTIMIZATIONS:
    min_endpointing_delay=0.3,        # Reduced from 500ms to 300ms
    max_endpointing_delay=3.0,        # Reduced from 6s to 3s
    preemptive_generation=True,        # NEW: Start response before turn commits
    allow_interruptions=True,          # Enable natural interruptions
    min_interruption_duration=0.3,     # Reduced from 500ms to 300ms
)
```

**Expected Impact**: 200-400ms reduction in turn detection latency

### 2. Gemini Model Configuration

```python
google.realtime.RealtimeModel(
    model="gemini-2.0-flash-exp",
    voice="Puck",
    temperature=0.8,                   # Increased from 0.6 for faster generation
    max_output_tokens=512,             # NEW: Limit response length
)
```

**Expected Impact**:
- 30-50% reduction in response generation time
- Shorter audio playback time

### 3. System Prompt Optimization

Updated BASE_INSTRUCTIONS to enforce extreme conciseness:
```
CRITICAL: Be extremely concise - use 1-3 sentences maximum per response.
Keep answers brief, focused, and actionable. Avoid explanations unless explicitly requested.
```

**Expected Impact**:
- Shorter responses = faster TTS generation
- Shorter audio playback = perceived lower latency

## Total Expected Latency Reduction

| Component | Before | After | Improvement |
|-----------|--------|-------|-------------|
| Turn Detection | 500ms | 300ms | -200ms |
| Preemptive Gen | 0ms | Overlapped | -100-300ms |
| Response Gen | ~2-3s | ~1-1.5s | -1-1.5s |
| Audio Playback | ~3-5s | ~1.5-2.5s | -1.5-2.5s |
| **Total** | **8-10s** | **3-5s** | **-3-7s (40-70%)** |

## Advanced Optimization (Optional)

### Upgrade to Gemini 2.5 Flash Lite

For even lower latency, consider upgrading the model:

```bash
# In .env file
GEMINI_REALTIME_MODEL=gemini-2.5-flash-lite
```

**Additional Expected Impact**:
- 1.5x faster inference than 2.0 Flash
- Additional 500ms-1s reduction in response time
- **Target: Sub-3-second total latency**

### Fine-tune for Your Use Case

The optimizations can be adjusted based on your specific needs:

```bash
# Aggressive latency optimization (may cut off users faster)
MIN_ENDPOINTING_DELAY=0.2

# Balanced (current setting)
MIN_ENDPOINTING_DELAY=0.3

# Conservative (less likely to cut off users)
MIN_ENDPOINTING_DELAY=0.5
```

## Monitoring & Validation

To validate the improvements:

1. **Use LiveKit telemetry** to measure actual response times
2. **Monitor user feedback** for complaints about being cut off
3. **Track completion rates** to ensure conversations aren't broken
4. **A/B test** if possible to quantify improvement

## Additional Best Practices

From research, other latency reduction strategies (not yet implemented):

1. **Infrastructure Co-location**: Deploy agent workers in same region as users
2. **Parallel SLM+LLM**: Use fast small model for immediate response, then refined response
3. **Streaming TTS**: Start audio playback before full text generation completes
4. **Model Inference Optimization**: Use LiveKit Inference for optimized model access

## References

- [LiveKit Agent Speech and Audio](https://docs.livekit.io/agents/build/audio/)
- [Turn Detection and Interruptions](https://docs.livekit.io/agents/build/turns/)
- [Gemini Live API Plugin](https://docs.livekit.io/agents/models/realtime/plugins/gemini/)
- [Google Gemini 2.5 Performance](https://cloud.google.com/blog/products/ai-machine-learning/gemini-2-5-flash-lite-flash-pro-ga-vertex-ai)
- [Reducing Voice Agent Latency](https://webrtc.ventures/2025/06/reducing-voice-agent-latency-with-parallel-slms-and-llms/)
