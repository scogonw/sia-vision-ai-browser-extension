# Scogo AI IT Support Assistant

This repository contains the full-stack reference implementation for the Scogo AI IT Support Assistant Chrome extension described in the product requirements document. It includes:

- A Manifest V3 Chrome extension that authenticates with Google, starts LiveKit voice + screen sharing sessions, and captures feedback.
- A Node.js backend that validates user tokens, issues LiveKit access tokens, tracks session metadata, and exposes configuration to the extension.
- A Python LiveKit agent worker that connects to the same room, streams audio/video to Gemini, and responds with contextual IT support guidance.

## Architecture Overview

```
Chrome Extension ──▶ Backend API ──▶ LiveKit Cloud ◀── Agent Worker
        │                │                │
        └────── Google OAuth ─────────────┘
```

1. The extension authenticates the user with Google and calls the backend for configuration.
2. When the user clicks **Get Support**, the extension requests a LiveKit token from the backend and publishes microphone + screen tracks to the room.
3. The Python agent worker joins the same room, streams frames and audio to Gemini Live, and delivers voice responses back to the user.
4. Session metadata and feedback are persisted via backend API endpoints for analytics.

## Prerequisites

| Component | Requirement |
|-----------|-------------|
| Chrome Extension | Google Cloud OAuth 2.0 client (Desktop app) |
| Backend | Node.js 18+, npm |
| Agent | Python 3.11+, LiveKit Cloud project, Gemini API key |

## Environment Variables

Create a `.env` file in the repository root (see `.env.example`) and fill in the values for your environment.

```env
NODE_ENV=development
PORT=4000
BACKEND_BASE_URL=http://localhost:4000
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
GOOGLE_OAUTH_CLIENT_ID=your-client-id.apps.googleusercontent.com
LIVEKIT_API_KEY=lkc_xxx
LIVEKIT_API_SECRET=lkss_xxx
LIVEKIT_HOST=wss://your-project.livekit.cloud
GEMINI_API_KEY=your-gemini-live-key
```

The extension build pipeline reads the same `.env` file so you only have to maintain one source of truth.

## Backend Setup

```bash
cd backend
npm install
npm run start
```

The backend exposes:

- `GET /health` – service heartbeat
- `GET /api/config` – extension runtime configuration
- `POST /api/token/livekit` – issues LiveKit room tokens (Google authentication required)
- `POST /api/session/log` – stores per-session analytics events
- `POST /api/feedback` – persists feedback submissions

Use `ALLOW_DEV_TOKENS=true` during local development to bypass Google OAuth by sending the header `Authorization: Bearer dev-token`.

## Extension Setup

The extension is bundled with esbuild. Build artifacts are located in `extension/dist` and can be loaded as an unpacked extension in Chrome.

```bash
cd extension
npm install
npm run build
```

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked** and select `extension/dist`.
4. Click the Scogo AI Support icon, sign in with Google, then start a support session.

> The extension relies on the backend for all secrets and LiveKit credentials; ensure the backend is running before attempting to start a session.

## Agent Worker Setup

```bash
cd agent
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

Environment variables consumed by the worker:

- `LIVEKIT_HOST`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
- `GEMINI_API_KEY` (Gemini Live token)
- `KNOWLEDGE_BASE_PATH` (optional path to markdown knowledge base)

The worker auto-loads markdown files from `agent/knowledge_base/` and appends the content to the Gemini prompt. Update this folder with organization-specific playbooks.

## Local Development Workflow

Use the [Local Deployment & Testing Guide](docs/local-deployment.md) for a step-by-step walkthrough. At a high level:

1. Populate `.env` with LiveKit, Gemini, and Google OAuth credentials.
2. Start the backend (`npm run start` in `backend/`).
3. Run the agent worker (`python agent/main.py`).
4. Build and load the Chrome extension (`npm run build` in `extension/`).
5. Open the extension popup, authenticate, and start a session.

## Testing

- Backend linting: `cd backend && npm run lint`
- Extension build validation: `cd extension && npm run build`
- Agent connectivity: run `python agent/main.py` and ensure it connects to your LiveKit project without errors.

## Deployment Notes

- Deploy the backend to your preferred Node.js hosting platform (Fly.io, Render, Cloud Run) using the same environment variables.
- Package and publish the extension to the Chrome Web Store using the `extension/dist` folder.
- Containerize the agent worker and deploy it to a managed compute platform (Cloud Run, ECS, Kubernetes). Configure LiveKit webhooks to scale workers as new rooms are created.

Refer to `docs/scogo-ai-it-support-assistant-prd.md` for detailed product and testing requirements.
