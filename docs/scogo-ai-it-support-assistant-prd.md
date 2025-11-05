# Scogo AI IT Support Assistant – Product Requirements Document (PRD)

## Document Information

| Field | Details |
| --- | --- |
| **Product Name** | Scogo AI IT Support Assistant |
| **Version** | 1.0 |
| **Date** | November 2025 |
| **Owner** | Scogo AI Team |
| **Status** | In Development |
| **Base Technology** | LiveKit Vision Demo + Chrome Extension |

## Executive Summary

Build a production-ready Chrome browser extension that enables enterprise users to receive real-time IT support through AI-powered voice and screen-sharing sessions. The system leverages LiveKit's WebRTC infrastructure and the Google Gemini Live API to provide step-by-step guidance for resolving IT issues.

**Core Value Proposition**

- Instant IT support without waiting for human agents.
- Visual understanding of user problems through screen sharing.
- Natural voice conversations for better user experience.
- 70% reduction in L1 support ticket volume.
- 65% auto-resolution rate for common IT issues.

## Product Scope

### In Scope – MVP (Version 1.0)

#### Chrome Extension (Frontend)

- Google OAuth 2.0 authentication.
- Single-click **Get Support** button activation.
- Screen sharing capability (entire screen, window, or tab).
- Microphone access for voice communication.
- Real-time voice call with AI agent.
- Call controls (mute, unmute, end call).
- Session status indicators.
- Basic error handling and user feedback.
- Support for Windows, macOS, and Linux (Chrome-compatible).

#### Backend Components

- LiveKit agent using MultimodalAgent architecture.
- Gemini Live API integration for vision + voice.
- Token generation service with authentication.
- Session management and logging.
- Intelligent frame sampling optimization.
- IT support knowledge base integration.
- Auto-resolution detection.

#### Security & Compliance

- End-to-end encryption for WebRTC streams.
- OAuth 2.0 secure authentication.
- User consent for screen sharing.
- Session recording controls.
- Data retention policies.
- GDPR/privacy compliance.

### Out of Scope – MVP

- Mobile app support (iOS/Android).
- Multi-language support (English only for MVP).
- Integration with existing ITSM tools.
- Ticket creation from sessions.
- Historical session playback.
- Multi-user collaboration.
- Custom branding per organization.
- Advanced analytics dashboard.
- Offline mode.

### Future Roadmap

#### Phase 2 (Q1 2026)

- Integration with Scogo AI Iceberg ITSM platform.
- Automatic ticket creation for unresolved issues.
- Session history and analytics dashboard.
- Multi-language support (Hindi, Spanish, French).

#### Phase 3 (Q2 2026)

- Mobile app variants.
- Integration with Slack, Teams, WhatsApp.
- Advanced AI training on organization-specific issues.
- Supervisor escalation capability.

## Success Criteria

### Primary Metrics

| Metric | Target | Measurement Method |
| --- | --- | --- |
| User Adoption Rate | 60% of employees use within 3 months | Extension install count / total employees |
| Issue Resolution Rate | 65% issues resolved without human intervention | Successful resolutions / total sessions |
| Average Resolution Time | < 8 minutes per issue | Time from session start to resolution |
| User Satisfaction (CSAT) | > 4.2/5.0 rating | Post-session survey |
| Session Completion Rate | > 80% sessions completed (not abandoned) | Completed sessions / initiated sessions |

### Secondary Metrics

| Metric | Target | Measurement Method |
| --- | --- | --- |
| Reduction in L1 Tickets | 70% reduction in basic IT tickets | Ticket volume comparison |
| Average Cost Savings | $50 per resolved session | (Human support cost − AI cost) per session |
| First Contact Resolution | > 75% issues resolved in first session | Single-session resolutions / total issues |
| System Uptime | 99.5% availability | Uptime monitoring |
| API Response Time | < 2 seconds for AI responses | Backend latency monitoring |

### Technical Performance KPIs

