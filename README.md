# Scogo AI IT Support Assistant

A vision-enabled AI assistant that provides real-time IT support through voice and screen sharing. Built with LiveKit for real-time communication and Google Gemini for AI-powered responses.

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Local Development Setup](#local-development-setup)
- [API Documentation](#api-documentation)
- [Deployment](#deployment)
- [Testing & Validation](#testing--validation)
- [Troubleshooting](#troubleshooting)
- [Project Structure](#project-structure)

## 🎯 Overview

Scogo AI IT Support Assistant is a full-stack solution that enables users to get AI-powered IT support through their Chrome browser. The system combines:

- **Chrome Extension** (Manifest V3) - User interface with Google OAuth authentication
- **Node.js Backend** - API server handling authentication, sessions, and LiveKit token generation
- **Python AI Agent** - LiveKit agent that streams audio/video to Google Gemini for intelligent responses
- **Real-time Communication** - LiveKit WebRTC for voice and screen sharing

### Key Capabilities

- 🎙️ **Voice Conversation** - Natural voice interaction with AI support agent
- 🖥️ **Screen Sharing** - AI can see your screen to provide contextual help
- 🔐 **Secure Authentication** - Google OAuth 2.0 integration
- 📊 **Session Tracking** - Full session metadata and analytics
- 💬 **Feedback Collection** - User satisfaction ratings and comments
- 📚 **Knowledge Base** - Customizable IT support documentation

## 🏗️ Architecture

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│                 │      │                 │      │                 │
│  Chrome         │─────▶│  Node.js        │      │  Python         │
│  Extension      │      │  Backend API    │      │  Agent Worker   │
│                 │      │                 │      │                 │
└────────┬────────┘      └────────┬────────┘      └────────┬────────┘
         │                        │                        │
         │    Google OAuth        │                        │
         └────────────────────────┘                        │
         │                                                 │
         │              LiveKit Cloud                      │
         └─────────────────┬───────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │   Google    │
                    │   Gemini    │
                    └─────────────┘
```

### Component Interaction Flow

1. **User Authentication**: Extension authenticates user via Google OAuth
2. **Session Creation**: Backend creates session and issues LiveKit token
3. **Room Connection**: Extension joins LiveKit room with microphone + screen tracks
4. **Agent Joins**: Python agent automatically joins the same room
5. **AI Processing**: Agent streams audio/video to Gemini for analysis
6. **Response Delivery**: Gemini's voice responses are delivered back to user
7. **Session Tracking**: Backend logs session metadata and user feedback

## ✨ Features

### Extension Features
- Google OAuth authentication
- One-click support session start
- Microphone and screen sharing
- Real-time audio feedback
- Session feedback collection
- Chrome action button with status indicators

### Backend Features
- RESTful API with comprehensive documentation
- LiveKit token generation
- Session management and logging
- Health monitoring endpoints
- CORS and security headers
- Interactive Swagger UI documentation

### Agent Features
- Real-time audio/video streaming to Gemini
- Customizable knowledge base
- Connection resilience with automatic retry
- Voice Activity Detection (VAD)
- Session context awareness

## 📦 Prerequisites

### Required Software

| Component | Requirement | Installation |
|-----------|-------------|--------------|
| Node.js | 18+ | [nodejs.org](https://nodejs.org) |
| Python | 3.11+ | [python.org](https://python.org) |
| npm | 8+ | Included with Node.js |
| Chrome | Latest | [google.com/chrome](https://google.com/chrome) |
| Docker | Latest (optional) | [docker.com](https://docker.com) |

### Required Accounts & Keys

1. **Google Cloud Project**
   - Create project at [console.cloud.google.com](https://console.cloud.google.com)
   - Enable Google+ API
   - Create OAuth 2.0 credentials (Desktop app type)
   - Add authorized redirect URI: `https://<extension-id>.chromiumapp.org/`

2. **LiveKit Cloud Account**
   - Sign up at [cloud.livekit.io](https://cloud.livekit.io)
   - Create a project
   - Get API Key, API Secret, and WebSocket URL

3. **Google Gemini API Key**
   - Get API key from [makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey)
   - Ensure you have access to Gemini 2.0 Flash

## 🚀 Quick Start

Get up and running in 5 minutes:

```bash
# 1. Clone the repository
git clone <repository-url>
cd sia-vision-ai-browser-extension

# 2. Set up environment variables
cp .env.example .env
# Edit .env with your credentials (see Configuration section)

# 3. Install dependencies
cd backend && npm install && cd ..
cd extension && npm install && cd ..
cd agent && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && cd ..

# 4. Start services (in separate terminals)
cd backend && npm start       # Terminal 1: Backend on http://localhost:4000
cd agent && source .venv/bin/activate && python main.py  # Terminal 2: Agent worker
cd extension && npm run build # Terminal 3: Build extension

# 5. Load extension in Chrome
# Open chrome://extensions
# Enable "Developer mode"
# Click "Load unpacked" and select extension/dist

# 6. Test it out!
# Click the Scogo icon in Chrome toolbar
# Sign in with Google
# Click "Get Support" to start a session
```

## 🛠️ Local Development Setup

### Step 1: Configure Environment Variables

Create a `.env` file in the project root:

```bash
# Copy the example file
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Environment
NODE_ENV=development
PORT=4000

# Backend URL (IMPORTANT!)
# Local: http://localhost:4000
# Docker: http://scogo-backend:4000
BACKEND_BASE_URL=http://localhost:4000

# CORS (add your frontend URLs)
CORS_ORIGINS=http://localhost:5173,http://localhost:3000,chrome-extension://*

# Google OAuth
GOOGLE_OAUTH_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_OAUTH_REDIRECT_URI=https://your-extension-id.chromiumapp.org/
GOOGLE_TOKEN_INFO_URL=https://oauth2.googleapis.com/tokeninfo

# LiveKit
LIVEKIT_API_KEY=your-livekit-api-key
LIVEKIT_API_SECRET=your-livekit-api-secret
LIVEKIT_HOST=wss://your-project.livekit.cloud
LIVEKIT_TOKEN_TTL_SECONDS=21600

# Gemini AI
GEMINI_API_KEY=your-gemini-api-key
GEMINI_REALTIME_MODEL=models/gemini-2.0-flash-exp
GEMINI_VOICE=Zephyr
GEMINI_TEMPERATURE=0.6

# Optional: Development
ALLOW_DEV_TOKENS=true
LOG_LEVEL=info
```

> 📖 See [.env.example](.env.example) for detailed configuration documentation

### Step 2: Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Start development server (with auto-reload)
npm run dev

# Or start production server
npm start

# Run linting
npm run lint
```

**Backend Endpoints:**
- `GET /health` - Service health check
- `GET /api/config` - Client configuration
- `POST /api/token/livekit` - Generate LiveKit token (requires auth)
- `POST /api/session/log` - Create/update session
- `GET /api/session` - List sessions
- `GET /api/session/:sessionId` - Get session by ID
- `POST /api/feedback` - Submit feedback
- `GET /api-docs` - **Interactive API documentation (Swagger UI)**
- `GET /api-docs.json` - OpenAPI specification

### Step 3: Extension Setup

```bash
cd extension

# Install dependencies
npm install

# Build extension
npm run build

# Or build in watch mode (for development)
npm run dev
```

**Load in Chrome:**
1. Open `chrome://extensions`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select `extension/dist` directory

**Extension Structure:**
- `dist/manifest.json` - Extension manifest
- `dist/background.js` - Service worker
- `dist/popup/` - Extension popup UI
- `dist/offscreen/` - Offscreen document for audio

### Step 4: Agent Setup

```bash
cd agent

# Create virtual environment
python -m venv .venv

# Activate virtual environment
source .venv/bin/activate  # macOS/Linux
# or
.venv\Scripts\activate     # Windows

# Install dependencies
pip install -r requirements.txt

# Run agent
python main.py
```

**Customize Knowledge Base:**
Add markdown files to `agent/knowledge_base/` for organization-specific IT support documentation.

### Step 5: Docker Compose (Optional)

Run all services with Docker:

```bash
# Start backend and agent
docker compose up --build backend agent

# Or start in detached mode
docker compose up -d backend agent

# Build extension in Docker
docker compose run --rm extension-builder

# View logs
docker compose logs -f backend
docker compose logs -f agent

# Stop services
docker compose down
```

## 📚 API Documentation

### Interactive Documentation (Swagger UI)

The backend includes comprehensive interactive API documentation:

**Access the documentation:**
```
http://localhost:4000/api-docs
```

**Features:**
- ✅ All 12 endpoints documented with request/response schemas
- ✅ "Try it out" functionality to test endpoints directly
- ✅ Authentication flow examples
- ✅ Request/response examples for all endpoints
- ✅ Data model definitions
- ✅ Error response formats

**OpenAPI Specification:**
```bash
# Get raw OpenAPI 3.0 spec
curl http://localhost:4000/api-docs.json

# View in browser
open http://localhost:4000/api-docs.json
```

### Authentication

All protected endpoints require a Google OAuth token:

```bash
# Example authenticated request
curl -X POST http://localhost:4000/api/token/livekit \
  -H "Authorization: Bearer <google-oauth-token>" \
  -H "Content-Type: application/json" \
  -d '{"roomName": "session-123"}'
```

**Development Mode:**
Set `ALLOW_DEV_TOKENS=true` in `.env` to bypass OAuth:

```bash
curl -X POST http://localhost:4000/api/token/livekit \
  -H "Authorization: Bearer dev-token" \
  -H "Content-Type: application/json" \
  -d '{"roomName": "session-123"}'
```

## 🚢 Deployment

### Pre-Deployment Validation

**Run the validation script before deploying:**

```bash
# Validate local development setup
./scripts/validate-deployment.sh development

# Validate production configuration
./scripts/validate-deployment.sh production
```

The script validates:
- ✅ Required commands installed
- ✅ Environment variables configured
- ✅ Backend service health
- ✅ API documentation accessible
- ✅ Extension build files present
- ✅ Security settings correct
- ✅ Network connectivity to LiveKit

**Example output:**
```
✓ Passed:   28
⚠ Warnings: 0
✗ Failed:   0
Total:      28

✓ All critical checks passed!
```

### Backend Deployment

**Recommended Platforms:**
- [Render](https://render.com)
- [Fly.io](https://fly.io)
- [Railway](https://railway.app)
- [Google Cloud Run](https://cloud.google.com/run)
- [AWS ECS](https://aws.amazon.com/ecs)

**Environment Variables to Set:**
```bash
NODE_ENV=production
BACKEND_BASE_URL=https://your-backend-domain.com
ALLOW_DEV_TOKENS=false  # IMPORTANT: Disable dev tokens!
# ... all other variables from .env
```

**Health Check Endpoint:**
Configure your platform to use `GET /health` for health checks.

**Example Dockerfile** (if needed):
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --production
COPY backend/ ./
EXPOSE 4000
CMD ["node", "src/server.js"]
```

### Agent Deployment

**Option 1: Managed Container Platform**

Deploy to Cloud Run, ECS, or Kubernetes:

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY agent/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY agent/ ./
CMD ["python", "main.py"]
```

**Option 2: Serverless Workers**

Configure LiveKit webhooks to scale workers automatically when rooms are created.

### Extension Deployment

**Chrome Web Store:**

1. Create a ZIP of `extension/dist`:
   ```bash
   cd extension/dist
   zip -r ../scogo-extension.zip .
   ```

2. Upload to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)

3. Update OAuth redirect URI with final extension ID

4. Submit for review

**Enterprise Distribution:**

For enterprise deployments, use [Chrome Enterprise Policy](https://support.google.com/chrome/a/answer/9296680).

## 🧪 Testing & Validation

### Backend Tests

```bash
cd backend

# Run linting
npm run lint

# Test health endpoint
curl http://localhost:4000/health

# Test API documentation
curl http://localhost:4000/api-docs.json
```

### Extension Build Validation

```bash
cd extension

# Build extension
npm run build

# Verify required files exist
ls -la dist/manifest.json
ls -la dist/background.js
ls -la dist/popup/popup.html
```

### Agent Connectivity Test

```bash
cd agent
source .venv/bin/activate

# Run agent (should connect to LiveKit)
python main.py

# Expected output:
# [Agent] Connecting to LiveKit...
# [Agent] Connected successfully
# [Agent] Waiting for room assignments...
```

### End-to-End Test

1. **Start all services:**
   ```bash
   # Terminal 1: Backend
   cd backend && npm start

   # Terminal 2: Agent
   cd agent && source .venv/bin/activate && python main.py

   # Terminal 3: Build extension
   cd extension && npm run build
   ```

2. **Load extension in Chrome**
3. **Open extension popup**
4. **Sign in with Google**
5. **Click "Get Support"**
6. **Verify:**
   - ✅ Microphone permission requested
   - ✅ Screen sharing permission requested
   - ✅ Extension shows "Connected" status
   - ✅ Agent joins room (check agent logs)
   - ✅ Can hear AI responses
   - ✅ Can see session in backend logs

### Deployment Validation

**Before deploying to production:**

```bash
# Run comprehensive validation
./scripts/validate-deployment.sh production

# Checklist:
# [ ] All environment variables set
# [ ] ALLOW_DEV_TOKENS=false
# [ ] NODE_ENV=production
# [ ] Backend health endpoint accessible
# [ ] API documentation accessible
# [ ] LiveKit credentials valid
# [ ] Gemini API key valid
# [ ] OAuth credentials configured
```

## 🔧 Troubleshooting

### Common Issues

#### 1. Backend fails to start

**Symptom:** `Error: LIVEKIT_API_KEY is required`

**Solution:**
```bash
# Check .env file exists and has correct values
cat .env | grep LIVEKIT_API_KEY

# Ensure .env is in project root
ls -la .env

# Restart backend
cd backend && npm start
```

#### 2. Extension authentication fails

**Symptom:** `Error: Invalid OAuth client ID`

**Solution:**
1. Verify `GOOGLE_OAUTH_CLIENT_ID` in `.env`
2. Rebuild extension: `cd extension && npm run build`
3. Reload extension in `chrome://extensions`
4. Check OAuth redirect URI includes extension ID

#### 3. Agent fails to connect to LiveKit

**Symptom:** `Connection refused` or `Failed to connect`

**Solution:**
```bash
# Check environment variables
echo $LIVEKIT_HOST
echo $LIVEKIT_API_KEY

# Verify LiveKit host is reachable
curl https://your-project.livekit.cloud

# Check agent logs for specific error
cd agent && python main.py
```

#### 4. No audio from AI agent

**Symptom:** Extension connected but no voice response

**Solution:**
1. Check agent logs for Gemini connection errors
2. Verify `GEMINI_API_KEY` is valid
3. Check microphone permissions in Chrome
4. Test audio output in browser: `chrome://settings/content/sound`
5. Click extension popup to enable audio playback

#### 5. Screen sharing not working

**Symptom:** Screen share permission denied or not capturing

**Solution:**
1. Check Chrome permissions: `chrome://settings/content/screenshare`
2. Verify `host_permissions` in `extension/dist/manifest.json`
3. Try reloading the extension
4. Check for Chrome flags blocking screen capture

#### 6. Docker container networking issues

**Symptom:** Agent can't reach backend in Docker

**Solution:**
```bash
# Ensure BACKEND_BASE_URL uses Docker service name
# In .env for Docker:
BACKEND_BASE_URL=http://scogo-backend:4000

# Check containers are on same network
docker compose ps
docker network inspect sia-vision-ai-browser-extension_default

# View backend logs
docker compose logs backend

# View agent logs
docker compose logs agent
```

### Debug Mode

**Enable verbose logging:**

```bash
# Backend - set in .env
LOG_LEVEL=debug

# Agent - set in .env
LOG_LEVEL=debug

# Extension - check browser console
# Open popup > Right-click > Inspect > Console tab
```

### Getting Help

1. **Check logs:** Backend, agent, and browser console
2. **Run validation:** `./scripts/validate-deployment.sh`
3. **Review documentation:** Check `.env.example` for configuration details
4. **API documentation:** Visit `http://localhost:4000/api-docs`
5. **Check issues:** Review existing GitHub issues

## 📁 Project Structure

```
sia-vision-ai-browser-extension/
├── backend/                    # Node.js API server
│   ├── src/
│   │   ├── config/            # Configuration and Swagger setup
│   │   ├── controllers/       # API endpoint handlers
│   │   ├── middleware/        # Express middleware
│   │   ├── routes/           # API routes
│   │   ├── services/         # Business logic
│   │   ├── utils/            # Utilities and logger
│   │   └── server.js         # Express app entry point
│   ├── package.json
│   └── Dockerfile
│
├── extension/                  # Chrome Extension (Manifest V3)
│   ├── src/
│   │   ├── background/       # Service worker
│   │   ├── popup/            # Extension popup UI
│   │   ├── offscreen/        # Offscreen audio document
│   │   ├── lib/              # Shared libraries
│   │   │   ├── session-manager.ts        # Session orchestration
│   │   │   ├── connection-manager.ts     # Connection state machine
│   │   │   └── audio-playback-manager.ts # Audio handling
│   │   └── manifest.json     # Extension manifest
│   ├── scripts/
│   │   └── build.js          # esbuild configuration
│   ├── dist/                 # Built extension (generated)
│   └── package.json
│
├── agent/                      # Python LiveKit Agent
│   ├── main.py               # Agent entry point
│   ├── requirements.txt      # Python dependencies
│   ├── knowledge_base/       # IT support documentation
│   └── Dockerfile
│
├── docs/                       # Documentation
│   ├── api/
│   │   └── openapi.yaml      # OpenAPI 3.0 specification
│   └── deployment/
│       └── configuration.md   # Configuration guide
│
├── scripts/
│   └── validate-deployment.sh # Deployment validation script
│
├── .env.example               # Environment template
├── .env                       # Local environment (gitignored)
├── docker-compose.yml         # Docker Compose configuration
└── README.md                  # This file
```

## 🔐 Security Considerations

### Production Security Checklist

- [ ] `ALLOW_DEV_TOKENS=false` in production
- [ ] `NODE_ENV=production`
- [ ] All API keys stored in secure secrets manager
- [ ] CORS origins limited to trusted domains
- [ ] HTTPS enabled for all endpoints
- [ ] OAuth redirect URIs validated
- [ ] Session logs retained according to policy (default: 90 days)
- [ ] Regular security audits performed
- [ ] Dependencies kept up to date

### Data Privacy

- User sessions are stored in memory by default
- Screen frames are processed in real-time (not stored)
- Audio streams are processed by Gemini (subject to Google's terms)
- Feedback is stored for analytics (anonymize if needed)

## 📄 License

[Your License Here]

## 🤝 Contributing

[Contributing guidelines if applicable]

## 📞 Support

For issues, questions, or feedback:
- Check the [Troubleshooting](#troubleshooting) section
- Review [API Documentation](http://localhost:4000/api-docs)
- Run validation: `./scripts/validate-deployment.sh`

---

**Built with ❤️ using LiveKit, Google Gemini, and Chrome Extensions**
