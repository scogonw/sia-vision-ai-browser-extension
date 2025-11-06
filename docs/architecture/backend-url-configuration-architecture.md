# Backend URL Configuration Architecture

## Executive Summary

This document defines the architecture for fixing the backend URL configuration issue in the Scogo AI IT Support Assistant. The root cause is that `BACKEND_BASE_URL=http://localhost:4000` fails in Docker because the agent container cannot reach "localhost:4000" (which refers to the agent container itself, not the backend). The solution involves proper Docker container networking, environment-specific configuration management, validation, and health checking.

## Problem Statement

### Current State
- `.env` file contains `BACKEND_BASE_URL=http://localhost:4000`
- Backend container exposes port 4000 with container name `scogo-backend`
- Agent container uses `BACKEND_BASE_URL` to call backend APIs
- Extension (browser) also uses `BACKEND_BASE_URL` at build time

### Root Cause
In Docker Compose networking:
- Containers communicate using service names as hostnames (e.g., `scogo-backend`)
- `localhost` inside a container refers to that container itself, not the host machine
- Agent container trying to reach `http://localhost:4000` fails because there's no service on port 4000 inside the agent container

### Impact
- Agent cannot fetch session metadata from backend
- Screen sharing monitor is disabled
- No real-time screen frame analysis

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Configuration Layer                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   .env       │    │  .env.local  │    │  .env.docker │      │
│  │  (example)   │    │ (host-based) │    │(container)   │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Application Layer                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Backend (Node.js)                                         │ │
│  │  - Container: scogo-backend                                │ │
│  │  - Network: bridge (default)                               │ │
│  │  - Validates BACKEND_BASE_URL on startup                   │ │
│  │  - Exposes /health endpoint                                │ │
│  └────────────────────────────────────────────────────────────┘ │
│                              │                                    │
│                              ▼                                    │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Agent (Python)                                            │ │
│  │  - Container: scogo-agent                                  │ │
│  │  - Network: bridge (default)                               │ │
│  │  - Validates BACKEND_BASE_URL on startup                   │ │
│  │  - Health check to backend before starting                 │ │
│  │  - Graceful degradation if backend unavailable             │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  Extension (Browser)                                       │ │
│  │  - Build-time: BACKEND_BASE_URL from .env                  │ │
│  │  - Runtime: Uses compiled URL                              │ │
│  │  - Always uses localhost:4000 (host network)               │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## 1. Configuration Management Strategy

### 1.1 Environment Variable Structure

We will maintain **one source of truth** for environment variables but allow **environment-specific overrides**:

```
.env.example          # Template with documentation
.env                  # Default values (localhost-based for host)
.env.docker          # Docker-specific overrides (optional)
.gitignore           # Excludes .env and .env.docker
```

### 1.2 Configuration Loading Priority

**For Docker Compose:**
```yaml
services:
  backend:
    env_file:
      - .env              # Base configuration
      - .env.docker       # Docker overrides (if exists)
    environment:
      # Explicit overrides take highest priority
      BACKEND_BASE_URL: ${BACKEND_BASE_URL:-http://scogo-backend:4000}
```

**Priority (highest to lowest):**
1. Docker Compose `environment:` explicit values
2. `.env.docker` file (if exists)
3. `.env` file
4. Default values in code

### 1.3 Environment-Specific Values

| Environment Variable | .env (Host/Dev) | .env.docker (Container) | Extension Build |
|---------------------|----------------|------------------------|-----------------|
| `BACKEND_BASE_URL` | `http://localhost:4000` | `http://scogo-backend:4000` | `http://localhost:4000` |
| `PORT` | `4000` | `4000` | N/A |
| `NODE_ENV` | `development` | `production` | `production` |

**Rationale:**
- **Host-based development**: Developers run services directly on localhost
- **Docker container-to-container**: Services use Docker DNS (service names)
- **Extension (browser)**: Always connects to host machine via localhost

## 2. Docker Networking Architecture

### 2.1 Network Topology

