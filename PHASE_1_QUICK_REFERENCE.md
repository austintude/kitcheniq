# Phase 1 Quick Reference Card

## Version
- **Current:** 1.0.7.0 (bumped from 1.0.6.15)
- **Release Date:** January 6, 2026

---

## What Users See

### Step 1: Open KIQ Coach
1. Navigate to KitchenIQ dashboard
2. Click "KIQ Coach" tab
3. See: "Talk to your KitchenIQ Coach" header + camera request

### Step 2: Start Session
1. Click "Start Coach"
2. Grant camera permission (browser prompt)
3. See: Live camera preview

### Step 3: Speak to Coach
1. Click "Talk to KitchenIQ Coach"
2. Speak naturally: *"I have milk and eggs"* or *"I used the flour"*
3. See: "Listening..." status + interim transcript
4. Can see TTS toggle for replies read aloud

### Step 4: Get Response
1. Click "Stop listening" (or wait for auto-timeout)
2. See: Coach message with detected items
3. See: Optional suggestion ("I can help you plan a meal...")
4. Conversation thread shows full exchange

### Step 5: Continue or Exit
- **Continue:** Click "Talk" again for next utterance
- **Exit:** Click "Stop Coach" to end session

---

## For Developers

### New REST Endpoint
```
POST /wp-json/kitcheniq/v1/stream/voice
Headers:
  X-WP-Nonce: [nonce]
  Content-Type: application/json
Body:
  {
    "transcript": "I have milk",
    "audio_chunk": ""
  }
Returns:
  Server-Sent Events stream
  event: connected
  event: intent
  event: suggestion (optional)
  event: done
```

### New JavaScript Methods

**Start/stop session:**
```javascript
toggleLiveSession()      // Start or stop camera
startLiveSession()       // Start camera stream
stopLiveSession()        // Stop camera stream
toggleCameraFacing()     // Toggle front/rear
```

**Voice input:**
```javascript
toggleLiveAudio()        // Start/stop listening with Web Speech API
streamVoiceInput(text)   // Send transcript to /stream/voice endpoint
captureLiveFrame()       // Get current camera frame
```

**UI updates:**
```javascript
setLiveStatus(text)      // Update status badge
appendLiveMessage(role, text)  // Add message to conversation
// roles: 'You', 'Coach', 'System'
```

**Quality assessment:**
```javascript
assessFrameQuality(canvas)  // Returns { score, issues, quality }
estimateEdgeSharpness(canvas) // Blur detection helper
```

### New PHP Methods (class-kiq-rest.php)

**Main handler:**
```php
handle_stream_voice($request)  // Main SSE endpoint handler
```

**Helpers:**
```php
parse_voice_intents($transcript)  // Extract items/actions from text
send_sse_event($type, $data)      // Send SSE-formatted event
```

### New CSS Classes

```css
/* Status indicators */
.kiq-live-status-connecting     /* Yellow "Connecting" badge */
.kiq-live-status-listening      /* Red pulsing "Listening" */
.kiq-live-status-processing     /* Blue pulsing "Processing" */

/* Messages */
.kiq-live-message               /* Base message container */
.kiq-live-message.user          /* Teal background, right-aligned */
.kiq-live-message.coach         /* White background, left-aligned */
.kiq-live-message.system        /* Amber background, centered */
.kiq-live-message-sender        /* Role label */

/* Preview */
.kiq-live-preview               /* Camera preview container */
.kiq-live-quality-badge         /* Frame quality overlay badge */
.kiq-live-quality-badge.good    /* Green quality indicator */
.kiq-live-quality-badge.warn    /* Amber quality indicator */
.kiq-live-quality-badge.bad     /* Red quality indicator */

/* Thread */
.kiq-live-thread                /* Conversation container */
.kiq-live-controls              /* Button group */
```

---

## Testing Checklist (Quick)

**Essential Tests:**
- [ ] Camera starts/stops
- [ ] Web Speech API captures voice (or text prompt fallback)
- [ ] `/stream/voice` endpoint returns SSE stream
- [ ] Intent parser detects items correctly
- [ ] Frame quality assessment runs
- [ ] Messages display with proper styling
- [ ] Works on mobile (portrait/landscape)
- [ ] Works on Chrome, Edge, Safari, Firefox

**For Full Testing:** See [PHASE_1_TESTING_GUIDE.md](./PHASE_1_TESTING_GUIDE.md)

---

## Common Issues & Fixes

### Issue: "Camera not supported"
- **Cause:** Browser doesn't support getUserMedia
- **Fix:** Use modern browser (Chrome, Edge, Safari 11+, Firefox)

### Issue: "Microphone blocked"
- **Cause:** Browser or OS denied microphone permission
- **Fix:** Check browser settings → Allow microphone access

### Issue: "No speech detected"
- **Cause:** Microphone not picking up audio
- **Fix:** Check mic input level, move closer, reduce background noise

### Issue: "Stream error - try again"
- **Cause:** Network interruption or endpoint returned error
- **Fix:** Check internet connection, server logs; try again

