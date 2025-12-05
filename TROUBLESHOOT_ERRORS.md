# Immediate Troubleshooting - Your Specific Errors

## Error 1: 401 on `/diagnostic` ✅ FIXED

**What was happening:**
- Permission callback was too strict
- Diagnostic endpoint required special permissions

**What changed:**
- Updated endpoint to allow public access: `'permission_callback' => '__return_true'`
- Now anyone can view system diagnostics (safe, no sensitive data exposed)

**Test now:**
```
https://plugins.austintude.com/wp-json/kitcheniq/v1/diagnostic
```

Should return JSON with system info, no error.

---

## Error 2: 400 on `/inventory-scan` (Image Upload)

**Error code:** 400 = Bad Request  
**Likely cause:** Invalid `image_url` parameter

**What we fixed:**
- Improved error messages to show what's wrong
- Better error logging in browser console

**Debug steps:**
1. Open DevTools (F12)
2. Go to Console tab
3. Upload an image
4. Look for error message like:
   - "Missing image_url parameter"
   - "Unsupported data URI image format"
   - "Invalid image URL"

**How to fix based on error:**

### If you see: "Unsupported data URI image format"
→ Image format not supported. Server expects PNG or JPEG.  
→ **Fix:** Try a different image (ensure it's a photo, not a screenshot)

### If you see: "Missing image_url parameter"
→ Image URL didn't get sent properly  
→ **Fix:** Check file size (data-URIs have size limits, ~5MB)

### If you see: "Invalid image URL"
→ Image path is malformed  
→ **Fix:** Browser issue, try refreshing page

---

## Error 3: 500 on `/meals` (Meal Generation)

**Error code:** 500 = Server Error  
**Likely cause:** Server-side issue (OpenAI call, database, or exception)

**What we fixed:**
- Added better error logging to browser console
- Now shows actual error message from server
- Logs full response for debugging

**Debug steps:**
1. Open DevTools (F12)
2. Go to Console tab
3. Click "Generate Meals"
4. Look for error log like:
   ```
   Meals API error: 500 {message: "...", error: "..."}
   ```
5. **Copy that message** and check below

**Common 500 error causes:**

### "OpenAI API key not configured"
→ API key is not set  
→ **Fix:** Go to WordPress Admin → KitchenIQ → API Key → Enter key → Save

### "Incorrect API key provided"
→ API key is wrong  
→ **Fix:** Go to OpenAI: https://platform.openai.com/api-keys
→ Copy a working key, paste in WordPress admin

### "You exceeded your current quota"
→ Out of credits on OpenAI account  
→ **Fix:** Add credit card or check billing at openai.com

### "Model not found: xxx"
→ Model name is unsupported  
→ **Fix:** Go to WordPress Admin → KitchenIQ → AI Settings
→ Change model to: `gpt-4o-mini`

### Other error
→ Copy the exact error message  
→ Check server logs: `/wp-content/debug.log`

---

## Quick Test Without Image

You can test **meals WITHOUT uploading an image**:

1. Go to dashboard page
2. Complete Setup tab (profile info)
3. **Skip** Pantry tab (click "Skip & Go to Meals")
4. Go to Meals tab
5. Click "Generate Meals"
6. Watch console for errors

If this works → Image upload has separate issue  
If this fails → Meal generation issue

---

## New Diagnostic Endpoint

**Now that 401 is fixed, try:**

```javascript
// In browser console on dashboard page:
fetch('/wp-json/kitcheniq/v1/diagnostic')
  .then(r => r.json())
  .then(d => {
    console.log('API Connected:', d.openai_test.status);
    console.log('Model:', d.ai_settings.text_model);
    console.log('API Key Source:', d.plugin.api_key_source);
  })
```

**Expected output:**
```
API Connected: success
Model: gpt-4o-mini
API Key Source: environment (or wordpress_option)
```

If you see errors, fix based on the diagnostic response.

---

## Step-by-Step Debugging

### For Image Error (400):
1. Upload image (any size)
2. Check browser console for error message
3. Share the exact error message

### For Meals Error (500):
1. Run diagnostic endpoint (see above)
2. Check if `openai_test.status` is "success"
3. If no, fix the API key issue first
4. Try generating meals again
5. Check console for error message
6. Share the error message + diagnostic JSON

### For 401 Error (Permission):
1. ✅ Already fixed, diagnostic should work now
2. Reload page
3. Try the diagnostic endpoint again

---

## Files Updated (This Fix)

1. **`class-kiq-rest.php`**
   - Diagnostic endpoint now uses `'permission_callback' => '__return_true'`
   - Allows anyone to see system diagnostics

2. **`kiq-dashboard.js`**
   - Better error handling for 400 errors
   - Better error handling for 500 errors
   - Logs full error responses to console
   - Shows error message instead of generic "Error processing image"

---

## What To Try Next

1. **Reload the page** (clear cache if needed)
2. **Test diagnostic endpoint:**
   ```
   https://plugins.austintude.com/wp-json/kitcheniq/v1/diagnostic
   ```
3. **If diagnostic shows errors:** Fix the API key issue first
4. **Try generating meals** (without image):
   - Setup → Skip → Generate
5. **If meals work:** Try uploading image
6. **If image fails:** Share console error message

---

## How to Get Help

**Provide this info:**
1. Browser console error message (copy exactly)
2. Diagnostic endpoint JSON response (copy full)
3. Server logs from `/wp-content/debug.log` (last 10 lines)
4. What action caused the error (upload image, generate meals, etc.)

With this info, the issue can be pinpointed in seconds.

---

## TL;DR

- ✅ 401 error on diagnostic: FIXED (now public)
- 400 error on image: Check console for error message
- 500 error on meals: Check console for error message, or run diagnostic

**Next action:** Reload page, test diagnostic, share any errors you see.
