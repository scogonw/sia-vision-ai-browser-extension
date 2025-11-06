# How to View Extension Logs for Debugging

The extension has 3 different contexts where logs appear. You need to check all 3 to see the complete picture:

## 1. **Service Worker (Background Script)** - Most Important for Session Management
This is where you'll see the START_SESSION and END_SESSION messages being forwarded.

**How to access:**
1. Go to `chrome://extensions/`
2. Make sure "Developer mode" is enabled (top right)
3. Find "Scogo AI IT Support Assistant"
4. Click the "service worker" link (or "background page" if you see that)
5. This opens DevTools for the background service worker

**What you'll see:**
- `[Background] START_SESSION - Forwarding to offscreen document`
- `[Background] END_SESSION - Forwarding to offscreen document`
- `[Background] Offscreen document created`

## 2. **Offscreen Document** - Where SessionManager Lives
This is where all the SessionManager logs are (the ones with `===== STARTING NEW SESSION =====`).

**How to access:**
1. Go to `chrome://extensions/`
2. Find your extension
3. Click "Inspect views" → "offscreen.html"
   - NOTE: This link only appears AFTER you've started a session at least once
   - If you don't see it, start a session first, then refresh the extensions page

**What you'll see:**
- `[SessionManager] ===== STARTING NEW SESSION =====`
- `[SessionManager] Pre-start state check:`
- `[SessionManager] ⚠️  Found leftover session data!` (if there's leftover data)
- `[SessionManager] ===== SESSION CLEANUP COMPLETE =====`
- `[SessionManager] Audio track subscribed, attaching to DOM`

## 3. **Side Panel (Popup)** - User Interface Logs
This is what you currently have open in your screenshot.

**How to access:**
1. Open the extension side panel
2. Right-click anywhere in the panel
3. Click "Inspect"

**What you'll see:**
- `[Popup] Checking microphone permission...`
- `[Popup] Microphone permission already granted`

## Complete Testing Workflow

To properly test and see all logs for the double-audio issue:

### First Session:
1. Open Service Worker DevTools (chrome://extensions/ → service worker)
2. Open extension and start a session
3. Watch Service Worker console for `[Background] START_SESSION`
4. Go to chrome://extensions/ and look for "offscreen.html" under your extension
5. Click it to open Offscreen DevTools
6. You should see `[SessionManager] ===== STARTING NEW SESSION =====`
7. End the session
8. Watch Offscreen console for `[SessionManager] ===== SESSION CLEANUP COMPLETE =====`
9. Verify Final state shows: `hasRoom: false`, `hasAudioTrack: false`, `remoteAudioElementsCount: 0`

### Second Session (Testing for duplicates):
1. Start a new session
2. In Offscreen console, look for `[SessionManager] Pre-start state check:`
3. **If you see** `⚠️  Found leftover session data!` - this means cleanup failed
4. **If you don't see the warning** - cleanup worked properly
5. Listen for duplicate audio
6. Check Offscreen console for how many times you see `[SessionManager] Audio track subscribed, attaching to DOM`
   - Should only see it ONCE per remote participant
   - If you see it TWICE, that's the problem

## Quick Debug Command

If you can't access the offscreen console UI, you can also check programmatically:

Open Service Worker console and run:
```javascript
chrome.runtime.getContexts({contextTypes: ['OFFSCREEN_DOCUMENT']}).then(contexts => {
  console.log('Offscreen contexts:', contexts);
});
```

This will show you if the offscreen document exists and is running.
