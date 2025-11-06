# Implementation Plan

## Validation Checklist
- [x] Context Ingestion section complete with all required specs
- [x] Implementation phases logically organized
- [x] Each phase starts with test definition (TDD approach)
- [x] Dependencies between phases identified
- [x] Parallel execution marked where applicable
- [x] Multi-component coordination identified (agent, backend, extension)
- [x] Final validation phase included
- [x] No placeholder content remains

## Specification Compliance Guidelines

### How to Ensure Specification Adherence

1. **Before Each Phase**: Complete the Pre-Implementation Specification Gate
2. **During Implementation**: Reference specific SDD sections in each task
3. **After Each Task**: Run Specification Compliance checks
4. **Phase Completion**: Verify all specification requirements are met

### Deviation Protocol

If implementation cannot follow specification exactly:
1. Document the deviation and reason
2. Get approval before proceeding
3. Update SDD if the deviation is an improvement
4. Never deviate without documentation

## Metadata Reference

- `[parallel: true]` - Tasks that can run concurrently
- `[component: component-name]` - For multi-component features
- `[ref: document/section]` - Links to specifications, patterns, or interfaces
- `[activity: type]` - Activity hint for specialist agent selection
- `[complexity: level]` - LOW (simple), MEDIUM (moderate), HIGH (complex)

---

## Context Priming

*GATE: You MUST fully read all files mentioned in this section before starting any implementation.*

**Specification Documents**:
- `docs/specs/001-fix-google-ai-communication/PRD.md` - Product Requirements
- `docs/specs/001-fix-google-ai-communication/SDD-SUMMARY.md` - Solution Design Summary
- `docs/architecture/backend-url-configuration-architecture.md` - Backend URL fix architecture
- `docs/audio-playback-architecture.md` - Audio subscription architecture

**Key Design Decisions**:
- **AD-1**: Override BACKEND_BASE_URL in docker-compose.yml for agent (not in .env)
- **AD-2**: Exponential backoff reconnection (1s, 2s, 4s) with max 3 attempts
- **AD-3**: Automatic audio track subscription (LiveKit default)
- **AD-4**: Concurrent audio playback (no queuing) for natural conversation
- **AD-5**: Keep in-memory session storage (no Redis for MVP)

**Implementation Context**:

**Commands to run**:
```bash
# Backend
cd backend && npm install && npm run dev
npm test                     # Run backend tests
npm run lint                 # ESLint check

# Agent
cd agent && pip install -r requirements.txt
python main.py              # Run agent locally
pytest                      # Run agent tests (if exists)

# Extension
cd extension && npm install && npm run build
npm run dev                 # Development build with watch

# Docker
docker-compose up --build   # Start all services
docker-compose logs -f agent    # Monitor agent logs
docker-compose logs -f backend  # Monitor backend logs
```

**Patterns to follow**:
- `docs/patterns/realtime-voice-ai-interaction.md` - Voice interaction pattern
- `docs/patterns/screen-share-analysis.md` - Screen sharing pattern

**Interfaces to implement**:
- `docs/interfaces/livekit-webrtc.md` - LiveKit integration
- `docs/interfaces/google-gemini-live-api.md` - Gemini API integration

---

## Implementation Phases

### **Phase 1**: Fix Backend Communication Configuration

**Goal**: Agent container can communicate with backend container via Docker networking

**Required Reading**:
- `docs/architecture/backend-url-configuration-architecture.md` (all sections)
- `docs/specs/001-fix-google-ai-communication/SDD-SUMMARY.md` (AD-1, Deployment View)

- [x] **Pre-Implementation Review**: Read SDD Section "Backend URL Configuration Fix" and "AD-1: Docker Networking Configuration"

- [ ] **Task 1.1**: Update docker-compose.yml with backend URL override `[activity: configuration]` `[complexity: LOW]` `[ref: SDD-SUMMARY/AD-1]`
  - [ ] Add `BACKEND_BASE_URL: http://scogo-backend:${PORT:-4000}` to agent environment
  - [ ] Ensure depends_on with service_healthy condition for backend
  - [ ] Test: `docker-compose config` shows correct environment variable

