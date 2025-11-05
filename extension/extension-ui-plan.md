# Scogo AI Browser Extension - UI Component Documentation

**Version:** 1.1.0
**Last Updated:** 2025-11-05
**Prepared For:** UI/UX Team

---

## Table of Contents

1. [Extension Overview](#extension-overview)
2. [Component Architecture](#component-architecture)
3. [Main UI Components](#main-ui-components)
4. [Utility Components](#utility-components)
5. [Design System](#design-system)
6. [User Flows](#user-flows)
7. [Component State Management](#component-state-management)
8. [File Reference Guide](#file-reference-guide)

---

## Extension Overview

The Scogo AI IT Support browser extension provides an AI-powered voice assistant for technical support. Users can have voice conversations with the AI assistant (SIA), share their screen for visual problem diagnosis, and receive real-time help.

### Extension Structure

- **Extension Type:** Chrome Browser Extension (Manifest V3)
- **Primary Interface:** Side Panel (380px wide)
- **Entry Point:** Popup window via toolbar icon
- **Key Features:** Voice chat, screen sharing, real-time transcription
- **Platform:** Chrome browser on desktop

---

## Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser Toolbar                          │
│                  [Extension Icon]                           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓ Click
┌─────────────────────────────────────────────────────────────┐
│                  POPUP COMPONENT                            │
│  ┌───────────────────────────────────────────────┐          │
│  │  Logo + Title + Subtitle                      │          │
│  │  [Open Assistant Button]                      │          │
│  └───────────────────────────────────────────────┘          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ↓ Opens Side Panel
┌─────────────────────────────────────────────────────────────┐
│                  SIDEBAR COMPONENT                          │
│  ┌───────────────────────────────────────────────┐          │
│  │  Top Bar (Logo, Brand, Controls)              │          │
│  ├───────────────────────────────────────────────┤          │
│  │  Session Status (Idle/Listening/Speaking)     │          │
│  ├───────────────────────────────────────────────┤          │
│  │  Conversation Area                            │          │
│  │  • Welcome Message                            │          │
│  │  • User Messages (hidden for privacy)         │          │
│  │  • SIA Messages                               │          │
│  │  • System Messages                            │          │
│  ├───────────────────────────────────────────────┤          │
│  │  Call Control Bar                             │          │
│  │  • Talk to SIA Button (idle state)            │          │
│  │  • Call Controls (active state)               │          │
│  │    - Share Screen                             │          │
│  │    - Mute/Unmute                              │          │
│  │    - End Call                                 │          │
│  └───────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────┘

Supporting Components:
├── Permission Request UI (microphone access)
├── Test Connection Utility (troubleshooting)
└── Offscreen Document (background permissions)
```

---

## Main UI Components

### 1. Popup Component

**Purpose:** Initial entry point when user clicks extension icon

**File Locations:**
- HTML: `extension/popup.html`
- CSS: `extension/css/popup.css`
- JavaScript: `extension/js/popup.js`

**Dimensions:** 300px × auto height

#### UI Elements

| Element | Description | Styling |
|---------|-------------|---------|
| **Logo** | Brand logo (64×64px) | Rounded corners (8px), centered |
| **Title** | Dynamic brand name | 20px, bold, Primary Blue (#00529C) |
| **Subtitle** | "IT Support Assistant" | 14px, medium gray (#555555) |
| **Action Button** | "Open Assistant" | Blue gradient, white text, 8px radius |

#### User Flow

1. User clicks extension icon in toolbar (or Ctrl/Cmd+Shift+M)
2. Popup window appears with branding
3. User clicks "Open Assistant" button
4. Side panel opens on current tab
5. Popup automatically closes

#### Interactive States

**Button Hover:**
- Darker gradient background
- Slight upward movement (1px)
- Enhanced shadow

**Button Active:**
- Returns to original position
- Original shadow restored

---

### 2. Sidebar Component

**Purpose:** Main conversation interface with voice and screen sharing controls

**File Locations:**
- HTML: `extension/sidebar.html`
- CSS: `extension/css/sidebar.css`
- JavaScript: `extension/js/sidebar.js`

**Dimensions:** 380px × 100vh (full height)

#### Section Breakdown

##### 2.1 Top Bar

**Background:** White with 4px gradient accent line
**Height:** ~70px

| Element | Purpose | Interactions |
|---------|---------|--------------|
| **Logo** | Visual brand identity | Animated shine effect (rotating gradient) |
| **Brand Name** | Company name | Gradient text effect |
| **Version** | "IT Support Assistant v0.0.2" | Static display |
| **New Conversation** | Clear chat + reset | Click → Clears conversation area |
| **Settings** | Configuration (hidden) | Currently not visible |
| **Pin** | Keep panel visible | Click → Toggle pin state |

##### 2.2 Session Status

**Background:** White
**Height:** ~38px

| Element | States | Colors |
|---------|--------|--------|
| **Status Dot** | Idle | Gray (static) |
|  | Listening | Amber with pulse animation |
|  | Speaking | Green with pulse animation |
|  | Connecting | Blue with pulse animation |
| **Status Text** | Dynamic | "Ready to help", "Listening…", etc. |

##### 2.3 Conversation Area

**Background:** Light gray (#F8F9FA)
**Scrollable:** Yes (custom scrollbar)

**Message Types:**

1. **Welcome Message**
   - Large rounded bubble with gradient background
   - 3px gradient accent on top
   - Feature list with staggered slide-in animations
   - Icons: 🎤 🖥️ ⚡

2. **User Messages**
   - Blue background (#00529C)
   - White text
   - Right-aligned
   - **Currently hidden** for privacy (code skips rendering)

3. **SIA Messages**
   - White background
   - Dark text (#333333)
   - Left-aligned
   - Avatar with gradient background

4. **System Messages**
   - Centered gray pill
   - Icons: 🚀 ✅ 🔇 🖥️ 🆕
   - Examples: "Initializing...", "Online and ready", etc.

##### 2.4 Call Control Bar

**Background:** White
**Padding:** 24px

**State A: Idle (No Active Call)**

| Element | Appearance |
|---------|------------|
| **"Talk to SIA" Button** | Large green gradient button |
|  | 200px × 60px |
|  | Microphone icon (24×24px) |
|  | Bold white text |
|  | Multi-layer shadow |

**Hover Effect:**
- Darker green gradient
- Moves up 3px
- Enhanced glowing shadow

**State B: Active Call**

| Control | Appearance | Function |
|---------|------------|----------|
| **Call Duration Section** | Red-tinted gradient container | Shows elapsed time (MM:SS) |
|  | Animated progress bars | 5 green bars with pulse effect |
|  | Pulsing red dot | Breathing animation |
| **Share Screen Button** | Blue-teal gradient | Opens screen sharing |
|  | Changes to orange when active | "Stop Sharing" label |
| **Mute Button** | Gray background (normal) | Toggle microphone |
|  | Red gradient (muted) | "MUTED" badge appears |
| **End Call Button** | Red circular button | Ends voice session |
|  | X icon only | Hover scales up |

##### 2.5 Screen Share Modal

**Trigger:** Click "Share Screen" button (currently bypassed)
**Background:** Semi-transparent black overlay
**Content:** White card (320px) centered

**Options:**
1. Current Tab (⭐ icon)
2. Application Window (□ icon)
3. Entire Screen (⬜ icon)

##### 2.6 Permission Guidance

**Trigger:** Microphone permission denied
**Display:** Inline in conversation area

**Structure:**
- Yellow header with warning emoji
- Step-by-step instructions
- Links to Chrome settings
- "Try Again" button

---

## Utility Components

### 3. Permission Request UI

**Purpose:** Interactive microphone permission flow

**File Location:** `extension/permission.html`

**Display Context:** Opens as new browser tab when permission needed

**UI Elements:**
- Dark background (#0f172a)
- Centered white text
- Status message: "Requesting microphone permission…"
- Updates to "Permission granted! Cleaning up..."

**Flow:**
1. Opens automatically when direct permission fails
2. Browser shows native permission dialog
3. User grants permission
4. Tab closes after 300ms
5. Returns to sidebar with microphone access

---

### 4. Test Connection Utility

**Purpose:** Diagnose backend connectivity issues

**File Location:** `extension/test-connection.html`

**Display Context:** Standalone page for troubleshooting

**UI Layout:**
```
┌─────────────────────────────────────────┐
│  🔌 WebSocket Connection Test           │
├─────────────────────────────────────────┤
│  Testing Connection To:                 │
│  HTTP: https://...                      │
│  WebSocket: wss://...                   │
├─────────────────────────────────────────┤
│  [Test WebSocket] [Test HTTP] [Clear]  │
├─────────────────────────────────────────┤
│  Connection Log:                        │
│  [Colored timestamped messages]         │
└─────────────────────────────────────────┘
```

**Log Colors:**
- Green: Successful connections
- Red: Errors
- Blue: Info messages

---

### 5. Offscreen Document

**Purpose:** Background microphone permission handling

**File Location:** `extension/offscreen.html`

**Display:** Invisible to users (background process)

**Function:** Allows permission requests in restricted browser contexts

---

## Design System

### Color Palette

#### Primary Brand Colors
- **Primary Blue:** `#00529C` - Main brand color
- **Secondary Teal:** `#4DBFBB` - Accent color

#### Semantic Colors
- **Success/Talk:** `#10B981` (Green)
- **Danger/End:** `#D32F2F` (Red)
- **Warning:** `#F59E0B` (Amber)
- **Info:** `#2196F3` (Blue)

#### Backgrounds
- **Primary:** `#F8F9FA` (Light gray)
- **Secondary:** `#FFFFFF` (White)
- **Tertiary:** `#E9ECEF` (Gray)

#### Text Colors
- **Primary:** `#333333` (Dark gray)
- **Secondary:** `#555555` (Medium gray)
- **Muted:** `#777777` (Light gray)
- **On Dark:** `#FFFFFF` (White)

#### Gradients

```css
/* Brand Gradient */
linear-gradient(135deg, #00529C, #4DBFBB)

/* Success Gradient (Talk Button) */
linear-gradient(135deg, #10B981, #059669)

/* Danger Gradient (End Button) */
linear-gradient(135deg, #D32F2F, #b91c1c)

/* Sharing Gradient (Active Screen Share) */
linear-gradient(135deg, #f59e0b, #d97706)
```

### Typography

**Font Family:**
```css
-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif
```

**Font Scale:**

| Element | Size | Weight | Usage |
|---------|------|--------|-------|
| Call Duration | 24px | 700 | Monospace, large numbers |
| Welcome Header | 18px | 700 | Section headers |
| Brand Name | 18px | 800 | Top bar brand |
| Popup Title | 20px | 700 | Popup header |
| Body Text | 14-15px | 400-500 | Main content |
| Small Text | 12-13px | 500 | Supporting info |
| Micro Text | 10-11px | 600-800 | Labels, badges |

### Spacing System (8px Grid)

```css
--spacing-xs: 4px
--spacing-sm: 8px
--spacing-md: 16px
--spacing-lg: 24px
--spacing-xl: 32px
```

### Border Radius

```css
--radius-sm: 6px    /* Small elements */
--radius-md: 8px    /* Buttons, inputs */
--radius-lg: 12px   /* Cards, modals */
```

**Special Radii:**
- Popup button: 8px
- Logo: 12px
- Primary call button: 16px
- Welcome bubble: 20px
- Close button: 50% (circular)

### Shadows

```css
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05)
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1)
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1)
```

**Multi-Layer Shadows (Buttons):**
```css
/* Primary Button */
box-shadow:
  0 8px 25px rgba(16, 185, 129, 0.3),
  0 3px 10px rgba(16, 185, 129, 0.2),
  inset 0 1px 0 rgba(255, 255, 255, 0.2);
```

### Animations

| Animation | Duration | Effect | Used In |
|-----------|----------|--------|---------|
| **pulse** | 2s infinite | Opacity + scale | Status dots |
| **breathe** | 2s infinite | Scale + shadow pulse | Call duration dot |
| **fadeInUp** | 200ms | Slide up with fade | Messages |
| **logoShine** | 4s infinite | Rotating gradient | Logo background |
| **shimmer** | 3s infinite | Background shift | Call duration accent |
| **welcomeSlideIn** | 800ms | Slide + fade | Welcome message |
| **featureSlideIn** | 600ms | Staggered slide | Feature list items |
| **progressPulse** | 2s infinite | Scale Y variation | Progress bars |

### Button States

**Standard Pattern:**
```
Default → Hover → Active

Hover:
- Darker/brighter color
- translateY(-1px to -3px)
- Enhanced shadow

Active:
- translateY(0 to -1px)
- Reduced shadow
```

---

## User Flows

### Flow 1: Starting a Voice Conversation

```
1. User clicks extension icon (or Ctrl/Cmd+Shift+M)
   ↓
2. Popup appears with "Open Assistant" button
   ↓
3. User clicks "Open Assistant"
   ↓
4. Side panel opens, shows welcome message
   ↓
5. User clicks "Talk to SIA" button
   ↓
6. System requests microphone permission
   ↓
7A. Permission Granted:
    - Status: "Listening…" (amber pulse)
    - Call controls appear
    - Duration timer starts
    ↓
7B. Permission Denied:
    - Permission guidance shown
    - User clicks "Try Again"
    - Opens permission.html tab
    - User grants in browser dialog
    - Returns to listening state
   ↓
8. User speaks, voice transmitted
   ↓
9. Status: "SIA is speaking…" (green pulse)
   ↓
10. Audio response plays
   ↓
11. Returns to "Listening…" state
```

### Flow 2: Sharing Screen

```
1. During active call
   ↓
2. User clicks "Share Screen" button
   ↓
3. Browser shows native screen picker
   ↓
4. User selects screen/window/tab
   ↓
5. Button changes:
   - Orange gradient background
   - Label: "Stop Sharing"
   ↓
6. System message: "🖥️ Screen sharing is now active"
   ↓
7. Images captured and sent to backend
   ↓
8. User clicks "Stop Sharing" to end
```

### Flow 3: Muting During Call

```
1. Active call in progress
   ↓
2. User clicks mute button
   ↓
3. Button changes:
   - Red gradient background
   - Mic-off icon appears
   - "MUTED" badge shows below
   ↓
4. Status: "Muted"
   ↓
5. System message: "🔇 Microphone muted"
   ↓
6. User clicks again to unmute
   ↓
7. Returns to listening state
```

### Flow 4: Ending a Call

```
1. Active call in progress
   ↓
2. User clicks red close button (X)
   ↓
3. All managers stop:
   - Audio capture ends
   - WebSocket disconnects
   - Screen sharing stops (if active)
   ↓
4. System message: "✅ Session completed • Duration: MM:SS"
   ↓
5. UI resets:
   - Call controls hidden
   - "Talk to SIA" button reappears
   - Status: "Ready to help"
   ↓
6. Conversation history remains visible
```

---

## Component State Management

### State Variables

| State | Type | Purpose |
|-------|------|---------|
| `isCallActive` | boolean | Whether voice call is in progress |
| `isCallStarting` | boolean | Connection in progress (prevents rapid clicks) |
| `isMuted` | boolean | Microphone muted during call |
| `isScreenSharing` | boolean | Screen sharing active |
| `isPinned` | boolean | Panel pinned (persisted to storage) |
| `callStartTime` | timestamp/null | When call started (for duration) |

### State Transitions

#### Idle → Listening
- **Trigger:** User clicks "Talk to SIA"
- **Changes:** Show call controls, start timer, amber status dot

#### Listening → Speaking
- **Trigger:** AI sends audio response
- **Changes:** Green status dot, play audio

#### Speaking → Listening
- **Trigger:** Audio playback completes
- **Changes:** Amber status dot

#### Call Active → Muted
- **Trigger:** User clicks mute button
- **Changes:** Red mute button, stop audio transmission

#### Call Active → Screen Sharing
- **Trigger:** User clicks share screen
- **Changes:** Orange share button, capture images

#### Call Active → Idle
- **Trigger:** User clicks end call button
- **Changes:** Stop all managers, reset UI, show duration

---

## File Reference Guide

### HTML Files
| File | Purpose |
|------|---------|
| `extension/popup.html` | Popup window entry point |
| `extension/sidebar.html` | Main conversation interface |
| `extension/permission.html` | Interactive permission request |
| `extension/test-connection.html` | Connectivity diagnostics |
| `extension/offscreen.html` | Background permission handler |

### CSS Files
| File | Purpose |
|------|---------|
| `extension/css/popup.css` | Popup styling |
| `extension/css/sidebar.css` | Sidebar styling + design tokens |

### JavaScript Files
| File | Purpose |
|------|---------|
| `extension/js/popup.js` | Popup functionality |
| `extension/js/sidebar.js` | Main extension logic |
| `extension/js/branding.js` | Dynamic brand management |
| `extension/js/permission.js` | Permission request handler |
| `extension/js/permission-helper.js` | Permission orchestration |
| `extension/js/offscreen.js` | Background permission logic |
| `extension/js/audio-manager.js` | Audio capture/playback |
| `extension/js/websocket-client.js` | Backend communication |
| `extension/js/screen-share-manager.js` | Screen capture |
| `extension/js/config.js` | Environment configuration |

### Configuration
| File | Purpose |
|------|---------|
| `manifest.json` | Extension configuration and permissions |

---

## Design Principles

### 1. Simplicity First
Clean, uncluttered interfaces with clear visual hierarchy

### 2. Gradient Emphasis
Strategic use of gradients for primary actions and brand elements

### 3. Smooth Interactions
Micro-animations on all interactive elements for premium feel

### 4. Status Visibility
Clear visual feedback for all system states using color and animation

### 5. Progressive Disclosure
Show controls only when relevant (call controls appear during call)

### 6. Professional Polish
Attention to detail in spacing, shadows, and transitions

---

## Responsive Breakpoints

```css
@media (max-width: 400px) {
  /* Mobile adjustments */
  .extension-container { width: 100vw }
  .primary-btn { min-width: 180px; height: 56px }
  .duration-time { font-size: 20px }
}
```

---

## Accessibility Features

- **Color Contrast:** Meets WCAG AA standards
- **Focus States:** Clear focus indicators on all interactive elements
- **Keyboard Navigation:** All buttons keyboard accessible
- **Screen Reader Support:** Semantic HTML with proper labels
- **Touch Targets:** Minimum 44px for mobile interactions

---

## Key Implementation Notes

### Privacy Features
- **User messages not displayed:** Code explicitly skips rendering user messages in conversation area
- **Screen images not shown locally:** Images sent to backend but not displayed in UI

### Dynamic Branding
- Brand name, logo, and messages loaded from `manifest.json`
- Supports white-labeling through configuration

### Permission Strategies
1. Direct getUserMedia() in current context
2. Interactive tab with permission.html
3. Offscreen document fallback

### Audio Management
- 16kHz sample rate ideal for AI processing
- Echo cancellation and noise suppression enabled
- Auto gain control disabled