```
┌─────────────────────────────────────────────────────────────┐
│                        Host Machine                          │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Browser + Extension                                   │ │
│  │  Connects to: http://localhost:4000                    │ │
│  └────────────────────────────────────────────────────────┘ │
│                          │                                   │
│                          │ Host network                      │
│                          ▼                                   │
│  ┌──────────────────────────────────────────────────────────┤
│  │  Docker Bridge Network (default)                         │
│  │                                                           │
│  │  ┌─────────────────┐         ┌──────────────────┐       │
│  │  │  scogo-backend  │◄────────│   scogo-agent    │       │
│  │  │  Port: 4000     │         │  Calls: http://  │       │
│  │  │  Hostname:      │         │  scogo-backend:  │       │
│  │  │  scogo-backend  │         │  4000            │       │
│  │  └─────────────────┘         └──────────────────┘       │
│  │         │                                                 │
│  │         │ Port mapping                                    │
│  └─────────┼─────────────────────────────────────────────────┤
│            ▼                                                  │
│      0.0.0.0:4000 → scogo-backend:4000                       │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### 2.2 DNS Resolution

Docker Compose automatically creates a bridge network with embedded DNS:

- **Service name**: `scogo-backend` resolves to the backend container's IP
- **Service name**: `scogo-agent` resolves to the agent container's IP
- **Port mapping**: Host `localhost:4000` → Backend container `4000`

### 2.3 Network Communication Patterns

| From | To | Address | Reason |
|------|----|---------| -------|
| Agent Container | Backend Container | `http://scogo-backend:4000` | Container-to-container via Docker DNS |
| Browser Extension | Backend Container | `http://localhost:4000` | Host-to-container via port mapping |
| Host Terminal | Backend Container | `http://localhost:4000` | Host-to-container via port mapping |
| Backend Container | Self | `http://localhost:4000` | Health check uses localhost (same container) |

## 3. Configuration Validation Strategy

### 3.1 Backend Validation (Node.js)

**Location**: `/Users/ksingh/git/scogo/work/experiments/sia-vision-ai-browser-extension/backend/src/config/env.js`

**Current State**: Uses Joi schema validation
```javascript
BACKEND_BASE_URL: Joi.string().uri().required()
```

**Enhanced Validation**:
```javascript
// Validate format
BACKEND_BASE_URL: Joi.string().uri().required()

// Runtime validation (in server.js startup)
function validateBackendConfig() {
  const url = env.backendBaseUrl;

  // Warn if localhost in production
  if (env.nodeEnv === 'production' && url.includes('localhost')) {
    logger.warn('BACKEND_BASE_URL uses localhost in production - this may fail in containers');
  }

  // Check if URL is reachable (self-test)
  if (url.includes('localhost') || url.includes('127.0.0.1') || url.includes('scogo-backend')) {
    logger.info(`Backend URL configured as: ${url}`);
  }
}
```

### 3.2 Agent Validation (Python)

**Location**: `/Users/ksingh/git/scogo/work/experiments/sia-vision-ai-browser-extension/agent/main.py`

**Current State**: No validation, optional usage
```python
backend_base_url = os.getenv("BACKEND_BASE_URL")
if backend_base_url:
    # Use backend
else:
    logger.warning("BACKEND_BASE_URL not configured. Screen monitoring disabled.")
```

**Enhanced Validation**:
```python
import os
import sys
import logging
import requests
from urllib.parse import urlparse

def validate_backend_config():
    """Validate BACKEND_BASE_URL configuration and connectivity."""
    backend_url = os.getenv("BACKEND_BASE_URL")

    if not backend_url:
        logger.warning("BACKEND_BASE_URL not set. Screen monitoring will be disabled.")
        return None

    # Validate URL format
    try:
        parsed = urlparse(backend_url)
        if not parsed.scheme or not parsed.netloc:
            logger.error(f"Invalid BACKEND_BASE_URL format: {backend_url}")
            return None
    except Exception as e:
        logger.error(f"Failed to parse BACKEND_BASE_URL: {e}")
        return None

    # Check if URL is reachable
    health_url = f"{backend_url.rstrip('/')}/health"
    logger.info(f"Checking backend health at: {health_url}")

    try:
        response = requests.get(health_url, timeout=5)
        if response.status_code == 200:
            logger.info("Backend health check passed")
            return backend_url
        else:
            logger.warning(f"Backend health check returned status {response.status_code}")
            return None
    except requests.exceptions.ConnectionError:
        logger.error(f"Cannot connect to backend at {backend_url}. Screen monitoring will be disabled.")
        return None
    except requests.exceptions.Timeout:
        logger.warning(f"Backend health check timed out for {backend_url}")
        return None
    except Exception as e:
        logger.warning(f"Backend health check failed: {e}")
        return None

# In main.py startup (before entrypoint registration)
validated_backend_url = validate_backend_config()
```

