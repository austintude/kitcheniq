# Phase 1 Testing Guide: Live Voice Streaming

## Quick Start Testing

### Prerequisites
- WordPress site with KitchenIQ plugin (v1.0.7.0+) installed and activated
- User logged in with Pro tier (or manually set `voice_assist` feature gate)
- Browser with Web Speech API support (Chrome, Edge, Safari, Firefox)
- Microphone and camera enabled/permitted

### Test Scenario 1: Basic Live Session

**Steps:**
1. Navigate to KitchenIQ dashboard
2. Click "KIQ Coach" tab
3. Click "Start Coach" button
4. Grant camera permission when prompted
5. Verify video stream appears in preview
6. Click "Talk to KitchenIQ Coach" button
7. Speak: "I have milk and eggs"
8. Click "Stop listening" when done
9. Observe status and transcript live-updating

**Expected Results:**
- ✅ Camera stream starts and displays
- ✅ "Listening..." status appears when mic activates
- ✅ Interim transcript updates as you speak
- ✅ "I have milk" detected as intent to add items
- ✅ Coach message appears with detected items
- ✅ Conversation thread shows both user and coach messages

---

## Unit Test Cases

### 1. REST Endpoint: POST /kitcheniq/v1/stream/voice

#### Test 1.1: Missing Auth
```
POST /kitcheniq/v1/stream/voice
Headers: (no X-WP-Nonce)
Body: {"transcript":"hello"}

Expected: 401 Unauthorized
```

#### Test 1.2: Valid Request
```
POST /kitcheniq/v1/stream/voice
Headers: 
  X-WP-Nonce: [valid nonce]
  Content-Type: application/json
Body: 
  {
    "transcript": "I have milk and eggs",
    "audio_chunk": ""
  }

Expected: 200 OK, Content-Type: text/event-stream
Streams: event:connected, event:intent, event:suggestion, event:done
```

#### Test 1.3: Feature Gate (Non-Pro User)
```
POST /kitcheniq/v1/stream/voice
User: Free tier
Headers: [valid auth]
Body: {"transcript":"test"}

Expected: 403 Forbidden
Response: {"error":"not_allowed","message":"Voice assist is a Pro feature."}
```

#### Test 1.4: Empty Input
```
POST /kitcheniq/v1/stream/voice
Headers: [valid auth]
Body: {"transcript":"","audio_chunk":""}

Expected: 400 Bad Request
Response: {"error":"missing_input","message":"Provide either transcript or audio_chunk."}
```

---

### 2. Intent Parser: parse_voice_intents()

#### Test 2.1: Add Item Detection
```php
Input: "I have milk and eggs"
Expected Output: 
{
  "items": ["milk", "eggs"],
  "actions": [
    {"action": "add", "item": "milk"},
    {"action": "add", "item": "eggs"}
  ]
}
```

#### Test 2.2: Remove Item Detection
```php
Input: "I used the flour yesterday"
Expected Output:
{
  "items": ["flour"],
  "actions": [{"action": "remove", "item": "flour"}]
}
```

#### Test 2.3: Mixed Actions
```php
Input: "I bought chicken but finished the bread"
Expected Output:
{
  "items": ["chicken", "bread"],
  "actions": [
    {"action": "add", "item": "chicken"},
    {"action": "remove", "item": "bread"}
  ]
}
```

#### Test 2.4: No Items Detected
```php
Input: "Tell me about cooking"
Expected Output:
{
  "items": [],
  "actions": []
}
```

---

### 3. Frame Quality Assessment

#### Test 3.1: Well-Lit Frame
```
Canvas: Normal indoor lighting
Expected: 
{
  "score": >= 0.7,
  "quality": "good",
  "issues": []
}
```

#### Test 3.2: Too Dark Frame
```
Canvas: Very low brightness (avg < 50)
Expected:
{
  "score": < 0.7,
  "quality": "warn" or "bad",
  "issues": ["too_dark"]
}
```

#### Test 3.3: Overexposed Frame
```
Canvas: Very high brightness (avg > 230)
Expected:
{
  "score": < 0.9,
  "quality": "warn",
  "issues": ["too_bright"]
}
```

#### Test 3.4: Blurry Frame
```
Canvas: Low edge sharpness (< 0.3)
Expected:
{
  "score": < 0.9,
  "quality": "warn",
  "issues": ["blurry"]
}
```

---

### 4. SSE Event Streaming

