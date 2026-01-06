# Phase 1 Architecture: Live Voice Streaming

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER (Browser/Mobile)                         │
│                                                                   │
│  ┌──────────────────┐         ┌──────────────────┐              │
│  │  Web Speech API  │         │  getUserMedia    │              │
│  │  (Microphone)    │         │  (Camera)        │              │
│  └────────┬─────────┘         └────────┬─────────┘              │
│           │ transcript                  │ frame (JPEG)           │
│           └────────────┬────────────────┘                        │
│                        │                                          │
│           ┌────────────▼──────────────┐                          │
│           │  KitchenIQDashboard       │                          │
│           │  (kiq-dashboard.js)       │                          │
│           │                           │                          │
│           │ ┌─────────────────────┐  │                          │
│           │ │ Live Voice Methods  │  │                          │
│           │ │ • toggleLiveSession │  │                          │
│           │ │ • toggleLiveAudio   │  │                          │
│           │ │ • captureLiveFrame  │  │                          │
│           │ │ • streamVoiceInput  │  │                          │
│           │ └─────────────────────┘  │                          │
│           │                           │                          │
│           │ ┌─────────────────────┐  │                          │
│           │ │ Quality Assessment  │  │                          │
│           │ │ • assessFrameQuality│  │                          │
│           │ │ • estimateEdgeSharp │  │                          │
│           │ └─────────────────────┘  │                          │
│           │                           │                          │
│           │ ┌─────────────────────┐  │                          │
│           │ │ UI Updates          │  │                          │
│           │ │ • appendLiveMessage │  │                          │
│           │ │ • setLiveStatus     │  │                          │
│           │ └─────────────────────┘  │                          │
│           └─────────────┬─────────────┘                          │
│                         │                                         │
│  ┌──────────────────────▼──────────────────────┐                │
│  │ HTTP POST + Streaming                        │                │
│  │ /kitcheniq/v1/stream/voice                   │                │
│  └──────────────────────┬──────────────────────┘                │
│         (transcript)    │    (audio_chunk/frame)                │
│                         │                                        │
│         ┌───────────────▼────────────────┐                      │
│         │   SSE (Server-Sent Events)     │                      │
│         │   event: intent                │                      │
│         │   event: suggestion            │                      │
│         │   event: done                  │                      │
│         └───────────────┬────────────────┘                      │
└─────────────────────────┼────────────────────────────────────────┘
                          │ Real-time Stream
                          │
          ┌───────────────▼────────────────┐
          │  WordPress Backend (PHP)       │
          │                                │
          │ ┌─────────────────────────┐   │
          │ │ KIQ_REST                │   │
          │ │ handle_stream_voice()   │   │
          │ ├─────────────────────────┤   │
          │ │ 1. Auth check           │   │
          │ │ 2. Feature gate check   │   │
          │ │ 3. Parse transcript     │   │
          │ │ 4. Detect intents       │   │
          │ │ 5. Stream SSE events    │   │
          │ └──────────┬──────────────┘   │
          │            │                  │
          │ ┌──────────▼──────────────┐   │
          │ │ Intent Parser           │   │
          │ │ parse_voice_intents()   │   │
          │ │                         │   │
          │ │ Regex patterns:         │   │
          │ │ • "have X"              │   │
          │ │ • "add X"               │   │
          │ │ • "used X"              │   │
          │ │ • "remove X"            │   │
          │ └─────────────────────────┘   │
          │                                │
          │ ┌─────────────────────────┐   │
          │ │ KIQ_Features            │   │
          │ │ allows(user, 'voice_')  │   │
          │ └─────────────────────────┘   │
          │                                │
          │ ┌─────────────────────────┐   │
          │ │ send_sse_event()        │   │
          │ │ Formats SSE responses   │   │
          │ └─────────────────────────┘   │
          └────────────────────────────────┘