### 3.3 Extension Validation (JavaScript)

**Location**: `/Users/ksingh/git/scogo/work/experiments/sia-vision-ai-browser-extension/extension/src/lib/config.js`

**Current State**: Simple check
```javascript
export const ensureConfig = () => {
  if (!config.backendBaseUrl) {
    throw new Error('Missing BACKEND_BASE_URL in environment')
  }
  return config
}
```

**Enhanced Validation**:
```javascript
export const validateBackendUrl = (url) => {
  // Extension should always use localhost (host-based)
  const parsed = new URL(url);

  if (parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
    console.warn(`Extension BACKEND_BASE_URL should use localhost, got: ${parsed.hostname}`);
  }

  return url;
}

export const ensureConfig = () => {
  if (!config.backendBaseUrl) {
    throw new Error('Missing BACKEND_BASE_URL in environment')
  }

  // Validate at build time
  validateBackendUrl(config.backendBaseUrl);

  return config
}
```

## 4. Health Check and Connectivity Verification

### 4.1 Backend Health Endpoint

**Location**: `/Users/ksingh/git/scogo/work/experiments/sia-vision-ai-browser-extension/backend/src/server.js`

**Current Implementation**: Basic health check
```javascript
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})
```

**Enhanced Health Check**:
```javascript
app.get('/health', (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: env.nodeEnv,
    version: process.env.npm_package_version || 'unknown',
    uptime: process.uptime(),
    services: {
      livekit: {
        configured: !!(env.livekit.apiKey && env.livekit.apiSecret),
        host: env.livekit.host
      },
      storage: {
        sessions: sessionStore.size()
      }
    }
  };

  res.json(health);
});

// Detailed health endpoint (for debugging)
app.get('/health/detailed', authenticate, (req, res) => {
  const detailed = {
    ...health,
    config: {
      backendBaseUrl: env.backendBaseUrl,
      port: env.port,
      corsOrigins: env.corsOrigins
    }
  };
  res.json(detailed);
});
```

### 4.2 Docker Compose Health Check

**Location**: `/Users/ksingh/git/scogo/work/experiments/sia-vision-ai-browser-extension/docker-compose.yml`

**Current Implementation**:
```yaml
backend:
  healthcheck:
    test: ["CMD", "node", "-e", "require('http').get('http://localhost:${PORT:-4000}/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"]
    interval: 10s
    timeout: 5s
    retries: 3
    start_period: 30s
```

**Why This Works**:
- Health check runs **inside** the backend container
- Uses `localhost` because it's checking the container's own service
- Docker marks container as healthy/unhealthy based on exit code

### 4.3 Agent Startup Health Check

**Architecture Decision**: Agent should verify backend connectivity before starting

**Implementation Strategy**:
```python
# In main.py, before cli.run_app()

def startup_health_check():
    """Perform startup health checks before starting the agent."""
    logger.info("Performing startup health checks...")

    # Check required environment variables
    required_vars = ["LIVEKIT_HOST", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "GEMINI_API_KEY"]
    missing = [var for var in required_vars if not os.getenv(var)]

    if missing:
        logger.error(f"Missing required environment variables: {', '.join(missing)}")
        sys.exit(1)

    # Validate and check backend (optional, non-blocking)
    global VALIDATED_BACKEND_URL
    VALIDATED_BACKEND_URL = validate_backend_config()

    if not VALIDATED_BACKEND_URL:
        logger.warning("Agent will start without backend connectivity. Screen monitoring disabled.")
    else:
        logger.info(f"Backend connectivity verified: {VALIDATED_BACKEND_URL}")

    logger.info("Startup health checks complete")

# Call before starting agent
if __name__ == "__main__":
    startup_health_check()

    # Set LiveKit environment variables
    os.environ["LIVEKIT_URL"] = os.getenv("LIVEKIT_HOST")
    os.environ["LIVEKIT_API_KEY"] = os.getenv("LIVEKIT_API_KEY")
    os.environ["LIVEKIT_API_SECRET"] = os.getenv("LIVEKIT_API_SECRET")

    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint))
```

