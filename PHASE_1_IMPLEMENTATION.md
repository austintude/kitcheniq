# Phase 1 Implementation: Live Voice Capture & Streaming

**Date:** January 6, 2026  
**Version Update:** 1.0.6.15 → 1.0.7.0

## Summary
Phase 1 establishes the foundational infrastructure for live conversational capture with the KitchenIQ Coach. Users can now tap "Talk to KitchenIQ Coach" to initiate a live voice session with:
- Real-time camera feed
- Speech recognition (Web Speech API) with continuous listening
- Frame quality assessment (brightness, blur detection)
- Server-Sent Events (SSE) streaming for real-time intent parsing
- Structured conversation UI with role-based message styling
- Optional text-to-speech replies

## Changes Made

### 1. Version Bump
- [kitchen-iq/kitchen-iq.php](kitchen-iq/kitchen-iq.php)
  - Updated plugin header version: `1.0.6.15` → `1.0.7.0`
  - Updated `KIQ_VERSION` constant: `1.0.6.15` → `1.0.7.0`

### 2. Backend: Streaming Voice Endpoint
- [kitchen-iq/includes/class-kiq-rest.php](kitchen-iq/includes/class-kiq-rest.php)
  - **New Route:** `POST /kitcheniq/v1/stream/voice`
    - Accepts `transcript` (string) and `audio_chunk` (base64) parameters
    - Permission: Auth required, feature-gated (voice_assist tier)
    - Returns: Server-Sent Events (SSE) stream with `intent`, `suggestion`, `done` events
  
  - **New Handler:** `handle_stream_voice()`
    - Streams interim intent parsing results via SSE
    - Parses voice input for pantry actions (add/remove items)
    - Sends real-time responses: detected items, meal suggestions, completion signal
    - Uses feature tier gates to prevent unauthorized access
  
  - **Helper:** `parse_voice_intents()`
    - Simple heuristic intent detection from transcript
    - Patterns: "have X", "add X", "used X", "remove X"
    - Returns structured intents with actions and detected items
  
  - **Helper:** `send_sse_event()`
    - Formats and sends SSE-compliant event stream messages
    - Ensures proper headers and flushing

### 3. Frontend: Live Voice Capture UI
- [kitchen-iq/assets/js/kiq-dashboard.js](kitchen-iq/assets/js/kiq-dashboard.js)
  
  - **New Method:** `streamVoiceInput(transcript, frameDataUrl)`
    - Initiates SSE connection to `/stream/voice` endpoint
    - Parses incoming events and updates UI in real-time
    - Displays detected items and suggestions as they arrive
    - Handles stream errors gracefully
  
  - **Enhanced Method:** `captureLiveFrame()`
    - Added frame quality assessment before capture
    - Logs quality score and issues
    - Enables better understanding of capture conditions
  
  - **New Quality Assessment:** `assessFrameQuality(canvas)`
    - Analyzes brightness (too dark / too bright detection)
    - Estimates sharpness via edge detection (Sobel-like)
    - Returns score (0-1), issues array, and quality rating (good/warn/bad)
  
  - **New Quality Helper:** `estimateEdgeSharpness(canvas)`
    - Samples pixel gradients to detect blur
    - Used by quality assessment to warn of low-quality frames
  
  - **Enhanced Method:** `appendLiveMessage(role, text)`
    - Improved message UI with role-specific CSS classes
    - Displays sender name and message text separately
    - Auto-scrolls to latest message in thread
    - Supports: 'You', 'Coach', 'System' roles with distinct styling

### 4. Frontend: UI & Styling
- [kitchen-iq/assets/css/kiq-dashboard.css](kitchen-iq/assets/css/kiq-dashboard.css)
  
  - **Streaming State Classes:**
    - `.kiq-live-status-connecting`: Yellow status badge for connecting
    - `.kiq-live-status-listening`: Red pulsing badge for active listening
    - `.kiq-live-status-processing`: Blue pulsing badge for processing
    - `@keyframes pulse-subtle`: Subtle animation for state indicators
  
  - **Message Styling:**
    - `.kiq-live-message`: Base message container
    - `.kiq-live-message.user`: User messages (teal background)
    - `.kiq-live-message.coach`: Coach messages (white background)
    - `.kiq-live-message.system`: System messages (amber background)
    - `.kiq-live-message-sender`: Role label styling
  
  - **Quality Indicators:**
    - `.kiq-live-quality-badge`: Overlay badge for frame quality
    - `.kiq-live-quality-badge.good`: Green badge
    - `.kiq-live-quality-badge.warn`: Amber badge
    - `.kiq-live-quality-badge.bad`: Red badge
  
  - **UI Components:**
    - `.kiq-live-preview`: Styled camera preview area
    - `.kiq-live-thread`: Conversation thread container
    - `.kiq-live-controls`: Action button container