```

## Data Flow: Voice Input to Intent Detection

```
User speaks "I have milk and eggs"
           │
           ▼
  ┌─────────────────────────┐
  │ Web Speech API captures │
  │ transcript: "I have... "│
  └──────────┬──────────────┘
             │
             ▼ (user clicks "Talk to Coach")
  ┌─────────────────────────────────────────┐
  │ toggleLiveAudio() starts recognition    │
  │ • Continuous mode: true                 │
  │ • Interim results shown live            │
  │ • Auto-frame capture every 8 seconds    │
  └──────────┬──────────────────────────────┘
             │
             ▼ (user clicks "Stop listening")
  ┌─────────────────────────────────────────┐
  │ Recognition.onend() fires               │
  │ • finalTranscript assembled             │
  │ • captureLiveFrame() with quality check │
  │ • Call streamVoiceInput(transcript)     │
  └──────────┬──────────────────────────────┘
             │
             ▼ HTTP POST /stream/voice
  ┌─────────────────────────────────────────┐
  │ Backend: handle_stream_voice()          │
  │ • Authenticate user                     │
  │ • Check voice_assist feature tier       │
  │ • Call parse_voice_intents(transcript)  │
  └──────────┬──────────────────────────────┘
             │
             ▼
  ┌─────────────────────────────────────────┐
  │ Intent Parser: parse_voice_intents()    │
  │ Regex match patterns in transcript      │
  │ • /have|add.../i -> item detection      │
  │ • /used|remove.../i -> removal          │
  │ Returns: { items: [], actions: [] }     │
  └──────────┬──────────────────────────────┘
             │
             ▼ Stream SSE events
  ┌─────────────────────────────────────────┐
  │ send_sse_event('intent', {items: [...]})│
  │ • JSON-encoded data                     │
  │ • One per line                          │
  │ • Browser parses real-time              │
  └──────────┬──────────────────────────────┘
             │
             ▼ Browser processes event
  ┌─────────────────────────────────────────┐
  │ streamVoiceInput() receives SSE         │
  │ • Parses JSON event data                │
  │ • Updates status: "Detected: milk..."   │
  │ • appendLiveMessage('Coach', ...)       │
  └──────────┬──────────────────────────────┘
             │
             ▼
  ┌─────────────────────────────────────────┐
  │ UI renders message in conversation      │
  │ with role-based styling (coach voice)   │
  └─────────────────────────────────────────┘
```

## Frame Quality Assessment Pipeline

```
┌────────────────────────────┐
│ captureLiveFrame()         │
│ • Canvas from video stream │
│ • Draw to JPEG (0.6 qual)  │
└──────────────┬─────────────┘
               │
               ▼
    ┌──────────────────────┐
    │ assessFrameQuality() │
    └──────────┬───────────┘
               │
               ├─────────────────────────┐
               │                         │
               ▼                         ▼
    ┌──────────────────┐    ┌────────────────────┐
    │ Brightness Check │    │ Sharpness Check    │
    │                  │    │                    │
    │ • Sample pixels  │    │ • Edge detection   │
    │ • Avg luminosity │    │ • Sobel-like       │
    │ • Min: 50 ok     │    │ • Blur threshold   │
    │ • Max: 230 ok    │    │ • < 0.3 = blurry   │
    │ • < 50 too dark  │    └─────────┬──────────┘
    │ • > 230 too bright      │
    └──────────┬──────────────┘
               │
               ▼
    ┌──────────────────────────────┐
    │ Calculate Score (0-1)        │
    │ Base = 1.0                   │
    │ - 0.3 if too dark           │
    │ - 0.2 if too bright         │
    │ - 0.2 if blurry             │
    │ Final: clamp(0, 1)          │
    └──────────┬───────────────────┘
               │
               ▼
    ┌──────────────────────────────┐
    │ Quality Rating               │
    │ >= 0.7: good    (green)      │
    │ >= 0.4: warn    (amber)      │
    │  < 0.4: bad     (red)        │
    └──────────────────────────────┘
```

## SSE Event Lifecycle

```
Client establishes HTTP connection (POST)
           │
           ▼
┌──────────────────────────────────┐
│ Server begins streaming response │
│ Header: Content-Type: text/event │
│ Header: Cache-Control: no-cache  │
│ Header: Connection: keep-alive   │
└─────────────┬────────────────────┘
              │
              ▼
┌──────────────────────────────────┐
│ send_sse_event('connected', {..})│
│ event: connected                 │
│ data: {"message":"..."}          │
│ [blank line]                     │
└─────────────┬────────────────────┘
              │
              ▼
┌──────────────────────────────────┐
│ Process intent detection         │
│ parse_voice_intents(transcript)  │
└─────────────┬────────────────────┘
              │
              ▼