- [ ] **Task 1.2**: Add backend connectivity health check in agent startup `[activity: implementation, error-handling]` `[complexity: MEDIUM]` `[ref: backend-url-configuration-architecture.md]`
  - [ ] Implement `validate_backend_config()` function in agent/main.py
  - [ ] Check backend /health endpoint with 5-second timeout
  - [ ] Log success or warning (non-blocking if unavailable)
  - [ ] Test: Agent starts successfully and logs backend connectivity status

- [ ] **Task 1.3**: Enhance backend /health endpoint `[activity: api-development]` `[complexity: LOW]` `[ref: SDD-SUMMARY/Building Block View]`
  - [ ] Create `health-controller.js` with service status checks
  - [ ] Add GET /health route returning `{status: 'ok', services: {...}}`
  - [ ] Test: `curl http://localhost:4000/health` returns 200 OK

- [ ] **Validate Phase 1**: `[activity: integration-testing]`
  - [ ] Start services: `docker-compose up -d`
  - [ ] Check agent logs: `docker-compose logs agent` shows "Located session metadata"
  - [ ] Verify no "Connection refused" errors in agent logs
  - [ ] Verify screen share monitoring enabled (no "disabled" warning)
  - [ ] Test manual session: Extension → Backend → Agent chain works

---

### **Phase 2**: Implement Connection Reliability

**Goal**: LiveKit connections are stable with automatic reconnection on transient failures

**Required Reading**:
- `docs/audio-playback-architecture.md` (Connection section)
- `docs/specs/001-fix-google-ai-communication/SDD-SUMMARY.md` (AD-2, Runtime View)

- [x] **Pre-Implementation Review**: Read SDD Section "LiveKit Connection Reliability" and "AD-2: Reconnection with Exponential Backoff"

- [ ] **Task 2.1**: Implement Connection State Machine (Extension) `[activity: architecture, state-management]` `[complexity: HIGH]` `[component: extension]` `[ref: SDD-SUMMARY/Solution Component 2]`
  - [ ] Create `extension/src/lib/connection-manager.ts` (new file)
  - [ ] Define ConnectionState enum (IDLE, CONNECTING, CONNECTED, RECONNECTING, DEGRADED, DISCONNECTING, FAILED)
  - [ ] Implement state transitions with validation
  - [ ] Add state change event emitter for UI updates
  - [ ] Test: State transitions follow documented state machine

- [ ] **Task 2.2**: Implement Reconnection Logic with Backoff (Extension) `[activity: error-handling, retry-logic]` `[complexity: MEDIUM]` `[component: extension]` `[ref: SDD-SUMMARY/AD-2]`
  - [ ] Implement `calculateBackoffDelay(attemptNumber)` function
  - [ ] Implement `attemptReconnection()` with max 3 attempts
  - [ ] Add error classification: `classifyError(error)` function
  - [ ] Implement `reconnectToRoom()` with track republishing
  - [ ] Test: Reconnection attempts occur at correct intervals (1s, 2s, 4s with jitter)

- [ ] **Task 2.3**: Add Connection Health Monitoring (Extension) `[parallel: true]` `[activity: monitoring]` `[complexity: MEDIUM]` `[component: extension]` `[ref: audio-playback-architecture.md/Health Monitoring]`
  - [ ] Leverage LiveKit's built-in `connectionQualityChanged` event (no custom polling)
  - [ ] Monitor `room.state` transitions using LiveKit's state machine
  - [ ] Check participant count using LiveKit's participant tracking
  - [ ] Trigger reconnection only on degraded connection >20s
  - [ ] Test: Health monitoring uses LiveKit events, no custom timers

- [ ] **Task 2.4**: Add Agent Connection Resilience `[parallel: true]` `[activity: error-handling]` `[complexity: MEDIUM]` `[component: agent]` `[ref: SDD-SUMMARY/Solution Component 2]`
  - [ ] Wrap `ctx.connect()` in try-catch with timeout (30s)
  - [ ] Implement retry loop with exponential backoff (max 3 attempts)
  - [ ] Use LiveKit agent SDK's built-in error handling and lifecycle hooks
  - [ ] Classify errors: transient vs fatal (leverage SDK error types)
  - [ ] Test: Agent reconnects on transient failures, fails gracefully on fatal errors

