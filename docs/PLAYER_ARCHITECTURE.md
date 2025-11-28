# Player Architecture Documentation

## Overview

The IPTV Player system is a modular, enterprise-grade video streaming solution designed for maximum compatibility across:

- **Smart TVs**: Samsung Tizen, LG webOS
- **Streaming Devices**: Android TV, Fire TV, Apple TV
- **Browsers**: Chrome, Firefox, Safari, Edge
- **Mobile**: iOS Safari, Android Chrome
- **WebViews**: React Native, Capacitor, Cordova

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ VideoPlayer │  │ TVGridLayout│  │     PlayerOverlay       │ │
│  │  Component  │  │  (Focus Nav)│  │ (Controls, Info, Errors)│ │
│  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘ │
└─────────┼────────────────┼─────────────────────┼───────────────┘
          │                │                     │
          ▼                ▼                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                          HOOKS LAYER                            │
│  ┌─────────────────┐  ┌────────────────┐  ┌──────────────────┐ │
│  │usePlayerController│ │ useRemoteInput │  │ useIPTVPlaylist  │ │
│  │  (State, Ctrl)   │  │  (Key Events)  │  │ (M3U Management) │ │
│  └────────┬─────────┘  └───────┬────────┘  └────────┬─────────┘ │
└───────────┼────────────────────┼────────────────────┼───────────┘
            │                    │                    │
            ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                          CORE LAYER                             │
│  ┌───────────────┐ ┌──────────────┐ ┌─────────────────────────┐│
│  │PlayerStateMachine│ TechAdapter │ │  DeviceDetector         ││
│  │ (State Flow)  │ │(HLS.js/Native)│ │  (Platform Detection)   ││
│  └───────┬───────┘ └──────┬───────┘ └───────────┬─────────────┘│
│          │                │                     │              │
│  ┌───────┴───────┐ ┌──────┴───────┐ ┌──────────┴────────────┐ │
│  │ QoSMonitor    │ │ RemoteKeyMap │ │       Logger          │ │
│  │ (Metrics)     │ │ (Key Mapping)│ │  (Structured Logs)    │ │
│  └───────────────┘ └──────────────┘ └───────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                       SERVICES LAYER                            │
│  ┌─────────────────┐  ┌─────────────────────────────────────┐  │
│  │  StreamService  │  │          TelemetryService           │  │
│  │ (URL Building,  │  │  (Error Tracking, Session Metrics)  │  │
│  │  M3U Fetching)  │  │                                     │  │
│  └────────┬────────┘  └──────────────────────────────────────┘  │
└───────────┼─────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      EDGE FUNCTIONS                             │
│  ┌─────────────────┐  ┌─────────────────────────────────────┐  │
│  │  stream-proxy   │  │         fetch-m3u-url               │  │
│  │ (HLS Rewriting, │  │  (M3U Parsing, Channel Extraction)  │  │
│  │  CORS Bypass)   │  │                                     │  │
│  └─────────────────┘  └─────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Player State Machine

**File**: `src/modules/player/core/PlayerStateMachine.ts`

Manages player lifecycle with states:
- `idle` → Initial state, no media loaded
- `loading` → Loading manifest/stream
- `buffering` → Waiting for data
- `playing` → Active playback
- `paused` → User paused
- `stalled` → Network issue, stream frozen
- `retrying` → Attempting reconnection
- `error` → Fatal error state

**State Transitions**:
```
IDLE → LOAD → LOADING
LOADING → MANIFEST_LOADED → BUFFERING
BUFFERING → CAN_PLAY → PLAYING
PLAYING → PAUSE → PAUSED
PLAYING → STALLED → STALLED
STALLED → RETRY → RETRYING
RETRYING → RETRY_SUCCESS → LOADING
RETRYING → RETRY_EXHAUSTED → ERROR
ANY → RESET → IDLE
```

### 2. Tech Adapters

**File**: `src/modules/player/core/TechAdapter.ts`

Abstracts playback engine selection:

| Adapter | Use Case | Fallback |
|---------|----------|----------|
| `HlsJsAdapter` | MSE-compatible browsers | NativeAdapter |
| `NativeAdapter` | Safari, iOS, legacy TVs | - |

**Selection Logic**:
1. If HLS stream + Native HLS supported → NativeAdapter (Safari/iOS)
2. If HLS stream + HLS.js supported → HlsJsAdapter
3. Default → NativeAdapter

### 3. Device Detector

**File**: `src/modules/player/core/DeviceDetector.ts`

Detects platform and capabilities:

| Platform | Detection Method |
|----------|-----------------|
| Tizen | `navigator.userAgent.includes('Tizen')` or `window.tizen` |
| webOS | `navigator.userAgent.includes('webOS')` or `window.webOS` |
| Fire TV | `userAgent.includes('AFTT\|AFTS\|AFTM')` |
| Android TV | `userAgent.includes('Android TV')` |
| Browser | Default fallback |

### 4. Remote Key Map

**File**: `src/modules/player/core/RemoteKeyMap.ts`

Unified remote control mapping:

| Action | Keyboard | Tizen | webOS | Android TV |
|--------|----------|-------|-------|------------|
| up | ArrowUp | 38 | 38 | 19/38 |
| down | ArrowDown | 40 | 40 | 20/40 |
| ok | Enter | 13 | 13 | 23/13 |
| back | Escape | 10009 | 461 | 8/27 |
| playpause | Space | 10252 | - | 85 |

### 5. QoS Monitor

**File**: `src/modules/player/core/QoSMonitor.ts`

Tracks quality metrics:

