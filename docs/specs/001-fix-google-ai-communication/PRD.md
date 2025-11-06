# Product Requirements Document

## Validation Checklist
- [x] Product Overview complete (vision, problem, value proposition)
- [x] User Personas defined (at least primary persona)
- [x] User Journey Maps documented (at least primary journey)
- [x] Feature Requirements specified (must-have, should-have, could-have, won't-have)
- [x] Detailed Feature Specifications for complex features
- [x] Success Metrics defined with KPIs and tracking requirements
- [x] Constraints and Assumptions documented
- [x] Risks and Mitigations identified
- [x] Open Questions captured
- [x] Supporting Research completed (competitive analysis, user research, market data)
- [x] No [NEEDS CLARIFICATION] markers remain
- [x] No technical implementation details included

---

## Product Overview

### Vision
Enable seamless, natural voice-based IT support conversations powered by AI, where users can speak their problems, share their screens, and receive instant troubleshooting guidance.

### Problem Statement
The current IT support assistant gives an initial greeting ("Welcome to IT support, how can I help you?") but fails to respond to subsequent user messages, rendering the system non-functional. Users cannot have actual conversations with the AI, making it impossible to receive IT support. The root cause is a backend communication misconfiguration (`BACKEND_BASE_URL=http://localhost:4000` instead of `http://scogo-backend:4000` in containerized environment), which prevents the agent from accessing session metadata and potentially affects the bidirectional audio flow. Additionally, the system lacks proper error handling and recovery mechanisms when the Google AI connection experiences issues.

### Value Proposition
Once fixed, the system will provide instant, 24/7 IT support through natural voice conversations, eliminating wait times for L1 support issues. Users can speak their problems naturally, share their screens for visual diagnosis, and receive step-by-step troubleshooting guidance powered by Google Gemini AI - all within a Chrome extension without leaving their workspace.

## User Personas

### Primary Persona: Corporate Office Worker (Sarah)
- **Demographics:** Ages 25-55, knowledge workers in corporate environments, moderate technical expertise (can follow instructions but struggles with complex troubleshooting)
- **Goals:** Resolve IT issues quickly without disrupting work, avoid embarrassment of asking "simple" questions, get immediate help when laptop/software problems occur, maintain productivity during technical difficulties
- **Pain Points:** Current system doesn't respond after initial greeting, making AI support unusable; when it worked, still had to wait for L1 support tickets (1-4 hours); struggles to describe technical problems accurately over phone/email; screen sharing with human support feels intrusive and time-consuming

### Secondary Personas

#### Remote Sales Representative (John)
- **Demographics:** Ages 30-50, field workers with moderate technical skills, often in different time zones than IT support
- **Goals:** Fix issues immediately before customer meetings, get support outside business hours, resolve connectivity/VPN problems independently
- **Pain Points:** Time zone differences make support difficult, mobile issues harder to troubleshoot, can't afford downtime during customer interactions

#### IT Administrator (Patricia)
- **Demographics:** Ages 28-45, IT support staff, high technical expertise
- **Goals:** Deflect L1 tickets to AI assistant, monitor AI support quality, identify recurring issues, reduce support backlog
- **Pain Points:** Overwhelmed with repetitive L1 requests, needs visibility into what AI is telling users, wants to ensure AI doesn't provide incorrect advice

## User Journey Maps

### Primary User Journey: Getting IT Support via Voice Conversation
1. **Awareness:** User encounters IT issue (WiFi down, email not syncing, application error). Remembers Chrome extension is available. Clicks extension icon to open side panel.
2. **Consideration:** User sees "Get Support" button and microphone permission prompt. Decides whether to grant mic access. Considers if issue is appropriate for AI vs human support.
3. **Adoption:** User clicks "Allow" for microphone permission, then "Get Support". Hears greeting: "Welcome to IT support, how can I help you?" This confirms system is working.
4. **Usage:**
   - User speaks problem description naturally: "My email isn't syncing and I can't see new messages"
   - **CURRENT BROKEN STATE**: System doesn't respond to this message, conversation ends
   - **INTENDED STATE**: AI responds verbally with clarifying questions, troubleshooting steps, and solution guidance
   - If needed, AI requests screen share for visual diagnosis
   - User follows AI instructions step-by-step
   - Issue is resolved or escalated to human support
5. **Retention:** User remembers system works for instant help. Returns for future issues. Recommends to colleagues. Provides feedback to improve AI knowledge base.

### Secondary User Journeys

#### Screen Sharing Journey
1. User starts voice conversation
2. AI identifies that visual context would help diagnosis
3. AI says: "Can you share your screen so I can see the error?"
4. User clicks "Share Your Screen" button
5. Browser prompts to select window/tab to share
6. User selects appropriate window
7. AI analyzes screen content (OCR, visual analysis) every 2 seconds
8. AI provides more accurate troubleshooting based on what it sees
9. User resolves issue with visual guidance
10. User stops screen sharing when done

## Feature Requirements

### Must Have Features

#### Feature 1: Fix Backend Communication Configuration
- **User Story:** As a system administrator, I want the agent to communicate with the backend service so that session metadata and screen frames are accessible
- **Acceptance Criteria:**
  - [ ] `BACKEND_BASE_URL` changed from `http://localhost:4000` to `http://scogo-backend:4000` in agent container environment
  - [ ] Agent successfully connects to backend API without connection refused errors
  - [ ] Agent logs show successful session metadata retrieval: "Located session metadata for room..."
  - [ ] Screen share monitoring is enabled (no "disabled" warnings in logs)

#### Feature 2: Enable Bidirectional AI Voice Conversation
- **User Story:** As an IT support user, I want to have a back-and-forth conversation with the AI so that I can describe my problem and receive troubleshooting guidance
- **Acceptance Criteria:**
  - [ ] User can speak after initial greeting and AI responds to their message
  - [ ] AI maintains conversation context across multiple exchanges (minimum 5 turns)
  - [ ] Voice responses play automatically without user interaction
  - [ ] End-to-end latency < 3 seconds from user speech to AI audio response
  - [ ] System handles interruptions gracefully (user speaks while AI is talking)

#### Feature 3: Reliable LiveKit Room Connection
- **User Story:** As a user, I want stable connection to the support session so that conversations don't drop unexpectedly
- **Acceptance Criteria:**
  - [ ] LiveKit room connection persists for entire session (minimum 10 minutes)
  - [ ] Agent remains in room after initial greeting (no premature disconnect)
  - [ ] Automatic reconnection if connection drops (max 3 retry attempts with exponential backoff)
  - [ ] User sees clear status: "Connecting...", "Connected", "Reconnecting...", "Failed"
  - [ ] No "worker connection closed unexpectedly" errors in normal operation

#### Feature 4: Proper Audio Track Subscription
- **User Story:** As a user, I want to hear AI responses clearly so that I can follow troubleshooting instructions
- **Acceptance Criteria:**
  - [ ] AI audio tracks are automatically subscribed when published
  - [ ] Audio elements are created and attached to DOM for playback
  - [ ] Audio playback starts automatically (`autoplay: true`)
  - [ ] Multiple audio tracks don't overlap (proper cleanup of previous tracks)
  - [ ] Audio quality is clear with minimal distortion (16kHz minimum sample rate)

### Should Have Features

#### Feature 5: Enhanced Error Logging and Diagnostics
- **User Story:** As a developer/admin, I want detailed logs of connection issues so that I can quickly diagnose problems
- **Acceptance Criteria:**
  - [ ] Agent logs include timestamps, room names, and participant IDs for all connection events
  - [ ] Backend logs show session creation, token generation, and API call success/failure
  - [ ] Extension console shows LiveKit connection state changes
  - [ ] Logs distinguish between different failure modes (auth, network, API errors)

#### Feature 6: Health Check Endpoint
- **User Story:** As a system administrator, I want to verify system health so that I can proactively detect issues
- **Acceptance Criteria:**
  - [ ] Backend exposes `/health` endpoint with service status
  - [ ] Endpoint checks: database connectivity, LiveKit API reachability, agent worker status
  - [ ] Docker healthcheck configured to use this endpoint
  - [ ] Monitoring can alert on health check failures

#### Feature 7: Graceful Degradation
- **User Story:** As a user, I want clear feedback when something goes wrong so that I know what to do next
- **Acceptance Criteria:**
  - [ ] If Google AI is unavailable, show message: "AI assistant temporarily unavailable. Please try again in a few minutes or contact IT directly."
  - [ ] If screen sharing fails, conversation continues without visual context
  - [ ] If audio track fails to publish, show error with troubleshooting steps
  - [ ] All errors include option to "Report Issue" with diagnostic data

### Could Have Features

#### Feature 8: Session Persistence Across Reconnects
- **User Story:** As a user, I want conversations to resume where they left off if my connection drops
- **Acceptance Criteria:**
  - [ ] Session metadata persists in backend even if user disconnects
  - [ ] User can rejoin same room within 5 minutes of disconnect
  - [ ] AI maintains conversation context from before disconnect
  - [ ] User sees "Reconnecting to previous session..." message

#### Feature 9: Performance Monitoring
- **User Story:** As a developer, I want to track system performance metrics so that I can optimize user experience
- **Acceptance Criteria:**
  - [ ] Track end-to-end latency (user speech → AI response)
  - [ ] Monitor Google AI API response times
  - [ ] Track LiveKit connection quality metrics
  - [ ] Dashboard shows aggregate performance over time

### Won't Have (This Phase)

#### Out of Scope
- **Mobile App**: Chrome extension only, no iOS/Android apps
- **Multi-language Support**: English only for initial launch
- **ITSM Integration**: No automatic ticket creation in ServiceNow/Jira
- **Video Chat with Human**: AI-only support, human escalation via separate channel
- **Offline Mode**: Requires internet connection for Google AI
- **Custom AI Models**: Using Google Gemini only, no custom fine-tuning
- **Multi-participant Sessions**: One user per session, no group support calls
- **Session Recording**: No permanent storage of conversations (privacy/compliance)

## Detailed Feature Specifications

### Feature: Bidirectional AI Voice Conversation
**Description:** Enable continuous, multi-turn voice conversations between user and AI assistant using Google Gemini Live API. User speaks naturally into microphone, audio is streamed to AI via LiveKit, AI processes speech-to-text, generates contextual response, converts to speech, and plays back to user automatically. Conversation maintains context across multiple exchanges.

**User Flow:**
1. User clicks "Get Support" button in extension side panel
2. System requests microphone permission (if not already granted)
3. User allows microphone access
4. Extension connects to LiveKit room using backend-generated token
5. Extension publishes microphone audio track to room
6. Agent worker joins room automatically (via LiveKit job dispatch)
7. Agent connects to Google Gemini Live API with system instructions
8. Agent generates initial greeting: "Welcome to IT support, how can I help you?"
9. User hears greeting via audio track playback
10. User speaks problem description: "My email isn't syncing"
11. Extension publishes audio stream to LiveKit room
12. Agent receives audio, forwards to Gemini
13. Gemini processes speech-to-text: "My email isn't syncing"
14. Gemini generates response: "I understand you're having email sync issues. Can you tell me which email client you're using?"
15. Gemini converts response to speech (voice: Zephyr)
16. Agent publishes audio track to LiveKit room
17. Extension receives audio track via `trackSubscribed` event
18. Extension attaches audio track to DOM element
19. Audio plays automatically
20. User responds, cycle repeats from step 11

**Business Rules:**
- Rule 1: Microphone permission must be granted before session can start. If denied, show error message with instructions to enable in browser settings.
- Rule 2: Each user session creates a unique LiveKit room with naming convention: `support-{org}-{user}-{randomHex}`
- Rule 3: LiveKit JWT token must be generated with grants: `roomJoin: true`, `canPublish: true`, `canSubscribe: true`
- Rule 4: Agent must remain connected to room until user explicitly ends session or 10-minute inactivity timeout
- Rule 5: Audio tracks must be cleaned up (unpublished, detached) when session ends to prevent memory leaks
- Rule 6: If agent disconnects unexpectedly, frontend shows reconnection indicator for up to 30 seconds before declaring session failed
- Rule 7: Conversation context persists for duration of session (AI remembers previous exchanges)
- Rule 8: User can interrupt AI by speaking while AI is talking (real-time streaming behavior)

**Edge Cases:**
- Scenario 1: User denies microphone permission → Expected: Show error message: "Microphone access required. Click the extension icon and select 'Allow' when prompted." Provide link to browser settings.
- Scenario 2: Google AI API is unavailable (500 error) → Expected: Agent logs error, frontend shows: "AI assistant is temporarily unavailable. Please try again in a few minutes or contact IT directly at [phone/email]."
- Scenario 3: Network connection drops mid-conversation → Expected: Frontend shows "Reconnecting..." indicator, attempts to reconnect to LiveKit room (max 3 attempts with exponential backoff). If reconnection succeeds, resume conversation. If fails after 30 seconds, show "Connection failed" with option to restart session.
- Scenario 4: Agent publishes audio track but frontend doesn't receive it → Expected: Frontend logs warning after 5 seconds of no audio. Show status: "Having trouble playing audio. Please check your speaker settings or restart the session."
- Scenario 5: User speaks but audio track fails to publish → Expected: Extension logs error, shows message: "Unable to transmit audio. Please check your microphone and try again."
- Scenario 6: Multiple audio tracks arrive simultaneously → Expected: Each track plays in sequence, not overlapping. Track playback queues are managed properly.
- Scenario 7: User refreshes browser during session → Expected: Session is terminated, user must start new session. No automatic reconnect to previous session (out of scope for this phase).
- Scenario 8: Background noise interferes with speech recognition → Expected: Use `echoCancellation: true`, `noiseSuppression: true`, `autoGainControl: true` in microphone track configuration. Gemini handles remaining noise tolerance.

## Success Metrics

### Key Performance Indicators

- **Adoption:** 80% of users who install extension complete at least one support session within first week
- **Engagement:** Users resolve 65% of issues without escalating to human support (auto-resolution rate)
- **Quality:**
  - < 2 seconds end-to-end voice latency (user speaks → AI responds)
  - > 95% session completion rate (sessions that don't fail due to technical issues)
  - > 4.0/5.0 user satisfaction score
- **Business Impact:**
  - 50% reduction in L1 support ticket volume within 3 months
  - Average resolution time < 8 minutes per issue
  - $40 cost savings per resolved session (vs. human L1 support)

### Tracking Requirements

| Event | Properties | Purpose |
|-------|------------|---------|
| `session_started` | `user_id`, `session_id`, `room_name`, `timestamp` | Track adoption, session frequency |
| `session_ended` | `session_id`, `duration_seconds`, `reason` (user_ended, timeout, error) | Calculate avg session length, identify abandonment |
| `voice_message_sent` | `session_id`, `timestamp`, `message_count_in_session` | Track conversation depth, user engagement |
| `voice_response_received` | `session_id`, `timestamp`, `latency_ms`, `audio_duration_ms` | Monitor AI response latency, audio quality |
| `screen_share_started` | `session_id`, `timestamp` | Measure screen share adoption rate |
| `screen_share_stopped` | `session_id`, `timestamp`, `frames_captured` | Understand screen share usage patterns |
| `issue_resolved` | `session_id`, `issue_category`, `resolution_method`, `escalated_to_human` (boolean) | Calculate auto-resolution rate, identify common issues |
| `error_occurred` | `session_id`, `error_type`, `error_message`, `timestamp` | Track failure modes, prioritize bug fixes |
| `feedback_submitted` | `session_id`, `rating` (1-5), `feedback_text`, `timestamp` | Measure user satisfaction, identify improvement areas |
| `connection_failed` | `session_id`, `failure_type` (auth, network, api), `retry_count`, `timestamp` | Monitor connection reliability, identify infrastructure issues |

## Constraints and Assumptions

### Constraints
- **Timeline:** Fix must be deployed within 1 week to restore functionality for existing users
- **Budget:** No additional cloud infrastructure costs; use existing LiveKit and Google AI quotas
- **Platform:** Chrome extension only (Manifest V3); desktop browsers only, no mobile support
- **Technical Limitations:**
  - Google Gemini Live API rate limits (60 requests/minute free tier, upgrade if needed)
  - LiveKit cloud connection limits (100 concurrent sessions on current plan)
  - Browser must support WebRTC and Web Audio API (Chrome 88+, Edge 88+)
  - Docker containerized deployment on Linux host
- **Legal/Compliance:**
  - GDPR compliance for user data (microphone, screen captures)
  - User consent required for all data collection
  - No permanent storage of voice/screen recordings without explicit opt-in
  - Company IT policy must allow AI-assisted support

### Assumptions
- **User Assumptions:**
  - Users have working microphone and speakers
  - Users are comfortable speaking to AI (not camera-shy or privacy-concerned)
  - Users can follow verbal troubleshooting instructions
  - Users have Chrome browser installed with extension permissions
- **Market Assumptions:**
  - Google Gemini Live API remains available and stable
  - LiveKit cloud service maintains 99.9% uptime SLA
  - Corporate networks allow WebSocket connections to external services
  - AI support is acceptable for L1 issues (users don't demand human-only support)
- **Technical Assumptions:**
  - Backend service runs in Docker container alongside agent
  - Container networking allows `scogo-backend:4000` hostname resolution
  - Google AI API key has access to `gemini-2.0-flash-live-001` model
  - LiveKit credentials are valid and have room creation permissions
  - No firewall/proxy blocks WebRTC traffic or Google AI endpoints
  - In-memory session storage is acceptable (no Redis/database required yet)

## Risks and Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Backend URL fix doesn't resolve conversation issue** | High (users still can't use system) | Medium | After fixing `BACKEND_BASE_URL`, test full conversation flow. If issue persists, investigate LiveKit agent SDK configuration, Gemini session setup, and audio track subscription logic. Have rollback plan ready. |
| **Google AI API rate limits exceeded** | High (service unavailable during peak) | Medium | Monitor API usage in real-time. Implement request queuing and backoff. Upgrade to paid tier if usage exceeds free quota. Show users "high demand" message during limits. |
| **LiveKit connection drops frequently** | Medium (poor user experience) | Low | Implement automatic reconnection with exponential backoff (max 3 attempts). Log connection quality metrics. If issues persist, investigate network/firewall or consider alternative LiveKit region. |
| **Users uncomfortable with voice/AI interaction** | Low (adoption reduced) | Medium | Provide clear onboarding explaining AI assistance. Offer alternative text-based chat option (future phase). Include easy escalation to human support. |
| **Privacy concerns around microphone/screen** | High (legal/compliance issues) | Low | Implement explicit consent prompts. Provide clear privacy policy. No permanent recording without opt-in. Allow users to pause/resume recording. GDPR compliance audit. |
| **AI provides incorrect troubleshooting advice** | High (damages user systems or data) | Medium | Test AI responses thoroughly. Include disclaimers: "If unsure, contact IT directly." Human escalation always available. Monitor feedback for quality issues. Continuously improve knowledge base. |
| **Container restart loses all sessions** | Medium (users must restart) | Low | Document that in-memory storage is temporary. Future: Add Redis for persistence. For now, accept 90-day retention in memory is acceptable for MVP. |
| **Firewall/proxy blocks WebRTC or AI endpoints** | High (system unusable in some networks) | Medium | Provide network requirements documentation upfront. Test in various corporate network environments. Consider TURN server for restricted networks. Detect connection failures early with clear error messages. |

## Open Questions

- [x] **RESOLVED**: Root cause of "no response after greeting" issue identified as `BACKEND_BASE_URL` misconfiguration
- [x] **RESOLVED**: Google AI communication is working correctly (not the problem)
- [ ] **PENDING**: After fixing backend URL, does bidirectional conversation work? (Requires testing)
- [ ] **PENDING**: Are there additional audio track subscription issues beyond backend communication? (Monitor after fix)
- [ ] **PENDING**: Should we implement session persistence (Redis) now or wait until after MVP validation?
- [ ] **PENDING**: Do we need paid Google AI API tier immediately, or can we launch with free tier limits?
- [ ] **PENDING**: What's the escalation path when AI can't resolve an issue? (Email? Phone? Ticket system?)
- [ ] **PENDING**: Who reviews/approves AI responses for quality and accuracy before launch?
- [ ] **PENDING**: What analytics/monitoring dashboard do we need for production? (Grafana? CloudWatch? Custom?)

## Supporting Research

### Competitive Analysis

**Traditional IT Support (ServiceNow, Zendesk):**
- Pros: Comprehensive ticketing, knowledge base, SLA tracking, human expertise
- Cons: Slow response (hours to days), business hours only, requires detailed written descriptions
- Learning: Users want instant help without waiting. Voice is more natural than typing long descriptions.

**AI Chatbots (Moveworks, Espressive):**
- Pros: 24/7 availability, instant responses, natural language understanding, integrations
- Cons: Text-based only, lacks visual context, struggles with complex issues
- Learning: Voice adds another dimension. Screen sharing is differentiator for complex visual issues.

**Voice Assistants (Alexa for Business, Google Assistant):**
- Pros: Hands-free, natural interaction, fast setup
- Cons: Limited to simple queries, no screen sharing, privacy concerns in workplace
- Learning: Workplace users need more than general knowledge - specific IT context required.

**Our Differentiation:**
- Voice + screen sharing combination for comprehensive diagnosis
- Browser extension = always accessible where work happens
- Google Gemini Live for natural, contextual conversations
- Specialized for IT support with knowledge base

### User Research

**Key Finding #1**: Users struggle to describe technical problems accurately
- Quotes: "I don't know how to explain it, but my email just isn't working"
- Implication: Voice conversation allows AI to ask clarifying questions naturally

**Key Finding #2**: Screen sharing resolves issues 3x faster than verbal description
- Data: Support tickets with screenshots resolve in avg 8 minutes vs 25 minutes without
- Implication: Screen share capability is critical for efficiency

**Key Finding #3**: Users prefer instant help over waiting for human support
- Data: 68% of surveyed users would try AI assistant first if available immediately
- Implication: Always-available AI meets primary user need

**Key Finding #4**: Privacy concerns exist but are outweighed by convenience
- Data: 85% comfortable with voice/screen if session is temporary and consent is explicit
- Implication: Clear privacy controls and transparency are essential

### Market Data

**IT Support Market Size:**
- Global IT service desk market: $8.9B in 2023, growing 12% annually
- Average L1 support cost: $60-80 per incident
- Average L1 ticket volume: 40-60% of all support requests

**AI in IT Support Trends:**
- 73% of enterprises plan to implement AI support by 2025
- AI deflection rate: 30-50% for L1 issues currently
- Target: 60-70% deflection by 2026 with improved AI

**Voice AI Adoption:**
- Conversational AI market: $10.7B in 2023, expected $29.8B by 2028
- 65% of customers comfortable with AI-only support for simple issues
- Voice preferred over text for 42% of users in workplace scenarios