## 5. Graceful Degradation Strategy

### 5.1 Agent Behavior Without Backend

**Design Principle**: Agent should function (voice + conversation) even without backend connectivity

**Current Behavior** (Lines 320-337 in main.py):
```python
backend_base_url = os.getenv("BACKEND_BASE_URL")
if backend_base_url:
    backend_client = BackendClient(backend_base_url, agent_api_key)
    session_metadata = await backend_client.get_session_by_room(ctx.room.name)
    if not session_metadata:
        logger.warning("Unable to locate session metadata. Screen monitoring disabled.")
    else:
        session_id = session_metadata["session"]["sessionId"]
        monitor = ScreenShareMonitor(backend_client, agent)
        monitor.start(session_id)
else:
    logger.warning("BACKEND_BASE_URL not configured. Screen monitoring disabled.")
```

**This is CORRECT**: Agent degrades gracefully without backend

### 5.2 Feature Matrix

| Feature | Requires Backend | Graceful Degradation |
|---------|-----------------|---------------------|
| Voice conversation | No | ✅ Always works |
| Agent instructions | No | ✅ Always works |
| Knowledge base | No | ✅ Local filesystem |
| Screen share streaming | No | ✅ Via LiveKit |
| Screen frame analysis | **Yes** | ⚠️ Disabled if backend unavailable |
| Session metadata | **Yes** | ⚠️ Disabled if backend unavailable |
| Feedback submission | **Yes** | ❌ Fails silently (extension) |

### 5.3 Error Handling Design

**BackendClient Request Pattern**:
```python
def _get_json(self, url: str) -> Optional[dict]:
    try:
        response = requests.get(url, headers=self._headers(), timeout=10)
        if response.status_code == 404:
            return None  # Valid response, no data
        response.raise_for_status()
        return response.json()
    except requests.RequestException as exc:
        logger.warning("Backend request failed for %s: %s", url, exc)
        return None  # Non-blocking failure
```

**This is CORRECT**: Returns None instead of crashing, allowing graceful degradation

## 6. Development vs Production Configuration

### 6.1 Configuration Matrix

| Scenario | BACKEND_BASE_URL | How to Run |
|----------|-----------------|------------|
| **Local Development (no Docker)** | `http://localhost:4000` | `npm run dev` (backend)<br>`python agent/main.py start` (agent)<br>`npm run dev` (extension) |
| **Docker Development** | `http://scogo-backend:4000` | `docker-compose up` |
| **Production (Docker)** | `http://scogo-backend:4000` | `docker-compose -f docker-compose.prod.yml up` |
| **Extension Build (any)** | `http://localhost:4000` | `npm run build` |

### 6.2 Recommended Workflow

**Option A: Pure Docker Development** (Simplest)
```bash
# Create .env.docker
echo "BACKEND_BASE_URL=http://scogo-backend:4000" > .env.docker

# Start everything
docker-compose up
```

**Option B: Hybrid Development** (Most flexible)
```bash
# .env uses localhost
BACKEND_BASE_URL=http://localhost:4000

# Run backend in Docker
docker-compose up backend

# Run agent locally
cd agent
python main.py start

# Build extension
cd extension
npm run build
```

**Option C: No Docker** (Maximum control)
```bash
# .env uses localhost
BACKEND_BASE_URL=http://localhost:4000

# Run backend
cd backend
npm run dev

# Run agent
cd agent
python main.py start

# Build extension
cd extension
npm run build
```

