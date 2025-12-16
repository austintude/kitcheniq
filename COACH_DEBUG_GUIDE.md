# KIQ Coach Audio & Speech Recognition Debugging Guide

**Issue**: Audio/speech not being captured during Coach session  
**Status**: Fixed in v0.6.11 - Root cause was requesting audio from getUserMedia() which conflicted with Web Speech API

## What Was Fixed

### Root Cause
Web Speech API (browser's speech-to-text service) accesses the device microphone **independently** from getUserMedia(). When we requested both:
```javascript
// OLD - WRONG
navigator.mediaDevices.getUserMedia({ 
    video: true, 
    audio: true  // <-- This conflicts!
})
```

On some browsers (Chrome, Safari), simultaneous access to the same audio device fails or causes one to block the other.

### Solution Applied
Removed audio request from getUserMedia since:
1. We only need **video** for frame capture (vision calls to AI)
2. Web Speech API uses its own microphone access
3. Keeping them separate avoids device conflicts

```javascript
// NEW - CORRECT
navigator.mediaDevices.getUserMedia({ 
    video: { facingMode: 'environment', ... }
    // NO audio: true here!
})
```

## How to Debug Issues

### Step 1: Open Browser Console
- **Chrome/Edge**: F12 → Console tab
- **Safari**: Develop → Show JavaScript Console (enable first in Preferences)
- **Firefox**: F12 → Console tab

### Step 2: Test Coach and Watch Console Logs

All interactions now log detailed information. Look for:

```
"Speech recognition started"
"onstart event fired"
"onresult event: X results, isFinal: true/false"
"Heard: [your speech text]"
"onend event, finalTranscript: [final text]"
"Sending payload to /live-assist"
"Response status: 200 ok: true"
"Coach message: [response]"
```

### Step 3: Identify Which Stage Failed

**If you see:**

1. **"Speech recognition started"** ✅
   - Speech recognition API initialized
   - Proceed to next stage

2. **No "onstart" event** ❌
   - Microphone permission may be denied
   - Check browser permissions (camera icon in address bar)
   - Try: Settings → Privacy → Microphone → Allow this site

3. **"onresult" never fires while speaking** ❌
   - Microphone is not picking up sound
   - Check: Device microphone is not muted (hardware button)
   - Check: Volume is loud enough (browser min threshold ~20dB)
   - Try: Speak closer to microphone, speak louder

4. **"onresult: 0 results"** ❌
   - Speech recognition heard something but very faint
   - Ambient noise may be too high
   - Try in a quieter environment

5. **Error: "audio-capture"** ❌
   - Microphone is already in use by another app
   - Close other apps using mic (Zoom, Discord, etc.)
   - Restart browser

6. **Error: "network"** ❌
   - No internet connection to Google's speech API
   - Check network connection
   - Some corporate firewalls block speech API
   - Try: Different network (mobile hotspot)

7. **Response status: 403 or 429** ❌
   - REST API rejected the request
   - 403 = Feature not enabled on your tier
   - 429 = Rate limit exceeded
   - Check: Profile tier (must be Pro for Coach)
   - Wait and retry

8. **Response status: 500** ❌
   - Backend error processing request
   - Check server logs: `wp-content/debug.log` (if WP_DEBUG enabled)
   - Payload may have been malformed

9. **Thread stays empty** ❌
   - `appendLiveMessage()` not being called
   - Speech recognition worked but REST call failed (check #7-8)
   - Or Coach returned empty response

### Step 4: Enable WordPress Debug Logging

To see backend errors:

**In wp-config.php:**
```php
define( 'WP_DEBUG', true );
define( 'WP_DEBUG_LOG', true );
define( 'WP_DEBUG_DISPLAY', false );  // Log to file instead of screen
```

**Check for errors in:**
```
/wp-content/debug.log
```

### Step 5: Check Permission States

In browser console, run:
```javascript
// Check if Speech Recognition is available
console.log('SpeechRecognition:', window.SpeechRecognition || window.webkitSpeechRecognition);

// Check if getUserMedia worked
console.log('Navigator.mediaDevices:', navigator.mediaDevices);
```

## Common Scenarios & Fixes

### Scenario: Camera works but no speech recognition
**Likely cause**: Microphone permission denied  
**Fix**: 
1. Open browser settings
2. Find this site's camera/microphone permissions
3. Set Microphone to "Allow"
4. Reload and try again

### Scenario: Speech recognition starts but stops immediately
**Likely cause**: Silence detected (no speech within ~5 seconds)  
**Fix**: Speak louder or closer to microphone
**Note**: Maximum single session is usually ~30 seconds; click again if you need longer

### Scenario: "No speech detected" message
**Likely cause**: Audio is too quiet or too much background noise  
**Fix**: 
- Reduce background noise (turn off TV, close windows)
- Speak clearly and at normal volume
- Use a better microphone if on laptop

### Scenario: Stops mid-sentence
**Likely cause**: Browser interrupted speech recognition  
**Typical reasons**:
- Microphone became unavailable
- Browser ran out of memory
- Another app started using microphone
- Timeout after ~30 seconds of silence

**Fix**: Click "Talk" again to restart

## Testing Checklist

- [ ] Camera opens and shows rear view
- [ ] "Camera ready" message appears in status
- [ ] Click "Talk" → "Listening..." message appears
- [ ] Speak naturally ("I see tomatoes and basil on the shelf")
- [ ] Console shows "onresult" events as you speak
- [ ] After you stop: "Sending to Coach..." appears
- [ ] Console shows response from API
- [ ] Coach message appears in conversation thread
- [ ] Status changes back to "Ready to talk"
- [ ] Optional: Click TTS toggle and hear Coach's reply aloud

## Advanced: Manual Speech Recognition Test

Paste in browser console to test without Coach UI:

```javascript
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const r = new Recognition();
r.continuous = false;
r.interimResults = true;

r.onstart = () => console.log('Recognition started');
r.onresult = (e) => console.log('Heard:', e.results[e.results.length - 1][0].transcript);
r.onerror = (e) => console.error('Error:', e.error);
r.onend = () => console.log('Recognition ended');

r.start();
console.log('Speak now...');
```

## Files Modified in v0.6.11

- **[kitchen-iq/assets/js/kiq-dashboard.js](kitchen-iq/assets/js/kiq-dashboard.js)**
  - Removed `audio: true` from getUserMedia() constraints
  - Added comprehensive console logging to speech recognition
  - Added better error messages for each failure scenario
  - Fixed `toggleLiveAudio()` method

## Related Documentation

- Web Speech API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API
- getUserMedia: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
- Browser Permissions: https://support.google.com/chrome/answer/2693767

---

**If you still see issues after these fixes:**
1. Open browser console (F12)
2. Run through Coach workflow while watching console
3. Screenshot the error messages
4. Check debug.log on server
5. Report the exact console error