- [ ] **Task 2.5**: Integrate ConnectionManager into SessionManager `[activity: integration]` `[complexity: MEDIUM]` `[component: extension]` `[ref: extension/src/lib/session-manager.js]`
  - [ ] Refactor session-manager.js to use ConnectionManager
  - [ ] Update event handlers to delegate to ConnectionManager
  - [ ] Add UI status callbacks for state changes
  - [ ] Maintain backward compatibility
  - [ ] Test: Existing session flow works with new ConnectionManager

- [ ] **Validate Phase 2**: `[activity: integration-testing]`
  - [ ] Test transient network failure: Unplug network → Wait 2s → Plug back → Verify reconnection
  - [ ] Test connection failure: Block LiveKit port → Verify max 3 attempts → Verify failure message
  - [ ] Test agent crash: Kill agent container → Verify extension detects and shows message
  - [ ] Verify connection metrics logged (attempt count, duration, errors)
  - [ ] Verify no "worker connection closed unexpectedly" in normal operation

---

### **Phase 3**: Implement Robust Audio Playback

**Goal**: Audio tracks are reliably subscribed, played, and cleaned up without memory leaks

**Required Reading**:
- `docs/audio-playback-architecture.md` (all sections)
- `docs/specs/001-fix-google-ai-communication/SDD-SUMMARY.md` (AD-3, AD-4)

- [x] **Pre-Implementation Review**: Read SDD Section "Audio Track Subscription & Playback" and "AD-3: Automatic Audio Track Subscription"

- [ ] **Task 3.1**: Implement AudioPlaybackManager (Extension) `[activity: architecture]` `[complexity: HIGH]` `[component: extension]` `[ref: audio-playback-architecture.md]`
  - [ ] Create `extension/src/lib/audio-playback-manager.ts` (new file)
  - [ ] Leverage LiveKit's track.attach() method (built-in audio element creation)
  - [ ] Use LiveKit's AudioPlaybackStatusChanged event (built-in monitoring)
  - [ ] Add lightweight registry for cleanup tracking only
  - [ ] Implement AbortController pattern for custom event listener cleanup
  - [ ] Test: Audio elements created via LiveKit APIs, minimal custom logic

- [ ] **Task 3.2**: Add Autoplay Policy Handling `[activity: browser-api, error-handling]` `[complexity: MEDIUM]` `[component: extension]` `[ref: audio-playback-architecture.md/Autoplay Policy]`
  - [ ] Call LiveKit's `Room.startAudio()` in `startSession()` (built-in autoplay handling)
  - [ ] Check LiveKit's `room.canPlaybackAudio` property before playback
  - [ ] Use LiveKit's pending audio queue mechanism (built-in)
  - [ ] Add user prompt if autoplay blocked: "Click to enable audio"
  - [ ] Test: Audio plays immediately via LiveKit's autoplay handling

- [ ] **Task 3.3**: Implement Playback Verification and Retry `[activity: error-handling, retry-logic]` `[complexity: MEDIUM]` `[component: extension]` `[ref: audio-playback-architecture.md/Playback Verification]`
  - [ ] Monitor `AudioPlaybackStatusChanged` event
  - [ ] Verify playback started 500ms after `play()` call
  - [ ] Implement retry logic with exponential backoff (100ms, 300ms, 900ms)
  - [ ] Log warning if playback verification fails after 3 attempts
  - [ ] Test: Playback failures are detected and retried

- [ ] **Task 3.4**: Implement Audio Element Cleanup `[activity: resource-management]` `[complexity: MEDIUM]` `[component: extension]` `[ref: audio-playback-architecture.md/Memory Leak Prevention]`
  - [ ] Implement 8-step cleanup sequence in correct order
  - [ ] Use AbortController to auto-remove event listeners
  - [ ] Clear all retry timers on cleanup
  - [ ] Nullify references for garbage collection
  - [ ] Test: No memory leaks after 100 session cycles

