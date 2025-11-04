# Scogo AI IT Support Assistant - Chrome Extension

A production-ready Chrome browser extension that enables enterprise users to receive real-time IT support through AI-powered voice and screen sharing sessions powered by LiveKit and Google Gemini Live API.

![Scogo AI IT Support](screenshot.jpg)

## 🎯 Features

### Core Capabilities
- **Real-time Voice Communication**: Natural voice conversations with AI support agent
- **Screen Sharing**: Share your screen for visual problem diagnosis
- **AI-Powered Support**: Google Gemini Live API for intelligent IT issue resolution
- **Instant Response**: Get help without waiting for human agents
- **Secure & Private**: End-to-end encryption with LiveKit WebRTC

### IT Support Coverage
- Software installation and configuration
- Network connectivity problems
- Email and Outlook issues
- VPN connection setup
- Printer configuration
- Application crashes and errors
- Windows Update issues
- Password resets and account lockouts
- File sharing and permissions
- Browser configuration

## 🏗️ Architecture

The system consists of three main components:

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│  Chrome         │      │  Token Service  │      │  Python Agent   │
│  Extension      │◄────►│  (Node.js)      │      │  (LiveKit)      │
│  (Frontend)     │      │                 │      │                 │
└────────┬────────┘      └─────────────────┘      └────────┬────────┘
         │                                                  │
         │                ┌─────────────────┐              │
         └───────────────►│   LiveKit       │◄─────────────┘
                          │   Server        │
                          └────────┬────────┘
                                   │
                          ┌────────▼────────┐
                          │  Gemini Live    │
                          │  API (Google)   │
                          └─────────────────┘
```

### Components

1. **Chrome Extension** (`/extension`)
   - User interface and controls
   - LiveKit client integration
   - Screen sharing and audio capture
   - Session management

2. **Token Service** (`/token-service`)
   - LiveKit token generation
   - User authentication
   - Session logging

3. **Python Agent** (`/agent`)
   - LiveKit agent backend
   - Gemini Live API integration
   - IT support logic and instructions

## 🚀 Quick Start

### Prerequisites

- **Chrome Browser** (version 90+)
- **Node.js** (v18+)
- **Python** (3.11+)
- **LiveKit Account** ([Sign up for free](https://cloud.livekit.io))
- **Google Gemini API Key** ([Get API key](https://ai.google.dev))

### Setup

#### 1. Set Up the Python Agent

```bash
cd agent

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file with your credentials
echo "LIVEKIT_URL=wss://your-project.livekit.cloud" >> .env
echo "LIVEKIT_API_KEY=your_api_key" >> .env
echo "LIVEKIT_API_SECRET=your_api_secret" >> .env
echo "GOOGLE_API_KEY=your_gemini_api_key" >> .env
```

#### 2. Set Up the Token Service

```bash
cd ../token-service

# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env with your LiveKit credentials
```

#### 3. Load the Chrome Extension

```bash
cd ../extension

# Install LiveKit client SDK
npm install livekit-client

# Load in Chrome:
# 1. Go to chrome://extensions
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the extension directory
```

### Running the System

**Terminal 1: Start the Python Agent**
```bash
cd agent
source .venv/bin/activate
python main.py dev
```

**Terminal 2: Start the Token Service**
```bash
cd token-service
npm run dev
```

**Terminal 3: Use the Extension**
1. Click the extension icon in Chrome
2. Sign in (mock auth for development)
3. Click "Get Support" to start a session

## 📖 Usage

### For End Users

1. **Start Support Session**: Click extension icon → "Get Support"
2. **Grant Permissions**: Allow microphone and select screen to share
3. **Describe Issue**: Talk to the AI agent about your problem
4. **Follow Guidance**: Agent provides step-by-step instructions
5. **End Session**: Click "End Session" when resolved

### For Developers

#### Extension Development

```bash
cd extension