#### Test 4.1: Event Format Compliance
```
Expected SSE format:
event: <event_type>
data: <json>
[blank line]

✅ Each line ends with \n
✅ Blank line separates events
✅ data: prefix present
✅ JSON is valid and parseable
```

#### Test 4.2: Multiple Events
```
Browser receives:
1. event: connected
2. event: intent (with items)
3. event: suggestion (if meal-related)
4. event: done

Expected: All 4 events parsed without error
```

#### Test 4.3: Stream Closure
```
Server sends event:done and calls exit
Browser reader reaches EOF
Expected: No hanging connections
```

---

### 5. Frontend UI Tests

#### Test 5.1: Message Rendering
```javascript
// Test appendLiveMessage
dashboard.appendLiveMessage('You', 'I have milk');
// Expected: Teal-background message with "YOU" label

dashboard.appendLiveMessage('Coach', 'Got it!');
// Expected: White-background message with "COACH" label

dashboard.appendLiveMessage('System', 'Updated');
// Expected: Amber-background centered message with "SYSTEM" label
```

#### Test 5.2: Status Updates
```javascript
setLiveStatus('Listening...');
// Expected: Status text updates, visible in #kiq-live-status

setLiveStatus('Processing voice...');
// Expected: Status reflects current state
```

#### Test 5.3: Button State Changes
```javascript
// Start session
toggleLiveSession();
// Expected: 
//   - #kiq-live-start text → "Stop Coach"
//   - Button adds btn-danger class
//   - Camera feeds starts

// Stop session
stopLiveSession();
// Expected:
//   - #kiq-live-start text → "Start Coach"
//   - Button removes btn-danger class
//   - Camera stops
```

#### Test 5.4: Camera Toggle
```javascript
toggleCameraFacing();
// Expected:
//   - liveUsingRearCamera toggles
//   - Camera stream restarts with new facing mode
//   - Status shows "Switching..." then "Camera ready"
```

---

## Integration Tests

### Integration Test 1: Full Voice Conversation Flow

**Setup:**
- User logged in, Pro tier
- KitchenIQ Coach tab open

**Flow:**
1. Click "Start Coach"
2. Grant camera permission
3. Click "Talk to KitchenIQ Coach"
4. Speak: "I just bought milk and cheese from the store"
5. Click "Stop listening"

**Expected Results:**
- ✅ Camera stream displays
- ✅ "Listening..." status during speech
- ✅ Interim transcript updates: "I just bought milk..." etc
- ✅ Server receives: `{"transcript":"...milk and cheese...","audio_chunk":""}`
- ✅ Intent parser detects: items=['milk','cheese'], actions=['add','add']
- ✅ SSE events stream back: connected → intent → suggestion → done
- ✅ Browser parses events and displays:
  - "Heard: I just bought..."
  - "Coach: Coach heard: milk, cheese"
  - "Coach: I can help you plan a meal!..."
- ✅ Conversation thread displays both messages with proper styling

---

### Integration Test 2: Error Recovery

**Setup:**
- User on Coach tab
- Camera started

**Flow:**
1. Click "Talk" to start listening
2. Disable microphone/audio (system level or browser)
3. Speak (no audio detected)
4. Wait for timeout

**Expected Results:**
- ✅ Error event: "Microphone error" or "No speech detected"
- ✅ Status updates to show error message
- ✅ Button state resets: "Stop listening" → "Talk to KitchenIQ Coach"
- ✅ Can retry: click "Talk" again

---

### Integration Test 3: Network Interruption

**Setup:**
- Developer tools network throttling (offline)
- User starts voice session

**Flow:**
1. Click "Talk"
2. Speak clearly: "I have oranges"
3. Wait for response (network offline)

**Expected Results:**
- ✅ Status shows "Processing..." then timeout
- ✅ Error message: "Stream error - try again"
- ✅ Coach message: "Stream error - try again"
- ✅ Button resets; user can retry

---

## Performance Tests

### Performance Test 1: Frame Capture & Quality Assessment
```
Measure:
- Time to capture frame: should be < 100ms
- Time to assess quality: should be < 50ms
- Combined: < 150ms

Tool: Browser DevTools > Performance
```

### Performance Test 2: SSE Streaming Latency
```
Measure:
- Client sends POST
- Server receives + parses: < 10ms
- First SSE event sent: < 20ms from receipt
- Total: < 30ms "first byte" time

Tool: Network tab, check response timing
```

### Performance Test 3: Message DOM Updates
```
Measure:
- appendLiveMessage() DOM insertion: < 5ms
- Auto-scroll to latest: < 1ms
- UI responsive: no jank

Tool: DevTools > Rendering (FPS meter)
```