### Issue: Messages not showing
- **Cause:** JavaScript error or DOM element missing
- **Fix:** Check browser console for errors; verify #kiq-live-thread exists

### Issue: Blurry frame warning
- **Cause:** Camera motion or poor focus
- **Fix:** Hold device steady; ensure good lighting

---

## Files Changed (Summary)

| File | Change Type | Details |
|------|-------------|---------|
| `kitchen-iq.php` | Version | 1.0.6.15 → 1.0.7.0 |
| `class-kiq-rest.php` | New Route | `/kitcheniq/v1/stream/voice` |
| `class-kiq-rest.php` | New Handler | `handle_stream_voice()` |
| `class-kiq-rest.php` | New Helpers | `parse_voice_intents()`, `send_sse_event()` |
| `kiq-dashboard.js` | New Method | `streamVoiceInput()` |
| `kiq-dashboard.js` | Enhanced | `captureLiveFrame()`, `appendLiveMessage()` |
| `kiq-dashboard.js` | New Quality | `assessFrameQuality()`, `estimateEdgeSharpness()` |
| `kiq-dashboard.css` | New Styles | Streaming states, message styling, quality badges |

**No database changes required.**

---

## Deployment Checklist

- [ ] Plugin version updated in header + constant ✅
- [ ] REST route registered ✅
- [ ] JavaScript enqueued with correct version ✅
- [ ] CSS enqueued with correct version ✅
- [ ] Service worker cache updated (auto via KIQ_VERSION) ✅
- [ ] Feature gate working (Pro tier check) ✅
- [ ] Error handling graceful ✅
- [ ] Mobile responsive ✅
- [ ] Accessibility checked ✅
- [ ] No database migrations needed ✅

---

## What's NOT in Phase 1

❌ Audio file upload (use Web Speech API only)  
❌ Inventory persistence (add items to pantry)  
❌ Freshness/expiry logic  
❌ Meal plan integration  
❌ Store-mode shopping lists  
❌ Notifications/nudges  
❌ LLM-based intent parsing  
❌ Analytics/logging  

All planned for Phases 2–5.

---

## Performance Expectations

| Operation | Time | Notes |
|-----------|------|-------|
| Start camera | < 500ms | Browser getUserMedia |
| Frame capture | < 100ms | Canvas drawImage |
| Quality assess | < 50ms | Pixel sampling |
| Speech recognition | Continuous | Web Speech API, no timeout |
| POST to /stream/voice | < 30ms | Network time + parse |
| SSE event delivery | < 50ms | Real-time, no polling |
| UI message render | < 5ms | DOM insert + scroll |

---

## Architecture One-Liner

**Client:** Camera + Web Speech API → transcript + frame  
**Server:** Intent parser extracts items/actions  
**Response:** SSE streams detected items + suggestions  
**UI:** Conversation thread shows exchange  

---

## Next Phase Preview

### Phase 2: Freshness Model
- Track `added_at`, `best_by`, `last_confirmed_at` for all items
- Pre-filter expired items before meal suggestions
- Decay scoring (how likely item is still usable)

### Phase 3: Store Mode
- "I'm at the store" quick mode
- Gap analysis vs planned meals
- Smart buy-list
- Waste reduction prompts

### Phase 4: Confirmations & Corrections
- Post-capture confirmation card
- Quick fixes: "Move to pantry", "Mark expired"
- Voice shortcuts for common actions

### Phase 5: Intelligence & Notifications
- Expiry nudges
- Weekly use-it-up recipes
- Proactive waste prevention
- Streaming/reliability hardening

---

## Support & Debugging

**Logs:**
- Check browser console: `Cmd+Opt+J` (Mac) or `Ctrl+Shift+J` (Windows)
- WordPress debug: `/wp-content/debug.log` (if enabled)
- Network tab: Look for `/stream/voice` requests

**Nonce Issues:**
- Verify `kitcheniqData.nonce` exists in page HTML
- Check WordPress nonce validation in `check_auth()`

**Feature Gate Issues:**
- Verify user is Pro tier
- Check `kiq_tier_limits` option in WordPress admin

**SSE Issues:**
- Verify browser supports EventSource (all modern browsers do)
- Check network tab for 200 response + streaming data
- Look for `text/event-stream` Content-Type header

---

## Contact & Questions

For Phase 1 questions:
1. Check [PHASE_1_TESTING_GUIDE.md](./PHASE_1_TESTING_GUIDE.md) for test scenarios
2. Check [PHASE_1_ARCHITECTURE.md](./PHASE_1_ARCHITECTURE.md) for system design
3. Check [PHASE_1_IMPLEMENTATION.md](./PHASE_1_IMPLEMENTATION.md) for exact code changes
4. Review browser console for JavaScript errors
5. Check WordPress debug log for PHP errors

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.7.0 | Jan 6, 2026 | Phase 1: Live voice streaming |
| 1.0.6.15 | (previous) | Previous release |

---

**Ready to ship. Questions? See the full Phase 1 docs.** 🚀