### 6.3 Docker Compose Environment Strategy

```yaml
services:
  backend:
    env_file:
      - .env
    environment:
      PORT: ${PORT:-4000}
      # Keep BACKEND_BASE_URL from .env (for backend's own config)
    ports:
      - "${PORT:-4000}:${PORT:-4000}"

  agent:
    env_file:
      - .env
    environment:
      # Override for container-to-container communication
      BACKEND_BASE_URL: http://scogo-backend:${PORT:-4000}
      KNOWLEDGE_BASE_PATH: /app/agent/knowledge_base
    depends_on:
      backend:
        condition: service_healthy
```

**Rationale**:
- Backend doesn't need to override `BACKEND_BASE_URL` (it's for self-reference)
- Agent **must** override `BACKEND_BASE_URL` to use Docker service name
- This allows `.env` to stay localhost-based for non-Docker development

## 7. Implementation Plan

### 7.1 Phase 1: Docker Compose Fix (Immediate)

**Goal**: Fix container-to-container communication

**Changes**:
1. Update `docker-compose.yml`:
   - Add `environment` override for agent's `BACKEND_BASE_URL`
   - Set to `http://scogo-backend:${PORT:-4000}`

2. Test:
   ```bash
   docker-compose up --build
   # Verify agent logs show successful backend connection
   ```

**Files Modified**:
- `/Users/ksingh/git/scogo/work/experiments/sia-vision-ai-browser-extension/docker-compose.yml`

### 7.2 Phase 2: Configuration Validation (Short-term)

**Goal**: Add startup validation to catch configuration errors early

**Changes**:
1. Backend: Add URL format warning for localhost in production
2. Agent: Add `validate_backend_config()` function with health check
3. Agent: Add `startup_health_check()` before `cli.run_app()`

**Files Modified**:
- `/Users/ksingh/git/scogo/work/experiments/sia-vision-ai-browser-extension/backend/src/config/env.js`
- `/Users/ksingh/git/scogo/work/experiments/sia-vision-ai-browser-extension/backend/src/server.js`
- `/Users/ksingh/git/scogo/work/experiments/sia-vision-ai-browser-extension/agent/main.py`

### 7.3 Phase 3: Enhanced Health Checks (Medium-term)

**Goal**: Improve observability and debugging

**Changes**:
1. Enhance `/health` endpoint with service status
2. Add `/health/detailed` endpoint with config info (authenticated)
3. Agent logs backend connectivity status at startup

**Files Modified**:
- `/Users/ksingh/git/scogo/work/experiments/sia-vision-ai-browser-extension/backend/src/server.js`
- `/Users/ksingh/git/scogo/work/experiments/sia-vision-ai-browser-extension/backend/src/routes/index.js`

### 7.4 Phase 4: Documentation (Long-term)

**Goal**: Help developers avoid this issue

**Changes**:
1. Update README with Docker networking explanation
2. Add troubleshooting guide for common configuration errors
3. Document environment variable usage in `.env.example`

**Files Modified**:
- `/Users/ksingh/git/scogo/work/experiments/sia-vision-ai-browser-extension/README.md`
- `/Users/ksingh/git/scogo/work/experiments/sia-vision-ai-browser-extension/.env.example`
- `/Users/ksingh/git/scogo/work/experiments/sia-vision-ai-browser-extension/docs/local-deployment.md`

## 8. Testing Strategy

### 8.1 Unit Tests

**Backend Configuration Validation**:
```javascript
describe('env.js', () => {
  it('should reject invalid BACKEND_BASE_URL format', () => {
    process.env.BACKEND_BASE_URL = 'not-a-url';
    expect(() => require('./config/env')).toThrow();
  });

  it('should accept valid BACKEND_BASE_URL', () => {
    process.env.BACKEND_BASE_URL = 'http://scogo-backend:4000';
    expect(() => require('./config/env')).not.toThrow();
  });
});
```

**Agent Backend Client**:
```python
def test_backend_client_handles_connection_error():
    client = BackendClient("http://nonexistent:9999", None)
    result = client._get_json("http://nonexistent:9999/api/test")
    assert result is None  # Should not crash

def test_backend_client_handles_404():
    # Mock 404 response
    result = client._get_json(url)
    assert result is None  # Should return None, not crash
```