- [ ] **Task 3.5**: Handle trackSubscribed Event `[activity: event-handling]` `[complexity: LOW]` `[component: extension]` `[ref: extension/src/lib/session-manager.js:519-537]`
  - [ ] Update existing `trackSubscribed` handler to use AudioPlaybackManager
  - [ ] Delegate to `AudioPlaybackManager.handleTrack(track)`
  - [ ] Add logging for track metadata (kind, source, participant)
  - [ ] Test: Audio tracks are received and delegated to manager

- [ ] **Validate Phase 3**: `[activity: integration-testing]`
  - [ ] Test initial greeting plays immediately after "Get Support"
  - [ ] Test user message triggers AI response audio
  - [ ] Test multiple rapid messages (concurrent playback)
  - [ ] Test audio playback after network reconnection
  - [ ] Monitor browser console for autoplay policy errors (should be none)
  - [ ] Run memory profiler: No leaks after 100 sessions
  - [ ] Verify audio quality (no distortion, clear speech)

---

### **Phase 4**: Enhanced Error Handling and Observability

**Goal**: Comprehensive logging, metrics, and user-friendly error messages

**Required Reading**:
- `docs/specs/001-fix-google-ai-communication/PRD.md` (Feature 5: Enhanced Error Logging)
- `docs/specs/001-fix-google-ai-communication/SDD-SUMMARY.md` (Observability)

- [x] **Pre-Implementation Review**: Read PRD Feature 5 acceptance criteria and SDD "Observability and Monitoring Strategy"

- [ ] **Task 4.1**: Add Structured Logging (Extension) `[parallel: true]` `[activity: logging]` `[complexity: LOW]` `[component: extension]`
  - [ ] Create `ConnectionLogEvent` interface
  - [ ] Implement structured logging for all connection events
  - [ ] Add timestamp, sessionId, roomName, state to all logs
  - [ ] Log connection attempts, successes, failures, reconnections
  - [ ] Test: Logs are structured and parseable JSON

- [ ] **Task 4.2**: Add Structured Logging (Agent) `[parallel: true]` `[activity: logging]` `[complexity: LOW]` `[component: agent]`
  - [ ] Use Python logging with structured format
  - [ ] Log all connection lifecycle events with metadata
  - [ ] Add room name, session ID, participant IDs to logs
  - [ ] Distinguish error types (auth, network, fatal)
  - [ ] Test: Agent logs show clear connection lifecycle

- [ ] **Task 4.3**: Add Metrics Collection (Extension) `[parallel: true]` `[activity: monitoring]` `[complexity: MEDIUM]` `[component: extension]`
  - [ ] Create `MetricsCollector` class
  - [ ] Track: total connections, success rate, reconnection attempts
  - [ ] Track: average session duration, RTT, packet loss
  - [ ] Track: error counts by category
  - [ ] Export metrics on session end
  - [ ] Test: Metrics are collected and exported correctly

- [ ] **Task 4.4**: Improve User Error Messages `[activity: ux]` `[complexity: LOW]` `[component: extension]`
  - [ ] Create user-friendly error message map
  - [ ] "Connection failed" → "Unable to connect. Please check your internet connection."
  - [ ] "Agent disconnected" → "AI assistant disconnected. Reconnecting..."
  - [ ] "Max retries" → "Connection failed after 3 attempts. Please try again."
  - [ ] Add "Report Issue" button for fatal errors
  - [ ] Test: Error messages are clear and actionable

- [ ] **Validate Phase 4**: `[activity: testing]`
  - [ ] Review extension console logs: All events are logged
  - [ ] Review agent logs: Connection lifecycle is clear
  - [ ] Verify metrics exported on session end
  - [ ] Test error scenarios: Each shows appropriate user message
  - [ ] Verify logs distinguish between error categories

---

### **Phase 5**: Docker, Configuration, and API Documentation

**Goal**: Production-ready Docker configuration, comprehensive API documentation, and deployment guides

**Required Reading**:
- `docs/specs/001-fix-google-ai-communication/SDD-SUMMARY.md` (Deployment View)
- `docker-compose.yml`, `.env.example`

- [x] **Pre-Implementation Review**: Read SDD "Deployment View" and "Environment Configuration"