### 5. Template Structure (No Changes Required)
- [kitchen-iq/templates/dashboard.php](kitchen-iq/templates/dashboard.php)
  - Existing "KIQ Coach" tab structure already supports:
    - Video preview element (`#kiq-live-video`)
    - Status display (`#kiq-live-status`)
    - Control buttons (start, stop, capture, talk)
    - Conversation thread (`#kiq-live-thread`)
    - TTS toggle option

## Technical Details

### SSE Event Stream Format
The `/stream/voice` endpoint returns events in standard SSE format:
```
event: connected
data: {"message":"Voice stream connected."}

event: intent
data: {"transcript":"I have milk and eggs","items_detected":["milk","eggs"],"actions":[{"action":"add","item":"milk"},...]}

event: suggestion
data: {"message":"I can help you plan a meal! Would you like me to suggest recipes?"}

event: done
data: {"message":"Voice input processed."}
```

### Frame Quality Assessment
- **Brightness Score:** Analyzes pixel luminosity (target: 50–230)
- **Sharpness Score:** Samples edge gradients to detect blur
- **Overall Score:** 0–1 rating that guides user feedback
- **Issues Detected:** "too_dark", "too_bright", "blurry"

### Speech Recognition Integration
- Uses Web Speech API (Chrome, Edge, Safari, some Firefox builds)
- Runs in continuous mode to avoid auto-stop on pauses
- Interim results update status in real-time
- Final transcript sent to backend on speech end or manual stop

### Feature Gating
- Voice assist tied to user tier (Pro only for now; configurable via `KIQ_Features::allows()`)
- Graceful fallback to text prompt if Web Speech API unavailable
- Streaming endpoint checks permission before processing

## Next Steps (Phase 2+)

### Phase 2: Inventory Data Model & Freshness
- Add `added_at`, `best_by`, `last_confirmed_at`, `location`, `category` fields to inventory
- Build freshness gate: filter/flag expired items before meal suggestions
- Auto-detect `best_by` from vision or user input during add

### Phase 3: Store Mode
- "I'm at the store" quick-access button
- Gap analysis vs planned meals
- Smart buy-list with pantry substitutions to reduce waste
- Soon-to-expire items prioritized

### Phase 4: Feedback & Quick Corrections
- Post-capture confirmation card ("I heard/saw…")
- One-tap Keep/Remove/Fix with inline recategorize
- Voice shortcuts: "I used the milk", "Move beans to pantry"

### Phase 5: Reliability & Notifications
- Instrument streaming/upload errors; retry logic
- Service worker optimizations for new assets
- Expiry nudges, weekly use-it-up bundles
- Store-time reminders (geofence + time-of-day)

## Testing Recommendations

1. **Browser Compatibility:** Test on Chrome, Edge, Safari, Firefox
2. **Streaming:** Verify SSE events arrive in real-time
3. **Frame Quality:** Capture frames in varying light (low, normal, bright)
4. **Speech Recognition:** Test continuous mode with pauses
5. **Feature Gates:** Confirm voice_assist tier check works
6. **Error Handling:** Network failures, mic blocked, camera denied
7. **Mobile:** Gesture responsiveness, camera toggle (front/rear)

## Files Modified
- `kitchen-iq/kitchen-iq.php` (version)
- `kitchen-iq/includes/class-kiq-rest.php` (new route + handlers)
- `kitchen-iq/assets/js/kiq-dashboard.js` (streaming UI + quality checks)
- `kitchen-iq/assets/css/kiq-dashboard.css` (streaming UI styles)

## Notes
- No database schema changes required for Phase 1
- No new options/settings added yet
- Service worker cache name auto-updated via `KIQ_VERSION`
- All streaming logic in-memory; no persistent storage of interim results