### 8.2 Integration Tests

**Docker Compose Health**:
```bash
#!/bin/bash
# Test script: test-docker-networking.sh

set -e

echo "Starting services..."
docker-compose up -d

echo "Waiting for backend health check..."
timeout 60 bash -c 'until docker-compose ps backend | grep -q "healthy"; do sleep 2; done'

echo "Checking agent can reach backend..."
docker-compose exec agent python -c "
import requests
response = requests.get('http://scogo-backend:4000/health', timeout=5)
assert response.status_code == 200
print('✅ Agent can reach backend')
"

echo "Checking host can reach backend..."
curl -f http://localhost:4000/health

echo "✅ All networking tests passed"
docker-compose down
```

### 8.3 Manual Testing Checklist

- [ ] `docker-compose up` starts all services without errors
- [ ] Backend health check shows "healthy" in `docker-compose ps`
- [ ] Agent logs show "Backend health check passed"
- [ ] Agent logs show "Screen share monitor started for session {id}"
- [ ] Extension can connect to LiveKit session
- [ ] Screen sharing works end-to-end
- [ ] Screen frames appear in agent's context

## 9. Architectural Decision Records (ADRs)

### ADR-001: Use Docker Service Names for Container-to-Container Communication

**Status**: Accepted

**Context**: Containers need to communicate with each other in Docker Compose.

**Decision**: Use Docker service names (`scogo-backend`) instead of localhost in `BACKEND_BASE_URL` for agent container.

**Consequences**:
- ✅ Standard Docker networking practice
- ✅ Works out-of-the-box with Docker Compose
- ✅ No additional network configuration needed
- ⚠️ Requires environment-specific configuration

### ADR-002: Override BACKEND_BASE_URL in docker-compose.yml for Agent

**Status**: Accepted

**Context**: Need to support both Docker and non-Docker development workflows.

**Decision**: Keep `.env` with localhost, override in `docker-compose.yml` for agent only.

**Consequences**:
- ✅ `.env` works for local development (no Docker)
- ✅ Docker Compose overrides for containers
- ✅ Extension always uses localhost (correct behavior)
- ⚠️ Two sources of configuration (but clear priority)

### ADR-003: Graceful Degradation for Missing Backend

**Status**: Accepted

**Context**: Agent should work for basic conversation even if backend is unavailable.

**Decision**: Make backend connectivity optional; disable screen monitoring if unavailable.

**Consequences**:
- ✅ Agent doesn't crash on backend failure
- ✅ Voice conversation always works
- ⚠️ Screen frame analysis silently disabled
- ⚠️ No user-facing error message about missing feature

### ADR-004: Health Check Backend Before Starting Agent

**Status**: Proposed

**Context**: Better to fail fast if backend is required.

**Decision**: Add startup health check that validates backend connectivity, but continues with warning.

**Consequences**:
- ✅ Clear logs about backend availability at startup
- ✅ Catches configuration errors early
- ✅ Non-blocking (warnings, not errors)
- ⚠️ Adds startup latency (5-second timeout)

### ADR-005: Single .env File with Optional .env.docker

**Status**: Rejected

**Alternative Considered**: Create `.env.docker` for Docker-specific values

**Reason for Rejection**:
- Adds complexity (two files to maintain)
- Docker Compose `environment:` override is clearer
- Less likely to be committed to git by mistake

**Decision**: Use Docker Compose `environment:` for overrides instead

## 10. Troubleshooting Guide

### Issue: Agent logs "Cannot connect to backend"

**Symptoms**:
```
[WARNING] Backend health check returned status 500
[WARNING] Screen monitoring disabled
```

**Diagnosis**:
1. Check backend health:
   ```bash
   docker-compose ps backend
   # Should show "healthy"
   ```

2. Check backend logs:
   ```bash
   docker-compose logs backend
   ```

3. Test backend from agent container:
   ```bash
   docker-compose exec agent python -c "import requests; print(requests.get('http://scogo-backend:4000/health').json())"
   ```

