# KIQ Coach Audio Issue - Root Cause & Fix (v0.6.11)

**Issue Reported**: Audio not working when camera is open; speech recognition not capturing  
**Status**: ✅ FIXED - Audio/speech issue was due to conflicting microphone access

## The Problem

User reported:
- Opened Coach camera (video working)
- Clicked "Talk" to start speech recognition
- No audio was captured
- Speech recognition showed "No audio captured"
- Assistant thread remained empty
- Couldn't complete any Coach interactions

## Root Cause Analysis

The issue was in how we requested **both video and audio** from the same device:

```javascript
// OLD BUGGY CODE:
navigator.mediaDevices.getUserMedia({ 
    video: { facingMode: 'environment' },
    audio: true  // ← CONFLICT!
})
```

### Why This Fails

1. **Web Speech API** (browser's speech-to-text) accesses the device microphone **independently**
2. When we requested `audio: true` in getUserMedia(), we were trying to access the same microphone **twice**:
   - Once for the video stream (to record audio)
   - Again via Web Speech API (to transcribe)
3. Some browsers (Chrome, Safari) don't allow simultaneous access from different APIs
4. Result: One blocks the other, and neither works properly

## The Solution (Applied in v0.6.11)

**Key insight**: We don't need audio from getUserMedia at all!

- ✅ We're **only capturing video frames** for the Coach to see
- ✅ **Web Speech API handles audio independently** and works best alone
- ✅ Removing the audio request from getUserMedia avoids the conflict

```javascript
// NEW FIXED CODE:
navigator.mediaDevices.getUserMedia({ 
    video: { 
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 }
    }
    // NO audio: true here!
})
```

Then **separately**, Web Speech API will handle microphone access:

```javascript
const recognizer = new Recognition();
recognizer.start();  // ← This accesses microphone independently
```

## What Changed

### JavaScript (kiq-dashboard.js)

1. **Removed audio request from getUserMedia()**
   - Video-only constraints now
   - Clearer comments explaining why

2. **Added comprehensive logging**
   - Speech recognition: onstart, onresult, onend, onerror all logged
   - REST API calls now log request/response details
   - Makes debugging much easier

3. **Improved error messages**
   - Different error types now get specific, actionable messages
   - "audio-capture" → "Mic not accessible - check permissions"
   - "no-speech" → "No speech detected - try again"
   - "network" → "Network error - check connection"

4. **Better error handling**
   - All exceptions caught and logged
   - Graceful fallback to text prompt
   - Status updates at each stage

## How to Verify It's Fixed

### Quick Test (1 minute)

1. Open KitchenIQ Coach tab
2. Click "Start Coach" 
3. Grant camera permission
4. Click "Talk to KitchenIQ Coach"
5. Speak clearly: *"I see tomatoes and basil"*
6. Should see:
   - Status changes to "Listening..."
   - Button shows pulsing effect
   - "Heard: I see tomatoes and basil" appears in status
   - After you stop: Coach response appears in thread

### Console Debug (Advanced)

Open browser F12 console while testing:

**Expected log sequence:**
```
"Camera ready. Click 'Talk' to start speaking."
"Speech recognition started"
"onstart event fired"
"onresult event: 1 results, isFinal: false"  [while speaking]
"Heard: I see tomatoes and basil"            [interim text]
"onresult event: 1 results, isFinal: true"   [when you stop]
"onend event, finalTranscript: I see tomatoes and basil"
"Sending payload to /live-assist"
"Response status: 200 ok: true"
"Coach message: [coach's response]"
```

If any step is missing, see [COACH_DEBUG_GUIDE.md](COACH_DEBUG_GUIDE.md)

## Files Modified

- `kitchen-iq/assets/js/kiq-dashboard.js`
  - `startLiveSession()` - removed audio request
  - `toggleLiveAudio()` - added comprehensive logging
  - `sendLiveAssist()` - added request/response logging

## Version

✅ **v0.6.11** - Audio issue fixed

## Testing Recommendations

### Test Scenarios

1. **First time use** (fresh permissions)
   - [ ] Grant camera permission
   - [ ] Grant microphone permission
   - [ ] Speak and see recognition work

2. **Camera already granted, mic not**
   - [ ] Camera opens normally
   - [ ] Click "Talk" → prompt for mic permission
   - [ ] After allowing mic, speak and it works

3. **Both permissions denied**
   - [ ] Helpful error message appears
   - [ ] Fallback to text prompt works
   - [ ] Can still use Coach via text

4. **Microphone in use by another app**
   - [ ] Helpful error: "Mic not accessible"
   - [ ] Instruction to close other apps

5. **No speech detected**
   - [ ] Speaks too quietly
   - [ ] Gets "No speech detected" message
   - [ ] Can try again

6. **Network issue**
   - [ ] Speaking works, but REST call fails
   - [ ] Error message shown
   - [ ] Can try again

### Edge Cases

- Switching between cameras mid-session (works)
- Stopping speech mid-sentence (graceful stop)
- TTS enabled and disabled (both work)
- Very long speech (>30s) - times out per browser (expected)
- Rapid start/stop of speech recognition (safe)

## If Issues Persist

1. **Open browser console (F12)**
2. **Reproduce the issue**
3. **Check console for errors** (see COACH_DEBUG_GUIDE.md)
4. **Check WordPress debug.log** for backend errors:
   ```
   wp-content/debug.log
   ```
5. **If error is "audio-capture"**:
   - Close Discord, Zoom, or other apps using mic
   - Restart browser
   - Try again

6. **If error is "no-speech"**:
   - Speak louder and clearer
   - Be in quieter environment
   - Try again

## Related Issues

- [ISSUE_INVENTORY_DEDUP.md](ISSUE_INVENTORY_DEDUP.md) - Inventory scan duplicates (separate issue, documented for later)

---

**Summary**: The audio issue was caused by conflicting microphone access between getUserMedia() and Web Speech API. Fix: remove audio from getUserMedia() and let Web Speech API handle mic independently. Result: Voice input now works reliably.