| Metric | Target | Critical Threshold |
| --- | --- | --- |
| Connection Establishment Time | < 3 seconds | 5 seconds max |
| Screen Frame Processing | 1 fps during speech, 0.3 fps idle | Configurable |
| Voice Latency | < 200 ms end-to-end | 500 ms max |
| Memory Usage (Extension) | < 150 MB | 250 MB max |
| Concurrent Sessions | 500 simultaneous users | Scale to 1000 |

## User Personas

### Primary Persona: Corporate Employee

- **Name:** Sarah Martinez
- **Role:** Marketing Manager
- **Age:** 32
- **Tech Savvy:** Moderate
- **Pain Points:**
  - Cannot install software without IT help.
  - Email configuration issues.
  - Network connectivity problems.
  - VPN setup confusion.
- **Goals:**
  - Quick resolution without waiting for IT.
  - Clear step-by-step guidance.
  - Minimal disruption to work.

### Secondary Persona: Remote Worker

- **Name:** John Chen
- **Role:** Sales Representative
- **Age:** 28
- **Tech Savvy:** Low–Moderate
- **Pain Points:**
  - Home office tech setup issues.
  - Printer connectivity problems.
  - Video conferencing issues.
  - Software crashes.
- **Goals:**
  - Self-service IT support.
  - Voice guidance while hands are busy.
  - Works across time zones.

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ ENTERPRISE NETWORK                                              │
│                                                                 │
│ ┌────────────────────────────────────────────────────────────┐ │
│ │ CHROME BROWSER (User's Desktop)                           │ │
│ │                                                            │ │
│ │ ┌────────────────────────────────────────────────────┐     │ │
│ │ │ SCOGO IT SUPPORT EXTENSION                         │     │ │
│ │ │                                                    │     │ │
│ │ │ ┌──────────────┐   ┌──────────────┐                │     │ │
│ │ │ │ Popup UI     │   │ Content      │                │     │ │
│ │ │ │ Component    │   │ Scripts      │                │     │ │
│ │ │ └──────┬───────┘   └──────┬───────┘                │     │ │
│ │ │        │                │                        │     │ │
│ │ │ ┌──────▼────────────────▼───────┐                │     │ │
│ │ │ │ Background Service Worker     │                │     │ │
│ │ │ │ • OAuth Handler               │                │     │ │
│ │ │ │ • LiveKit Client SDK          │                │     │ │
│ │ │ │ • Session Manager             │                │     │ │
│ │ │ │ • State Management            │                │     │ │
│ │ │ └──────┬────────────────────────┘                │     │ │
│ │ │        │                                         │     │ │
│ │ └────────▼─────────────────────────────────────────┘     │ │
│ └─────────┼───────────────────────────────────────────────┘ │
│           │                                                 │
│ HTTPS (OAuth, Token API)          WebRTC (Media Streams)     │
│           │                                                 │
│ ┌─────────▼────────────────────────────────────────┐        │
│ │ INTERNET / CLOUD INFRASTRUCTURE                  │        │
│ └─────────┬────────────────────────────────────────┬┘        │
│           │                                        │         │
│ ┌─────────▼────────────┐           ┌───────────────▼────────┐│
│ │ TOKEN SERVICE        │           │ LIVEKIT CLOUD/SERVER   ││
│ │ (Backend)            │           │                        ││
│ │ • Authentication     │           │ • Room Management      ││
│ │ • Token Generation   │           │ • Media Router         ││
│ │ • Session Logging    │           │ • TURN/STUN Servers    ││
│ └──────────────────────┘           └────────────────────────┘│
│           │                                        │         │
│           └───────────────┬────────────────────────┘         │
│                           │                                  │
│ ┌──────────────▼──────────┴──────────────────┐               │
│ │ AGENT BACKEND (Python - Vision Demo)       │               │
│ │ • Frame Processor                          │               │
│ │ • Audio Handler                            │               │
│ │ • Context Manager                          │               │
│ │ • IT Support Logic                         │               │
│ └──────────────┬─────────────────────────────┘               │
│                │                                             │
│ ┌──────────────▼────────────────┐                            │
│ │ GEMINI LIVE API (Google Cloud)│                            │
│ │ • Vision Analysis             │                            │
│ │ • Voice Understanding         │                            │
│ │ • Natural Language Generation │                            │
│ └───────────────────────────────┘                            │
└──────────────────────────────────────────────────────────────┘
```

### Component Specifications

#### Chrome Extension (Frontend)

**Manifest Configuration (Pseudo-code)**

```json
{
  "manifest_version": 3,
  "name": "Scogo AI IT Support Assistant",
  "version": "1.0.0",
  "permissions": [
    "identity",
    "storage",
    "tabs",
    "desktopCapture"
  ],
  "host_permissions": [
    "https://api.scogo.ai/",
    "https://*.livekit.cloud/"
  ],
  "oauth2": {
    "client_id": "YOUR_GOOGLE_CLIENT_ID",
    "scopes": ["email", "profile"]
  ],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'; connect-src https://api.scogo.ai https://*.livekit.cloud wss://*.livekit.cloud"
  }
}
```

**Component Structure**

```
extension/
├── manifest.json
├── background.js
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── lib/
│   ├── livekit-client.js
│   ├── auth-handler.js
│   ├── session-manager.js
│   └── error-handler.js
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── assets/
    ├── sounds/
    └── images/
