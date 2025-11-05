# Local Deployment & Testing Guide

This guide walks you through the exact steps required to run the Scogo AI IT Support Assistant stack (backend API, Chrome extension, and LiveKit agent worker) on a local workstation. Follow the checklist in order so that authentication, LiveKit connectivity, and Gemini access all work together without manual debugging.

## 1. Prerequisites

| Area | Requirement |
| --- | --- |
| Operating System | Windows, macOS, or Linux capable of running Chrome |
| Browser | Google Chrome 110+ (Developer Mode enabled for extensions) |
| Node.js | v18.x or v20.x with npm 9+ |
| Python | 3.11+ with `venv` module |
| LiveKit | Cloud project with API key/secret and accessible `wss://` URL |
| Google OAuth | OAuth 2.0 client (Desktop type) with authorized redirect URIs |
| Gemini | Google AI Studio API key with Gemini Live enabled |
| Network | Ability to reach `oauth2.googleapis.com`, LiveKit Cloud, and Gemini endpoints |

> **Tip:** Collect the LiveKit host URL, Google OAuth client ID, and Gemini API key before you begin. Keep them in a password manager—they will be reused by every service.

## 2. Configure Environment Variables

1. Copy the shared template:
   ```bash
   cp .env.example .env
   ```
2. Populate the values:
   - `BACKEND_BASE_URL` – normally `http://localhost:4000` during local runs.
   - `GOOGLE_OAUTH_CLIENT_ID` – from Google Cloud Console.
   - `LIVEKIT_HOST`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` – from LiveKit Cloud.
   - `GEMINI_API_KEY` – from Google AI Studio.
   - Set `ALLOW_DEV_TOKENS=true` if you want to bypass OAuth during early backend testing (see §6).

The `.env` file is consumed by the backend, extension build pipeline, and agent worker so you only edit the values once.

## 3. Start the Backend API

```bash
cd backend
npm install
npm run start
```

Verification checklist:
- Terminal shows `Backend listening on port 4000` (or your configured port).
- `curl http://localhost:4000/health` returns `{ "status": "ok", ... }`.
- If `ALLOW_DEV_TOKENS=true`, `curl -H "Authorization: Bearer dev-token" http://localhost:4000/api/session` should return an empty session list instead of `401`.

Leave this terminal running; the extension and agent rely on it.

## 4. Launch the LiveKit Agent Worker

```bash
cd agent
python -m venv .venv
source .venv/bin/activate  # On Windows use: .venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

Verification checklist:
- Startup logs display the LiveKit URL and confirm the worker connected successfully.
- No exception about missing `GEMINI_API_KEY`—double check `.env` if you see one.
- The process continues running, waiting for rooms to be assigned.

## 5. Build and Load the Chrome Extension

```bash
cd extension
npm install
npm run build
```

Then load the unpacked extension:
1. Open `chrome://extensions`.
2. Toggle **Developer mode** in the top-right corner.
3. Click **Load unpacked** and select the generated `extension/dist` folder.
4. Pin the “Scogo AI IT Support Assistant” icon so you can open the popup easily.

## 6. Authenticate and Start a Test Session

1. Ensure the backend and agent terminals are still running.
2. Click the extension icon → **Sign in with Google**.
   - Chrome opens the OAuth consent screen using your configured client ID.
   - On success, the extension stores the access token in Chrome storage.
3. Click **Get Support** to initiate a session.
   - Grant microphone and screen sharing permissions when prompted.
   - The backend issues a LiveKit token and the agent should join automatically.
4. Speak into your microphone and confirm you hear the agent’s voice response.
5. Click **End Session**, then submit optional feedback to exercise all APIs.

### Using the Development Token (Optional)
If you do not have Google OAuth ready, you can still exercise the backend APIs:
1. Set `ALLOW_DEV_TOKENS=true` in `.env` (already true in the template).
2. Use `Authorization: Bearer dev-token` on HTTP requests when testing the backend manually.
3. For the extension, you still need Google OAuth to obtain a real Chrome token—Chrome does not allow bypassing the consent flow.

## 7. Smoke Tests Before Stopping

Run the quick checks below to confirm the repo is in a healthy state:

```bash
# Backend linting
cd backend
npm run lint

# Extension build (ensures env injection + manifest generation)
cd ../extension
npm run build

# Agent bytecode compilation
cd ../agent
python -m compileall .
```

All commands should exit with status code `0`. Investigate any errors before continuing.

## 8. Troubleshooting Tips

| Symptom | Likely Cause | Fix |
| --- | --- | --- |
| `401 Invalid authentication token` from backend | Access token missing or expired | Sign back in through the extension or call the API with a fresh Google OAuth token |
| Agent exits with `GEMINI_API_KEY is required` | `.env` not loaded before running agent | Run `source .venv/bin/activate` and ensure `.env` exists in repo root |
| Extension cannot connect to LiveKit | Backend not running, wrong `BACKEND_BASE_URL`, or LiveKit host typo | Verify backend logs and ensure `.env` values match your LiveKit Cloud project |
| Screen share stops immediately | Browser permission revoked or desktop capture denied | Re-run the session and choose an entire screen/window; verify Chrome has screen recording rights (macOS privacy settings) |
| No agent audio playback | Browser blocked autoplay | Look for the Chrome “Play” icon in the omnibox and click to allow sound |

Following this checklist end-to-end ensures that every moving part—from OAuth to LiveKit and Gemini—functions before you invest time in deeper development work.