- [ ] **Task 5.1**: Update .env.example `[activity: configuration]` `[complexity: LOW]`
  - [ ] Add clear comments explaining BACKEND_BASE_URL usage
  - [ ] Document: "Use localhost for local dev, container name for Docker"
  - [ ] Add all required environment variables with examples
  - [ ] Ensure NO hard-coded values - all critical config in .env
  - [ ] Test: `.env.example` provides clear guidance

- [ ] **Task 5.2**: Update Docker healthchecks `[activity: devops]` `[complexity: LOW]`
  - [ ] Verify backend healthcheck uses /health endpoint
  - [ ] Leverage LiveKit's built-in health monitoring (no custom implementation)
  - [ ] Document agent health monitoring approach
  - [ ] Test: `docker-compose ps` shows services as healthy

- [ ] **Task 5.3**: Set up API documentation with Swagger/OpenAPI `[activity: api-documentation]` `[complexity: MEDIUM]`
  - [ ] Install swagger-jsdoc and swagger-ui-express in backend
  - [ ] Create OpenAPI 3.0 specification file: `docs/api/openapi.yaml`
  - [ ] Document all backend endpoints:
    - POST /api/token/livekit (JWT generation)
    - POST /api/session (Session creation)
    - GET /api/session/:id (Session retrieval)
    - GET /api/session/by-room/:roomName (Session by room)
    - GET /health (Health check)
  - [ ] Add request/response schemas for all endpoints
  - [ ] Add authentication requirements (Google OAuth tokens)
  - [ ] Set up /api-docs endpoint serving Swagger UI
  - [ ] Test: Navigate to http://localhost:4000/api-docs and verify all endpoints documented

- [ ] **Task 5.4**: Create deployment documentation `[activity: documentation]` `[complexity: LOW]`
  - [ ] Update README.md with Docker networking explanation
  - [ ] Add troubleshooting section for common issues
  - [ ] Document: "Connection refused" → Check BACKEND_BASE_URL
  - [ ] Document: How to test backend connectivity from agent
  - [ ] Add link to API documentation at /api-docs
  - [ ] Test: New developer can follow README to deploy

- [ ] **Task 5.5**: Add validation script `[activity: devops, testing]` `[complexity: MEDIUM]`
  - [ ] Create `scripts/validate-deployment.sh`
  - [ ] Check: Backend health endpoint responds
  - [ ] Check: Agent can reach backend (exec into container and curl)
  - [ ] Check: Extension can reach backend from host
  - [ ] Check: API documentation accessible at /api-docs
  - [ ] Report: All services healthy or specific failures
  - [ ] Test: Script detects common misconfigurations

- [ ] **Task 5.6**: Latency optimization validation `[activity: performance-testing]` `[complexity: MEDIUM]`
  - [ ] Measure end-to-end voice latency (user speech → AI response)
  - [ ] Measure connection establishment time
  - [ ] Measure screen frame transmission latency
  - [ ] Verify all latencies meet targets (<2s voice, <3s connection)
  - [ ] Document performance baselines in README
  - [ ] Test: All latency targets achieved

- [ ] **Validate Phase 5**: `[activity: deployment-testing]`
  - [ ] Fresh clone of repo
  - [ ] Follow README.md to deploy
  - [ ] Run `scripts/validate-deployment.sh` → All checks pass
  - [ ] Navigate to /api-docs → Full API documentation visible
  - [ ] Start session from extension → Full conversation works
  - [ ] Check all logs are clear and informative
  - [ ] Verify latency meets targets

---

## **Integration & End-to-End Validation**

**Goal**: Verify complete system functionality and specification compliance

**Required Reading**:
- `docs/specs/001-fix-google-ai-communication/PRD.md` (All acceptance criteria)
- `docs/specs/001-fix-google-ai-communication/SDD-SUMMARY.md` (Test Specifications)

- [ ] **Pre-Validation Review**: Read all PRD acceptance criteria and SDD test scenarios

### Unit and Component Tests
- [ ] All unit tests passing (backend, agent, extension)
- [ ] Connection Manager unit tests pass
- [ ] Audio Playback Manager unit tests pass
- [ ] Error handling unit tests pass