┌──────────────────────────────────┐
│ send_sse_event('intent', {..})   │
│ event: intent                    │
│ data: {"items_detected":[...]}   │
│ [blank line]                     │
└─────────────┬────────────────────┘
              │
              ▼
┌──────────────────────────────────┐
│ Check for meal-related keywords  │
│ if regex matches (meal|recipe)   │
└─────────────┬────────────────────┘
              │
              ▼
┌──────────────────────────────────┐
│ send_sse_event('suggestion',{..})│
│ event: suggestion                │
│ data: {"message":"...meal..."}   │
│ [blank line]                     │
└─────────────┬────────────────────┘
              │
              ▼
┌──────────────────────────────────┐
│ send_sse_event('done', {..})     │
│ event: done                      │
│ data: {"message":"..."}          │
│ [blank line]                     │
│                                  │
│ exit; (server closes stream)     │
└──────────────────────────────────┘
              │
              ▼
   Browser stream reader closes
   All event listeners triggered
   UI finalized with responses
```

## Feature Gate Integration

```
User requests /stream/voice
           │
           ▼
┌─────────────────────────────┐
│ KIQ_REST::handle_stream()   │
│ Get user_id                 │
└──────────┬──────────────────┘
           │
           ▼
┌──────────────────────────────────────┐
│ KIQ_Features::allows()               │
│ Check: user_id, 'voice_assist'       │
│                                      │
│ Default: Pro only                    │
│ Configurable: kiq_tier_limits option │
│                                      │
│ Returns: true | false                │
└──────────┬───────────────────────────┘
           │
      ┌────┴────┐
      │          │
  No  ▼          ▼ Yes
┌──────────┐ ┌─────────────┐
│ 403 JSON │ │ Proceed     │
│ not_allow│ │             │
│ error    │ │ Stream SSE  │
└──────────┘ └─────────────┘
```

## Message Role-Based Styling

```
Role: 'You' / 'User'
  ↓
  .kiq-live-message.user
    ├ background: var(--kiq-accent-soft)    // teal
    ├ border-color: var(--kiq-accent)
    └ margin-left: 30px                      // align right

Role: 'Coach'
  ↓
  .kiq-live-message.coach
    ├ background: var(--kiq-surface)        // white
    ├ margin-right: 30px                     // align left
    └ border: 1px solid var(--kiq-border)

Role: 'System'
  ↓
  .kiq-live-message.system
    ├ background: var(--kiq-warn-soft)      // amber
    ├ border-color: var(--kiq-warn)
    └ text-align: center                     // centered

All messages
  ├ .kiq-live-message-sender                 // role label
  │  ├ font-weight: 600
  │  ├ font-size: 11px
  │  ├ text-transform: uppercase
  │  └ letter-spacing: 0.4px
  │
  └ Message text
     └ font-size: 13px
        line-height: 1.6
```

## Error Handling Paths

```
┌─────────────────────────────────┐
│ Possible Error Points           │
└──────────────┬──────────────────┘
               │
       ┌───────┼───────┬──────────┬──────────┐
       │       │       │          │          │
       ▼       ▼       ▼          ▼          ▼
    No Mic  No Cam  Network   Not Auth   Feature
    Perm    Perm    Error               Gate
       │       │       │          │          │
       └───────┴───────┴──────────┴──────────┘
               │
    ┌──────────▼───────────┐
    │ Error Messages       │
    │ Sent to UI via:      │
    │ • setLiveStatus()    │
    │ • appendLiveMessage()│
    │ • 403 JSON response  │
    └─────────────────────┘
               │
               ▼
    ┌──────────────────────┐
    │ User sees helpful    │
    │ error & can retry    │
    └──────────────────────┘
```

## Browser Compatibility

| Feature | Chrome | Edge | Safari | Firefox |
|---------|--------|------|--------|---------|
| getUserMedia | ✅ | ✅ | ✅ (iOS 11+) | ✅ |
| Web Speech API | ✅ | ✅ | ✅ (iOS 15+) | ⚠️ (limited) |
| Fetch + ReadableStream | ✅ | ✅ | ✅ | ✅ |
| Canvas getImageData | ✅ | ✅ | ✅ | ✅ |
| SSE EventSource | ✅ | ✅ | ✅ | ✅ |

**Notes:**
- Fallback to text prompt if Web Speech unavailable
- Frame capture works on all modern browsers
- SSE compatible across all major browsers
