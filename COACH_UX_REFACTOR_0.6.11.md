# KIQ Coach UX Refactor - Version 0.6.11

## Summary
Unified the Coach conversational flow from clunky multi-button experience to seamless voice+video interaction. Users now open the rear-facing camera and immediately start talking—the Coach listens, watches, and responds in real-time.

## Key Changes

### 1. **Rear Camera Default + Switcher** ✅
- **Before**: `getUserMedia({ video: true, audio: false })` always defaulted to selfie camera
- **After**: Constraints now request `facingMode: 'environment'` (rear camera) by default
- **Fallback**: If device doesn't support facingMode, accepts any available camera
- **Toggle**: New "Switch camera" button (📷) lets users toggle between rear/front without restarting the stream

### 2. **Unified Session Model** ✅
- **Before**: Separate "Start Camera", "Stop Camera", "Send photo", "Talk" buttons created friction
- **After**: Single "Start Coach" button initiates both video + audio stream
  - Camera feed starts on rear
  - Mic is ready for immediate speech recognition
  - "Stop Coach" button (same button, state-aware) gracefully closes the stream
  - "Talk to KitchenIQ Coach" button starts/stops speech recognition

### 3. **Auto-Frame Capture During Speech** ✅
- **Before**: Manual "Send photo to Coach" button—users had to deliberately capture
- **After**: 
  - Auto-captures video frame every **8 seconds** while speech recognition is active
  - Latest frame is stored in `liveLatestFrame` state
  - Auto-attached to transcript when user stops speaking
  - Provides continuous visual context without explicit user action

### 4. **Optional TTS Voice Playback** ✅
- **New Feature**: "Play Coach replies aloud" checkbox (disabled by default)
- **Implementation**: Browser-native Web Speech API `speechSynthesis`
- **No external infrastructure**: Pure client-side, no voice API calls
- **Behavior**: 
  - When enabled, Coach's text response is spoken aloud using browser's default voice
  - Rate/pitch set to natural (1.0)
  - Graceful fallback if TTS unsupported (silently ignored)

### 5. **Improved Button States & UX** ✅
- **Start Coach**: Changes to "Stop Coach" with red danger styling when session active
- **Talk Button**: 
  - Pulses red with "listening" animation when speech is active
  - Changes text to "Stop listening" during capture
  - Reverts to "Talk to KitchenIQ Coach" when idle
- **Camera Toggle**: Clear icon (📷) + "Switch camera" label, no restart required
- **Status Line**: Real-time feedback ("Listening...", "Processing Coach response...", "Ready to talk")

### 6. **Enhanced Template** ✅
- Simplified description: "Open your camera and start speaking. The Coach will listen, watch, and respond in real-time."
- TTS toggle checkbox with clear label
- Reorganized buttons for clearer user intent:
  1. Primary: "Talk to KitchenIQ Coach" (starts/stops mic)
  2. Secondary: "Switch camera" (toggle rear/front)
  3. Secondary: "Stop" (gracefully close stream)
  4. Status indicator (reads status text)
  5. Checkbox: "Play Coach replies aloud"

## State Machine

```
[Session Idle]
    ↓ Click "Start Coach"
[Session Active] ← Camera on, audio enabled, ready for speech
    ↓ Click "Talk to KitchenIQ Coach"
[Listening] ← Speech recognition active, auto-capturing frames every 8s
    ↓ User stops speaking or clicks "Stop listening"
[Sending] ← Transcript + latest frame sent to API
    ↓ Coach responds
[Idle] ← Coach message displayed, TTS played if enabled
    ↓ Ready for next turn
[Listening] ← User can speak again
    ↓ Click "Stop Coach"
[Session Idle]
```

## Code Changes

### JavaScript (kiq-dashboard.js)
- **New Methods**:
  - `toggleLiveSession()`: Smart toggle for start/stop (replaces separate start/stop)
  - `startLiveSession()`: Request camera with rear facing, enable audio, set up UI
  - `stopLiveSession()`: Tear down stream, clear intervals, reset UI
  - `toggleCameraFacing()`: Switch between rear/front without restart
  - `toggleLiveAudio()`: Start/stop speech recognition (replaces handleLivePushToTalk)
  - `captureLiveFrame()`: Canvas capture, returns JPEG data URL (silent, no auto-send)
  
- **Updated Methods**:
  - `sendLiveAssist(transcript, frameDataUrl)`: Now attaches latest frame automatically; handles TTS
  
- **New State Fields**:
  - `liveSessionActive`: Boolean, session is running
  - `liveAutoFrameInterval`: Interval ID for periodic frame capture
  - `liveUsingRearCamera`: Boolean, tracks facing mode preference
  - `liveTtsEnabled`: Boolean, user toggle for voice playback
  - `liveLatestFrame`: Stores most recent video frame for attachment

### Template (templates/dashboard.php)
- Restructured Coach tab section with clearer labels
- Reorganized button layout for unified flow
- Added TTS toggle checkbox
- Updated copy to emphasize real-time conversation

### CSS (kiq-dashboard.css)
- `.btn-danger`: Red styling for "Stop Coach" state
- `#kiq-live-ptt.listening`: Pulsing red animation during speech
- `@keyframes pulse-listening`: Glow effect for active listening state
- `.kiq-live-controls`: Flex layout with wrapping for responsive button arrangement

### Version
- `kitchen-iq.php` Header: `Version: 0.6.11`
- `KIQ_VERSION` constant: `0.6.11`

## What Didn't Change (Backend Ready)

✅ **REST Endpoint** (`/live-assist`) — Already tier-gated (pro), authenticated, working
✅ **KIQ_AI Integration** — Already calls `live_assist(user_id, transcript, frame_base64)` with multimodal support
✅ **Thread Persistence** — Already stores conversation in usermeta with 30-entry cap
✅ **No API Changes** — Same request/response format; frame attachment is client-side logic

## Testing Checklist

- [ ] Load Coach tab on desktop (Safari, Chrome)
- [ ] Load Coach tab on mobile (iOS Safari, Android Chrome)
- [ ] Click "Start Coach" → rear camera opens, mic enabled
- [ ] Click "Switch camera" → toggles to front camera without stopping stream
- [ ] Click "Switch camera" again → back to rear camera
- [ ] Click "Talk" → speech recognition starts, "Listening..." status
- [ ] Speak phrase → interim results show in status line
- [ ] Stop speaking → final transcript sent + latest frame auto-attached
- [ ] Coach replies → appears in thread
- [ ] Check TTS toggle (off) → no audio playback
- [ ] Check TTS toggle (on) → Coach reply spoken aloud
- [ ] Uncheck TTS → no more audio playback
- [ ] Click "Stop" → stream stops, buttons reset
- [ ] On Pro tier only: Coach tab visible and functional
- [ ] On non-Pro tier: Coach tab hidden or displays upgrade message

## Known Limitations

1. **FacingMode Support**: Some older Android devices don't support `facingMode` constraint; fallback requests any camera
2. **Audio Permission**: Requires explicit mic permission; if denied, falls back to text prompt
3. **TTS Voice**: Uses browser default voice (varies by OS/browser); no custom voice selection
4. **Frame Quality**: Auto-captured frames at 0.6 JPEG quality; adjustable if needed
5. **Auto-Frame Interval**: Fixed at 8 seconds; could be configurable per user preference

## Future Enhancements

- Config option for auto-frame capture interval
- User preference for default camera (remember last used)
- Quick-reply chips ("Another angle", "I'm done") to speed up multi-turn conversations
- Portrait orientation lock on mobile
- Haptic feedback on iOS when listening
- Analytics tracking for Coach usage patterns