### Integration Tests
- [ ] **Test Scenario 1**: Backend Communication After Fix `[ref: SDD-SUMMARY/Test Scenario 2]`
  - [ ] Agent successfully connects to backend via `http://scogo-backend:4000`
  - [ ] Agent logs show "Located session metadata for room..."
  - [ ] Screen share monitoring enabled
  - [ ] No "Connection refused" errors

- [ ] **Test Scenario 2**: Full Voice Conversation `[ref: SDD-SUMMARY/Test Scenario 1]`
  - [ ] User clicks "Get Support" → Connection establishes <3s
  - [ ] User hears greeting <2s
  - [ ] User speaks "My email isn't syncing"
  - [ ] AI responds <2s with relevant answer
  - [ ] Conversation continues for 5+ turns
  - [ ] No errors in any component logs

- [ ] **Test Scenario 3**: Network Reconnection `[ref: SDD-SUMMARY/Test Scenario 3]`
  - [ ] During active conversation, disconnect network
  - [ ] Extension shows "Reconnecting..." status
  - [ ] Network reconnects → Connection re-establishes <8s
  - [ ] Conversation context preserved
  - [ ] User can continue conversation

- [ ] **Test Scenario 4**: Audio Playback Reliability `[ref: SDD-SUMMARY/Test Scenario 4]`
  - [ ] `Room.startAudio()` called on session start
  - [ ] Greeting plays immediately
  - [ ] Multiple rapid messages → All audio plays
  - [ ] No autoplay policy errors in console

- [ ] **Test Scenario 5**: Connection Failure Handling `[ref: SDD-SUMMARY/Test Scenario 5]`
  - [ ] Block LiveKit connection
  - [ ] Extension attempts 3 reconnections (1s, 2s, 4s delays)
  - [ ] After 3 failures, shows "Connection failed" message
  - [ ] User can click "Try Again" to restart
  - [ ] Resources cleaned up properly

### Performance Tests `[ref: SDD-SUMMARY/Quality Requirements]`
- [ ] Voice latency <2s (user speech → AI response audio)
- [ ] Connection time <3s (click "Get Support" → greeting plays)
- [ ] Reconnection time <8s max (network drop → reconnection complete)
- [ ] Session completion rate >95% (no tech failures)
- [ ] Audio quality: 16kHz sample rate, <5% packet loss

### Security Validation `[ref: PRD/Security Requirements]`
- [ ] API keys in environment variables only (not in code)
- [ ] LiveKit JWT tokens expire in 1 hour
- [ ] Session data not logged (privacy)
- [ ] User consent for microphone and screen share

### Acceptance Criteria Validation `[ref: PRD/Feature Requirements]`

**Feature 1: Fix Backend Communication**
- [x] `BACKEND_BASE_URL` changed in docker-compose.yml (not .env)
- [ ] Agent connects to backend without errors
- [ ] Agent logs show session metadata retrieval
- [ ] Screen share monitoring enabled

**Feature 2: Bidirectional AI Voice Conversation**
- [ ] User can speak after initial greeting and AI responds
- [ ] AI maintains context across 5+ turns
- [ ] Voice responses play automatically
- [ ] End-to-end latency <3s
- [ ] System handles interruptions gracefully

**Feature 3: Reliable LiveKit Room Connection**
- [ ] Connection persists for 10+ minutes
- [ ] Agent remains in room after greeting
- [ ] Automatic reconnection with max 3 attempts
- [ ] User sees clear status ("Connecting", "Connected", etc.)
- [ ] No "worker connection closed unexpectedly" errors

**Feature 4: Proper Audio Track Subscription**
- [ ] AI audio tracks auto-subscribed
- [ ] Audio elements created and attached to DOM
- [ ] Audio playback starts automatically
- [ ] Multiple audio tracks don't overlap (managed cleanly)
- [ ] Audio quality clear with minimal distortion

### Test Coverage Requirements
- [ ] Unit test coverage >90% for new code (ConnectionManager, AudioPlaybackManager)
- [ ] Integration test coverage >80% (connection flow, backend communication)
- [ ] All error paths tested (TRANSIENT, AUTH, FATAL, DEGRADED)
- [ ] Performance tests meet targets (latency, connection time)
- [ ] Docker tests verify container networking