---

## Accessibility Tests

### A11y Test 1: Keyboard Navigation
```
✅ Can focus all buttons with Tab
✅ Can activate with Enter/Space
✅ Can navigate conversation thread with arrow keys
✅ Screen reader announces button labels
```

### A11y Test 2: Color Contrast
```
✅ Message text has 4.5:1 contrast (WCAG AA)
✅ Status badges readable
✅ Role labels visible
```

### A11y Test 3: ARIA Labels
```
✅ <video> has aria-label
✅ Buttons have aria-label
✅ Status region has aria-live
✅ Thread has aria-label
```

---

## Browser Compatibility Tests

| Browser | Test Items | Expected | Actual |
|---------|-----------|----------|--------|
| Chrome | Camera, Mic, SSE, Frame capture | All work | ☐ |
| Edge | Same | All work | ☐ |
| Safari | Same (iOS 15+) | All work | ☐ |
| Firefox | SSE may need polyfill | Works or degrades | ☐ |

---

## Mobile-Specific Tests

### Mobile Test 1: Permission Prompts
```
iOS: Camera + Mic permission requests
Android: Same

Expected: Clear prompts, accept/deny options work
```

### Mobile Test 2: Camera Facing Toggle
```
Tap "Switch camera" button
Expected: Toggles between front/rear smoothly
```

### Mobile Test 3: Landscape/Portrait
```
Rotate device during session
Expected: 
  - Camera stream resizes
  - Layout reflows
  - Controls remain accessible
```

---

## Debugging Commands

### Check SSE Connection
```javascript
// In browser console during stream
fetch('/wp-json/kitcheniq/v1/stream/voice', {
  method: 'POST',
  headers: {'X-WP-Nonce': kitcheniqData.nonce, 'Content-Type': 'application/json'},
  body: JSON.stringify({transcript: 'test'})
}).then(r => r.body.getReader()).then(r => {
  const decoder = new TextDecoder();
  return r.read().then(({value}) => console.log(decoder.decode(value)));
});
```

### Check Feature Gate
```php
// In WordPress admin console / WP-CLI
wp eval 'var_dump(KIQ_Features::allows(get_current_user_id(), "voice_assist"));'
```

### Monitor Stream Logs
```bash
# Tail WordPress debug log
tail -f /path/to/wp-content/debug.log | grep "KIQ"
```

### Test Intent Parser Directly
```php
$intents = KIQ_REST::parse_voice_intents('I have milk and eggs');
var_dump($intents);
// Expect: array with 'items' => ['milk','eggs'], 'actions' => [...]
```

---

## Checklist for Sign-Off

- [ ] POST /stream/voice endpoint returns 200 + SSE stream
- [ ] Intent parser correctly detects add/remove actions
- [ ] Frame quality assessment runs without errors
- [ ] SSE events parsed by browser without errors
- [ ] UI messages render with proper role-based styling
- [ ] Camera starts/stops cleanly
- [ ] Microphone activates with Web Speech API
- [ ] Error states gracefully handled
- [ ] Mobile responsive and touch-friendly
- [ ] Accessible via keyboard and screen reader
- [ ] Works on Chrome, Edge, Safari, Firefox
- [ ] No console errors or warnings
- [ ] Version correctly bumped to 1.0.7.0
- [ ] Service worker cache includes new assets
- [ ] Database unchanged (no migrations needed)

---

## Known Limitations (Phase 1)

1. **Intent Parser is Rule-Based:** Uses simple regex patterns. Future phases will upgrade to LLM-based intent detection.
2. **No Audio Upload:** Audio chunks are not yet sent to OpenAI Whisper. Phase 2+ will implement streaming audio.
3. **No Inventory Persistence:** Detected items are not auto-saved to inventory. Post-capture confirmation (Phase 4) will add this.
4. **No Meal Suggestions Yet:** Meal suggestions are hardcoded stubs. Phase 3 integrates with meal generation.
5. **No Freshness Checking:** No best_by / expiry logic yet. Phase 2 adds full freshness model.
6. **Web Speech API Fallback Only:** If unavailable, falls back to text prompt (not ideal UX; true audio streaming in Phase 2).

---

## Next Phase Entry Criteria

Phase 1 is complete when:
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] No critical accessibility violations
- [ ] Works on all target browsers
- [ ] Mobile responsive verified
- [ ] Documentation complete
- [ ] Code reviewed and approved
- [ ] Feature freeze: no new requirements mid-phase