**Solutions**:
- If backend not healthy: Check backend logs for startup errors
- If connection refused: Verify `BACKEND_BASE_URL` uses `scogo-backend`, not `localhost`
- If 404: Backend might not be exposing `/health` endpoint

### Issue: Extension cannot connect to backend

**Symptoms**:
```
Failed to create LiveKit token
ERR_CONNECTION_REFUSED
```

**Diagnosis**:
1. Check if backend is accessible from host:
   ```bash
   curl http://localhost:4000/health
   ```

2. Check port mapping:
   ```bash
   docker-compose ps
   # Should show 0.0.0.0:4000->4000/tcp
   ```

**Solutions**:
- Ensure backend is running: `docker-compose up backend`
- Check firewall isn't blocking port 4000
- Verify `PORT` in `.env` matches port in `docker-compose.yml`

### Issue: "BACKEND_BASE_URL uses localhost in production"

**Symptoms**: Warning in backend logs

**Explanation**: This warning is informational. Backend's own `BACKEND_BASE_URL` can be localhost (it's checking itself).

**Action**:
- If in production: Consider if this is correct for your deployment
- If in development: Safe to ignore

### Issue: Agent starts but screen monitoring never activates

**Diagnosis**:
1. Check agent logs for "Screen share monitor started"
2. Check backend session creation:
   ```bash
   curl -H "Authorization: Bearer {token}" http://localhost:4000/api/session
   ```

**Solutions**:
- Ensure extension creates session before starting LiveKit connection
- Verify room name matches between extension and agent
- Check agent has correct API key if `AGENT_API_KEY` is set

## 11. Future Considerations

### 11.1 Service Mesh

For production deployments with multiple instances:
- Consider using Kubernetes services instead of Docker Compose
- Service discovery via DNS (e.g., `backend.default.svc.cluster.local`)
- Load balancing across backend replicas

### 11.2 Configuration Management Tools

For complex deployments:
- Consider using [Consul](https://www.consul.io/) for service discovery
- Consider using [Vault](https://www.vaultup.io/) for secrets management
- Consider using [etcd](https://etcd.io/) for distributed configuration

### 11.3 Multi-Environment Support

For staging/production separation:
```yaml
# docker-compose.prod.yml
services:
  agent:
    environment:
      BACKEND_BASE_URL: http://scogo-backend-prod:4000
      NODE_ENV: production
```

### 11.4 Observability Enhancements

- Add distributed tracing (OpenTelemetry)
- Add metrics collection (Prometheus)
- Add centralized logging (ELK stack)

## 12. Summary

### Key Architecture Decisions

1. **Docker Networking**: Use Docker service names for container-to-container communication
2. **Configuration Strategy**: Override `BACKEND_BASE_URL` in `docker-compose.yml` for agent only
3. **Validation**: Add startup health checks to verify backend connectivity
4. **Graceful Degradation**: Agent works without backend, screen monitoring disabled
5. **Development Experience**: Keep `.env` localhost-based for non-Docker workflows

### Critical Files

| File | Purpose | Key Configuration |
|------|---------|------------------|
| `.env` | Base configuration | `BACKEND_BASE_URL=http://localhost:4000` |
| `docker-compose.yml` | Container orchestration | Agent override: `BACKEND_BASE_URL: http://scogo-backend:4000` |
| `agent/main.py` | Agent startup | Validate backend, graceful degradation |
| `backend/src/config/env.js` | Backend validation | Joi schema for BACKEND_BASE_URL |
| `backend/src/server.js` | Health endpoint | `/health` endpoint |

### Next Steps

1. **Immediate**: Update `docker-compose.yml` to fix agent's BACKEND_BASE_URL
2. **Short-term**: Add configuration validation in agent startup
3. **Medium-term**: Enhance health check endpoints with detailed status
4. **Long-term**: Document troubleshooting guide and update README

---

**Document Version**: 1.0
**Last Updated**: 2025-11-06
**Author**: Claude (System Architecture Agent)
**Status**: Ready for Implementation