---

## Post-Implementation Checklist

### Code Quality
- [ ] ESLint passes (extension, backend)
- [ ] Python linting passes (agent)
- [ ] TypeScript compilation succeeds (extension)
- [ ] No console errors in production build
- [ ] Code follows existing patterns

### Documentation
- [ ] README.md updated with deployment instructions
- [ ] .env.example has clear comments
- [ ] Troubleshooting guide added
- [ ] Architecture diagrams updated (if changed)
- [ ] All new functions have JSDoc/docstring comments

### Deployment Readiness
- [ ] `docker-compose up` works on fresh clone
- [ ] All services start and become healthy
- [ ] `scripts/validate-deployment.sh` passes
- [ ] Extension builds successfully: `npm run build`
- [ ] No errors in any service logs on startup

### Specification Compliance
- [ ] All PRD acceptance criteria met
- [ ] All SDD architecture decisions implemented
- [ ] No unauthorized deviations from specification
- [ ] All "NEEDS CLARIFICATION" markers resolved
- [ ] Cross-references to specifications verified

### User Experience
- [ ] User can complete full conversation without errors
- [ ] Error messages are helpful and actionable
- [ ] Status feedback is clear ("Connecting", "Connected", etc.)
- [ ] Reconnection is automatic and seamless
- [ ] No confusing technical errors shown to user

---

## Rollback Plan

If implementation fails or introduces regressions:

1. **Revert Git Commits**:
   ```bash
   git log --oneline -10  # Find commit before changes
   git revert <commit-sha>  # Or git reset --hard <commit-sha>
   ```

2. **Restore Original Configuration**:
   ```bash
   git checkout docker-compose.yml
   git checkout .env
   ```

3. **Restart Services**:
   ```bash
   docker-compose down
   docker-compose up --build
   ```

4. **Verify Rollback**:
   - Extension still loads (may be broken, but loads)
   - Backend and agent start without crashes
   - No worse than before (greeting still works)

---

## Success Criteria Summary

**Must Achieve (MVP)**:
1. ✅ Backend URL configured correctly for Docker
2. ✅ User can have back-and-forth conversation with AI
3. ✅ Audio plays automatically without user intervention
4. ✅ Connection stays stable for entire session
5. ✅ Automatic reconnection on transient failures

**Should Achieve (Quality)**:
1. ✅ <2s voice latency
2. ✅ >95% session completion rate
3. ✅ Clear error messages
4. ✅ Structured logging for debugging

**Could Achieve (Nice-to-have)**:
1. Metrics dashboard
2. Performance monitoring alerts
3. Session persistence across restarts

---

## Implementation Timeline Estimate

| Phase | Estimated Time | Dependencies |
|-------|----------------|--------------|
| Phase 1: Backend Configuration | 2 hours | None |
| Phase 2: Connection Reliability | 6 hours (reduced - leveraging LiveKit) | Phase 1 |
| Phase 3: Audio Playback | 6 hours (reduced - leveraging LiveKit) | Phase 1 |
| Phase 4: Error Handling | 4 hours | Phase 2, 3 |
| Phase 5: Docker, Config, API Docs | 6 hours (increased - added API docs) | All previous |
| Integration Testing | 4 hours | All previous |
| **Total** | **28 hours** | **~3-4 days** |

**Critical Path**: Phase 1 → Phase 2 → Integration Testing
**Parallel Work**: Phase 2 and Phase 3 can partially overlap after Phase 1

**Time Savings from Updates**:
- Leveraging LiveKit built-in features: -4 hours (Phases 2 & 3)
- No manual OCR/CV implementation: Eliminated from scope
- Added API documentation: +2 hours (Phase 5)
- Added latency validation: +1 hour (Phase 5)
- Net change: -1 hour (more efficient with LiveKit)

---

## Notes

- **TDD Approach**: Each phase starts with defining tests before implementation
- **Incremental Validation**: Each task has immediate validation steps
- **Specification Traceability**: Every task references PRD/SDD sections
- **Multi-Component Coordination**: Extension, backend, and agent changes are coordinated
- **Quality Gates**: Validation at task, phase, and final integration levels