| Metric | Target | Degraded | Critical |
|--------|--------|----------|----------|
| Startup Time | < 2.5s | 2.5-5s | > 5s |
| Rebuffer Count | 0-1 | 2-3 | > 3 |
| Frame Drop Rate | < 1% | 1-5% | > 5% |
| Buffer Length | > 10s | 5-10s | < 5s |

**Health Score Calculation**:
```
score = 100
score -= (startupTime > 5s) ? 20 : (startupTime > 3s) ? 10 : 0
score -= rebufferCount * 10
score -= floor(rebufferDuration / 5000) * 5
score -= (frameDropRate > 0.05) ? 20 : (frameDropRate > 0.01) ? 10 : 0
score -= errorCount * 5
score -= fatalErrorCount * 20
```

## Stream Proxy

**File**: `supabase/functions/stream-proxy/index.ts`

Enterprise features:
- **CORS Bypass**: Adds proper CORS headers
- **HLS Rewriting**: Rewrites manifest URLs to proxy
- **HTTPS→HTTP Fallback**: Auto-fallback on TLS errors
- **Retry Logic**: 3 attempts with exponential backoff
- **User-Agent Masking**: Simulates VLC player

### Request Flow

```
Client → Proxy?url=stream.m3u8
           │
           ▼
      ┌─────────────────┐
      │ Parse URL       │
      │ Detect Content  │
      └────────┬────────┘
               │
     ┌─────────┴─────────┐
     │                   │
     ▼                   ▼
  HLS Manifest       Video Segment
     │                   │
     ▼                   ▼
  Rewrite URLs      Pass-through
     │                   │
     └─────────┬─────────┘
               │
               ▼
        Return Response
```

## M3U Pipeline

### Loading Flow

```
User selects M3U
        │
        ▼
┌─────────────────────┐
│ fetch-m3u-url       │
│ Edge Function       │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Parse M3U content   │
│ Extract channels    │
│ Group by category   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ StreamService       │
│ - Cache result      │
│ - Group channels    │
└──────────┬──────────┘
           │
           ▼
    Display in UI
```

## TV Navigation

### Focus Management

The `FocusManager` handles spatial navigation:

1. **Registration**: Elements register with unique IDs
2. **Focus Groups**: Logical groupings (grid, sidebar, controls)
3. **Spatial Logic**: Finds nearest focusable element in direction
4. **Visual Feedback**: `.tv-focused` class for styling

### Focus Flow Example

```
┌─────────────────────────────────────────┐
│ Category Sidebar    │   Content Grid    │
│                     │                   │
│  [Sports]  ←─────── │ ─────→ [Ch 1]    │
│  [Movies]           │        [Ch 2]    │
│  [Series]           │        [Ch 3]    │
│                     │                   │
└─────────────────────────────────────────┘
        │                     │
        │    Arrow Keys       │
        │   ↑ ↓ ← → Enter    │
        │                     │
        ▼                     ▼
    Focus moves         Channel plays
```

## Error Handling

### Recovery Strategy

| Error Type | Action | Retries |
|------------|--------|---------|
| Network Error | Restart load | 3x |
| Media Error | Recover/reload | 2x |
| Fatal Error | Show error UI | 0 |
| Timeout | Retry with delay | 3x |

### Error Display

```tsx
// Error overlay with retry
<div className="error-overlay">
  <p>Stream unavailable</p>
  <button onClick={retry}>Retry</button>
</div>
```

## Performance Optimizations

### Buffer Configuration

| Device Type | Max Buffer | Back Buffer |
|-------------|------------|-------------|
| TV (Low-end) | 30s | 30s |
| Browser | 60s | 60s |
| Mobile | 45s | 30s |

### Lazy Loading

- Channels loaded in batches of 500
- Progressive loading with progress callback
- Categories virtualized for large lists

## File Structure

```
src/modules/player/
├── core/
│   ├── index.ts              # Core exports
│   ├── PlayerStateMachine.ts # State management
│   ├── TechAdapter.ts        # Playback engines
│   ├── TelemetryService.ts   # Error/metrics tracking
│   ├── DeviceDetector.ts     # Platform detection
│   ├── QoSMonitor.ts         # Quality metrics
│   ├── RemoteKeyMap.ts       # Remote control mapping
│   └── Logger.ts             # Structured logging
├── components/
│   ├── PlayerOverlay.tsx     # Player UI overlay
│   ├── TVGridLayout.tsx      # TV-optimized grid
│   └── TVFocusableCard.tsx   # Focusable card
├── hooks/
│   ├── useFocusManager.ts    # Focus management
│   ├── usePlayerController.ts# Player controls
│   ├── useRemoteInput.ts     # Remote key handling
│   └── useIPTVPlaylist.ts    # Playlist management
├── services/
│   └── StreamService.ts      # Stream URL handling
├── FocusManager.ts           # Focus singleton
└── index.ts                  # Module exports
```

## Testing Checklist

### Playback Tests

- [ ] Stream starts within 3 seconds
- [ ] Channel switching < 2 seconds
- [ ] Rebuffering < 1 event per 20 minutes
- [ ] Seek works on VOD content
- [ ] Volume controls functional

### UI Tests

- [ ] Focus never disappears
- [ ] Navigation responds to all directions
- [ ] Back button exits player
- [ ] Overlay auto-hides after 3.5s
- [ ] Error messages display correctly

### Platform Tests

- [ ] Chrome desktop
- [ ] Safari (native HLS)
- [ ] Tizen emulator
- [ ] webOS emulator
- [ ] Android TV
- [ ] Fire TV
- [ ] Mobile WebView

### Proxy Tests

- [ ] HTTPS streams work
- [ ] HTTP fallback works
- [ ] Manifest rewriting correct
- [ ] Range requests supported
- [ ] CORS headers present