```

**Key Modules**

- Authentication Module.
- Session Manager Module.
- UI Controller Module.

(Pseudo-code for each module provided in source briefing.)

#### Backend Components

**Token Service Structure**

```
token-service/
├── src/
│   ├── server.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── token.js
│   │   └── session.js
│   ├── middleware/
│   │   ├── auth.js
│   │   ├── rateLimit.js
│   │   └── logging.js
│   ├── services/
│   │   ├── livekit.js
│   │   ├── database.js
│   │   └── analytics.js
│   └── config/
│       ├── env.js
│       └── security.js
├── tests/
├── Dockerfile
└── package.json
```

**Agent Backend Structure**

```
agent-backend/
├── agent.py
├── config/
│   ├── prompts.py
│   └── settings.py
├── handlers/
│   ├── frame_processor.py
│   ├── issue_detector.py
│   ├── step_generator.py
│   └── resolution_tracker.py
├── services/
│   ├── gemini_client.py
│   ├── knowledge_base.py
│   └── logging_service.py
├── models/
│   └── session_state.py
├── tests/
├── requirements.txt
└── Dockerfile
```

Key pseudo-code snippets describe token generation and agent flows, including LiveKit integration and issue detection logic.

## Security Architecture

### Security Layers

1. **Authentication & Authorization**
   - Google OAuth 2.0 client-side flow with backend validation and refresh handling.
   - Secure session storage with token expiration enforcement.
   - Organization-level access controls and optional role-based permissions.

2. **Transport Security**
   - WebRTC encryption with DTLS-SRTP and Perfect Forward Secrecy.
   - API communication over HTTPS (TLS 1.3) with certificate pinning and request signing.
   - LiveKit JWT-based authentication with room and track level permissions.

3. **Data Protection**
   - In-memory frame processing with no persistent storage.
   - Audio streamed directly to Gemini; no local recording by default.
   - Session metadata encrypted at rest with minimal PII and 90-day retention.
   - Sanitized logs stored securely for 30 days.

4. **Privacy Controls**
   - User consent required for screen sharing with visual indicators.
   - Optional selective sharing (window/tab) and configurable retention policies.
   - GDPR-compliant features: right to deletion, data portability, consent management.

### Security Best Practices

- Strict Content Security Policy.
- Rate limiting for token and session APIs.
- Input validation and sanitization for user data.

## Scalability & Performance

### Performance Targets

- Connection: initial connection < 3 s, room join < 2 s, agent join < 1 s.
- Latency: voice latency < 200 ms, frame processing < 500 ms, agent response < 2 s.
- Throughput: 500 concurrent sessions (target 1000 with scaling).
- Resource usage: extension memory < 150 MB, backend memory < 512 MB per session.
- Reliability: 99.5% uptime, error rate < 0.5%, packet loss tolerance < 2%.

### Scaling Strategy

- Horizontal scaling of LiveKit servers with auto-scaling and global distribution.
- Kubernetes-managed agent workers with regional pools.
- Backend microservices with database read replicas and Redis caching.

### Optimization Strategies

- Intelligent frame processing with perceptual hashing and adaptive sampling.
- Network optimization: adaptive streaming, Opus audio tuning, network monitoring.

## System Workflow

### End-to-End User Journey

Detailed flow covering authentication, session start, connection establishment, microphone and screen-share enablement, AI-assisted support, resolution confirmation, feedback collection, and session termination.

### Technical Sequence Diagram

Step-by-step sequence from authentication to cleanup illustrating interactions between extension, backend, LiveKit, agent, and Gemini services.

## Testing Strategy

### Testing Pyramid

- 80% unit tests, 15% integration tests, 5% end-to-end tests.

### Test Suites

Extensive scenarios covering:

- Authentication.
- Session connection and resilience.
- Screen sharing behaviors.
- Voice communication controls and latency.
- Issue resolution workflows and escalation.
- Session termination cases.
- Security hardening and privacy.
- Performance benchmarks.
- Integration points across services.
- User acceptance and accessibility evaluations.

## Monitoring & Analytics

- Real-time, daily, weekly, and monthly dashboards with key metrics (active sessions, response times, adoption, cost savings, etc.).
- Structured logging strategy for extension and backend with sanitization and batching.
- Analytics events for user actions, performance metrics, and error reporting.

## Deployment Plan

1. **Phase 1 – Internal Testing (Week 1–2).**
   - Validate core functionality with 15 internal/beta users.
   - Success: zero critical bugs, < 5 major bugs, 95% core flow success.

2. **Phase 2 – Closed Beta (Week 3–4).**
   - 100 partner users; monitor sessions and iterate weekly.
   - Success: 50+ sessions, 60% auto-resolution, CSAT ≥ 4.0, < 5% critical errors.

3. **Phase 3 – Public Launch (Week 5–6).**
   - Public Chrome Web Store release, marketing rollout.
   - Success: 500+ installs first week, 99% uptime, positive reviews.

4. **Phase 4 – Growth & Optimization (Week 7+).**
   - Feature enhancements, broader integrations, adoption targets (60% in 3 months).

## Documentation Plan

Covers user documentation (quick start, manuals, videos, FAQ), developer documentation (architecture, setup, APIs, extension and agent development), and operations documentation (deployment, monitoring, incident response, maintenance).

## Definition of Done (DoD)

Checklists for feature completeness, testing coverage, documentation readiness, infrastructure preparation, security compliance, and launch readiness.

## Success Metrics Summary

| Metric | Week 1 | Month 1 | Month 3 |
| --- | --- | --- | --- |
| User Adoption | 10% | 30% | 60% |
| Auto-Resolution Rate | 50% | 60% | 65% |
| CSAT Score | 3.8 / 5.0 | 4.0 / 5.0 | 4.2 / 5.0 |
| Average Resolution Time | 12 min | 10 min | 8 min |
| Session Completion | 75% | 80% | 85% |

**Business Impact (Month 3 Targets)**

- L1 ticket reduction: 70%.
- Cost savings per session: $50.
- Total cost savings (500 sessions): $25,000/month.
- ROI: 300% (including development costs).
- Employee satisfaction: +15% improvement.

## Appendix A – Technology Stack Summary

- **Frontend (Extension):** Chrome Extension MV3, LiveKit Client SDK, ES6+, Chrome Identity & Storage APIs, WebRTC.
- **Backend (Token Service):** Node.js/Express or Python/FastAPI, LiveKit Server SDK, Redis, JWT.
- **Agent Backend:** Python 3.11+, LiveKit Agents Framework, Google Gemini Live API.
- **Infrastructure:** LiveKit Cloud or self-hosted, AWS/GCP services, Docker for containerization.