# The extension uses vanilla JavaScript with LiveKit SDK
# Key files:
# - manifest.json: Extension configuration
# - background.js: Service worker (main controller)
# - popup/: UI components
# - lib/session-manager.js: LiveKit integration
```

#### Testing with Agents Playground

Test the agent without the extension at [agents-playground.livekit.io](https://agents-playground.livekit.io):

1. Select your LiveKit project
2. Enable camera for screen sharing
3. Connect and interact with the agent

## 🔒 Security

- **Authentication**: OAuth 2.0 (mock in development)
- **Transport**: WebRTC with DTLS-SRTP encryption
- **Privacy**: No persistent storage of frames or audio
- **GDPR**: Compliant data handling

## 🧪 Testing

### Manual Testing

1. Load extension in Chrome DevTools mode
2. Open console (right-click icon → "Inspect popup")
3. Test flows: auth → session start → screen share → end
4. Check logs for errors

### LiveKit Agents Playground

Compatible with the [Agents Playground](https://agents-playground.livekit.io) for quick testing.

## 🛠️ Project Structure

```
sia-vision-ai-browser-extension/
├── agent/                    # Python LiveKit agent
│   ├── main.py              # IT Support agent implementation
│   ├── requirements.txt     # Python dependencies
│   └── .env                 # Environment variables
├── token-service/           # Node.js backend
│   ├── src/
│   │   ├── server.js       # Express server
│   │   ├── routes/token.js # Token generation endpoint
│   │   └── services/       # Business logic
│   └── package.json
├── extension/               # Chrome extension
│   ├── manifest.json       # Extension manifest
│   ├── background.js       # Service worker
│   ├── popup/              # UI components
│   │   ├── popup.html
│   │   ├── popup.css
│   │   └── popup.js
│   └── lib/                # Helper libraries
│       └── session-manager.js
└── README.md
```

## 🔧 Configuration

### Extension Configuration

Update `extension/background.js`:

```javascript
const CONFIG = {
  TOKEN_SERVICE_URL: 'http://localhost:3000/api/v1/token',
  LIVEKIT_URL: 'wss://your-project.livekit.cloud',
};
```

### Agent Configuration

The agent instructions are in `agent/main.py`. Customize the IT support capabilities by modifying the `instructions` parameter.

## 📊 Deployment

### Production Checklist

- [ ] Set up production LiveKit project
- [ ] Configure OAuth 2.0 (replace mock auth)
- [ ] Deploy token service to cloud
- [ ] Package extension for Chrome Web Store
- [ ] Set up monitoring and analytics
- [ ] Configure proper CORS headers
- [ ] Enable rate limiting
- [ ] Set up error tracking

### Docker Deployment

**Token Service:**
```bash
cd token-service
docker build -t scogo-token-service .
docker run -p 3000:3000 --env-file .env scogo-token-service
```

**Python Agent:**
```bash
cd agent
docker build -t scogo-it-agent .
docker run --env-file .env scogo-it-agent
```

## 🐛 Troubleshooting

### Common Issues

**Extension won't load:**
- Check manifest.json syntax
- Verify all permissions
- Check Chrome console for errors

**Connection fails:**
- Verify LiveKit credentials in .env
- Check token service is running
- Ensure WebRTC ports are open

**No audio:**
- Grant microphone permission
- Check audio output device
- Verify track is published

**Screen share not working:**
- Grant screen share permission
- Check desktopCapture permission in manifest
- Try different share options

## 📝 License

MIT License - see [LICENSE](LICENSE) file

## 🙏 Acknowledgments

- Built with [LiveKit](https://livekit.io)
- Powered by [Google Gemini](https://ai.google.dev)
- Based on [LiveKit Vision Demo](https://github.com/livekit-examples/gemini-multimodal)

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/your-org/sia-vision-ai-browser-extension/issues)
- **Documentation**: See `/docs` folder
- **LiveKit Docs**: [docs.livekit.io](https://docs.livekit.io)

---

**Made by the Scogo AI Team**
