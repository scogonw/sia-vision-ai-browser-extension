# Setup Guide - Scogo AI IT Support Assistant

This guide will walk you through setting up the complete system from scratch.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Getting Credentials](#getting-credentials)
3. [Setting Up Components](#setting-up-components)
4. [Testing the System](#testing-the-system)
5. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software

- **Chrome Browser**: Version 90 or higher
- **Node.js**: Version 18 or higher ([Download](https://nodejs.org))
- **Python**: Version 3.11 or higher ([Download](https://python.org))
- **Git**: For cloning the repository ([Download](https://git-scm.com))

### Verify Installations

```bash
# Check Chrome version
google-chrome --version  # or chrome --version on macOS

# Check Node.js
node --version  # Should be v18 or higher

# Check Python
python --version  # Should be 3.11 or higher

# Check Git
git --version
```

## Getting Credentials

### 1. LiveKit Account

1. Go to [LiveKit Cloud](https://cloud.livekit.io)
2. Sign up for a free account
3. Create a new project
4. Navigate to **Settings** → **Keys**
5. Copy your:
   - LiveKit URL (e.g., `wss://your-project.livekit.cloud`)
   - API Key
   - API Secret

### 2. Google Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click **Get API Key**
4. Create or select a project
5. Copy your API key

## Setting Up Components

### Step 1: Clone the Repository

```bash
git clone https://github.com/your-org/sia-vision-ai-browser-extension.git
cd sia-vision-ai-browser-extension
```

### Step 2: Set Up the Python Agent

```bash
# Navigate to agent directory
cd agent

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# On macOS/Linux:
source .venv/bin/activate
# On Windows:
.venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env

# Edit .env file with your credentials
# Use your favorite text editor:
nano .env  # or vim, code, notepad, etc.
```

Your `agent/.env` should look like:

```env
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=APIxxx...
LIVEKIT_API_SECRET=xxx...
GOOGLE_API_KEY=AIzaSy...
LOG_LEVEL=INFO
```

### Step 3: Set Up the Token Service

```bash
# Navigate to token service (from repository root)
cd ../token-service

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env file
nano .env  # or your preferred editor
```

Your `token-service/.env` should look like:

```env
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=APIxxx...
LIVEKIT_API_SECRET=xxx...
PORT=3000
NODE_ENV=development
ALLOWED_ORIGINS=chrome-extension://
RATE_LIMIT_WINDOW_MS=3600000
RATE_LIMIT_MAX_REQUESTS=10
```

### Step 4: Set Up the Chrome Extension

```bash
# Navigate to extension directory
cd ../extension

# Install LiveKit client SDK
npm install

# No .env needed for extension (configuration is in background.js)
```

Update the configuration in `extension/background.js`:

```javascript
const CONFIG = {
  TOKEN_SERVICE_URL: 'http://localhost:3000/api/v1/token',
  LIVEKIT_URL: 'wss://your-project.livekit.cloud',
};
```

## Running the System

### Terminal 1: Start the Python Agent

```bash
cd agent
source .venv/bin/activate  # Activate if not already active
python main.py dev
```

You should see:
```
INFO:it-support-agent:Agent worker started
INFO:it-support-agent:Waiting for jobs...
```

### Terminal 2: Start the Token Service

```bash
cd token-service
npm run dev
```

You should see:
```
Token service running on port 3000
Environment: development
LiveKit URL: wss://your-project.livekit.cloud
```

### Terminal 3: Load the Extension in Chrome

1. Open Chrome
2. Navigate to `chrome://extensions`
3. Enable **Developer mode** (toggle in top-right corner)
4. Click **Load unpacked**
5. Select the `extension` directory from your project
6. The extension icon should appear in your toolbar

## Testing the System

### 1. Basic Extension Test

1. Click the extension icon in Chrome toolbar
2. You should see the "Sign In" button
3. Click "Sign In" (uses mock authentication)
4. You should see "Get Support" button

### 2. Test Session Connection

1. Click "Get Support"
2. Allow microphone access when prompted
3. Select what to share (try "Tab" for testing)
4. Click "Share"

Expected behavior:
- Extension shows "Connecting..." then "Connected"
- Python agent logs show "Starting IT Support Agent"
- Token service logs show token generation request

### 3. Test Voice Interaction

1. In an active session, speak to test the microphone
2. AI agent should respond with a greeting
3. You can ask IT support questions

### 4. Test Session End

1. Click "End Session"
2. Confirm the dialog
3. Extension should return to idle state
4. Agent logs should show session ended

## Verification Checklist

- [ ] Python agent starts without errors
- [ ] Token service starts without errors
- [ ] Extension loads in Chrome without errors
- [ ] Can sign in (mock auth works)
- [ ] Can start a support session
- [ ] Microphone permission granted
- [ ] Screen sharing works
- [ ] Agent responds to voice
- [ ] Can end session cleanly

## Troubleshooting

### Python Agent Issues

**Error: "No module named 'livekit'"**
```bash
# Make sure virtual environment is activated
source .venv/bin/activate
# Reinstall dependencies
pip install -r requirements.txt
```

**Error: "Invalid Google API key"**
```bash
# Check your .env file
cat .env | grep GOOGLE_API_KEY
# Verify the key is correct at https://makersuite.google.com/app/apikey
```

**Error: "LiveKit connection failed"**
```bash
# Check your LiveKit credentials
# Verify the URL format: wss://your-project.livekit.cloud
# Ensure API key and secret are correct
```

### Token Service Issues

**Error: "EADDRINUSE: address already in use"**
```bash
# Port 3000 is already in use
# Either stop the other process or change the port in .env
PORT=3001
```

**Error: "LiveKit credentials not configured"**
```bash
# Check your .env file exists and has correct values
cat .env
```

### Extension Issues

**Extension won't load**
```bash
# Check manifest.json for syntax errors
# Look for error messages in chrome://extensions
# Check the Chrome console for specific errors
```

**"Get Support" button doesn't work**
```bash
# Open extension popup
# Right-click → Inspect
# Check Console tab for errors
# Verify token service is running (http://localhost:3000/health)
```

**No microphone access**
```bash
# Chrome Settings → Privacy and security → Site Settings
# → Microphone → Check permissions
# Ensure the extension has microphone access
```

**Screen sharing doesn't work**
```bash
# Check desktopCapture permission in manifest.json
# Try refreshing the extension (chrome://extensions → reload)
# Grant permission when Chrome prompts
```

### Connection Issues

**Agent doesn't join room**
```bash
# Verify all three components are running
# Check Python agent logs for errors
# Verify LiveKit credentials match across all components
# Try testing with Agents Playground: https://agents-playground.livekit.io
```

**Network/Firewall Issues**
```bash
# WebRTC requires UDP ports
# Check firewall allows:
# - TCP 443 (HTTPS)
# - UDP 3478 (STUN)
# - TCP/UDP 443 (TURN)
```

## Next Steps

Once everything is working:

1. **Customize the Agent**: Modify instructions in `agent/main.py`
2. **Implement Real Auth**: Replace mock auth with Google OAuth 2.0
3. **Deploy to Production**: See deployment guides for each component
4. **Monitor Usage**: Set up analytics and logging
5. **Gather Feedback**: Test with real users and iterate

## Getting Help

- **Documentation**: See main [README.md](README.md)
- **LiveKit Docs**: https://docs.livekit.io
- **Gemini Docs**: https://ai.google.dev/docs
- **Issues**: [GitHub Issues](https://github.com/your-org/sia-vision-ai-browser-extension/issues)

## Additional Resources

- [LiveKit Agents Documentation](https://docs.livekit.io/agents)
- [Chrome Extension Development](https://developer.chrome.com/docs/extensions)
- [WebRTC Troubleshooting](https://webrtc.github.io/samples/)
- [Gemini Live API Guide](https://ai.google.dev/gemini-api/docs/live)
