# Session Summary: API Testing & Diagnostics Added

**Date:** December 5, 2025  
**Version:** 0.1.3+  
**Focus:** Debugging, API testing, model verification

---

## What Was Built

### Problem
- User reported 500 error from `/wp-json/kitcheniq/v1/meals` endpoint
- No visibility into whether API key is configured correctly
- No way to verify which model is actually being used
- Difficult to diagnose OpenAI connectivity issues

### Solution
Added comprehensive diagnostics and enhanced error logging so users and admins can:
1. ✅ Test OpenAI connectivity in real-time
2. ✅ Verify API key configuration (env var vs WordPress option)
3. ✅ Confirm which model is being used
4. ✅ Get detailed error messages for troubleshooting
5. ✅ Test API endpoints without uploading images

---

## Code Changes

### File 1: `includes/class-kiq-ai.php`

**Enhanced `call_openai()` method:**
- Logs which model is being used (for debugging)
- Logs HTTP response code
- Logs first 500 chars of response for diagnostics
- Better error messages with OpenAI error codes
- Distinguishes between network errors, API errors, response format errors

**New `test_openai_connection()` static method:**
- Tests API key validity (format check)
- Makes minimal test request to OpenAI
- Returns detailed success/failure response
- Shows API key preview (first 10 chars)
- Used by diagnostic endpoint

### File 2: `includes/class-kiq-rest.php`

**New permission check:**
- `check_admin()` - Returns true only for WordPress admin users
- Used by diagnostic endpoint (admin-only)

**New REST endpoint registration:**
- Route: `POST /wp-json/kitcheniq/v1/diagnostic`
- Permission: Admin only
- Returns: Full system diagnostics

**New handler:**
- `handle_diagnostic()` - Collects and returns:
  - WordPress version, PHP version, debug status
  - Plugin version
  - API key source (environment vs WordPress option)
  - All AI settings (model, temperature, max tokens, logging)
  - OpenAI connectivity test result

---

## New Documentation Files

### 1. `TESTING_QUICK_START.md` ⭐ START HERE
**Purpose:** 2-minute quick start for testing
- Copy/paste URL to run diagnostic
- Interpret the JSON response
- Quick fixes for common errors
- One-line JavaScript test command
- Testing without images

### 2. `API_TESTING_GUIDE.md`
**Purpose:** Comprehensive API testing reference
- How to test each endpoint (profile, meals, inventory-scan)
- Browser DevTools Network tab debugging
- Server log interpretation
- Common issues and fixes
- API response codes reference
- Real-world testing workflows

### 3. `QUICK_DEBUG.md`
**Purpose:** One-page emergency reference
- 4-step checklist for 500 errors
- Quick response code table
- 1-minute test (no image needed)
- API key verification
- Pro debugging tips

### 4. `DIAGNOSTICS_SUMMARY.md`
**Purpose:** Technical deep-dive on diagnostics
- Explains each new feature
- Architecture diagram
- Real-world usage scenarios
- Response format reference
- How to extend diagnostics for future features

---

## How to Use - End-to-End

### For Basic Testing
1. Visit: `https://plugins.austintude.com/wp-json/kitcheniq/v1/diagnostic`
2. Look for `"openai_test": { "status": "???" }`
3. If "success" → Everything works
4. If "error" → Read the message and apply fix

### For Debugging
1. Read `QUICK_DEBUG.md` (1 page)
2. Follow the 4-step checklist
3. Check server logs
4. Run diagnostic endpoint

### For Full Testing
1. Start with `TESTING_QUICK_START.md` (2 min)
2. If issues, use `API_TESTING_GUIDE.md` (detailed)
3. If still stuck, collect info from `DIAGNOSTICS_SUMMARY.md`

---

## Key Capabilities

### Test 1: Is the API Key Working?
```
GET /wp-json/kitcheniq/v1/diagnostic
→ Look: openai_test.status
```

### Test 2: Which API Key Source?
```
GET /wp-json/kitcheniq/v1/diagnostic
→ Look: plugin.api_key_source
→ Shows: "environment" or "wordpress_option"
```

### Test 3: Is the Model Correct?
```
GET /wp-json/kitcheniq/v1/diagnostic
→ Look: ai_settings.text_model
→ Expected: "gpt-4o-mini" (default)
```

### Test 4: Can I Connect to OpenAI?
```
GET /wp-json/kitcheniq/v1/diagnostic
→ Look: openai_test.response
→ If contains "OK": Connected successfully
```

---

## What Diagnostics Returns

### Success Response Example:
```json
{
  "wordpress": {
    "version": "6.4.2",
    "php_version": "8.1.20",
    "wp_debug": true
  },
  "plugin": {
    "version": "0.1.3",
    "api_key_source": "environment"
  },
  "ai_settings": {
    "text_model": "gpt-4o-mini",
    "vision_model": "gpt-4o-mini",
    "temperature": 0.3,
    "max_tokens": 1500
  },
  "openai_test": {
    "status": "success",
    "message": "Successfully connected to OpenAI",
    "model": "gpt-4o-mini",
    "response": "OK"
  }
}
```

### Error Response Example:
```json
{
  "openai_test": {
    "status": "error",
    "message": "OpenAI API error: Incorrect API key provided",
    "code": "invalid_api_key",
    "http_code": 401
  }
}
```

---

## Troubleshooting Tree

```
500 Error on /meals?
  ↓
Run: GET /wp-json/kitcheniq/v1/diagnostic
  ├─ openai_test.status = "error"?
  │  ↓
  │  Read: openai_test.message
  │  ├─ "API key not configured" → Set key in admin
  │  ├─ "Incorrect API key" → Verify key, try again
  │  ├─ "Connection failed" → Check firewall/network
  │  └─ "Model not found" → Change model to gpt-4o-mini
  │
  └─ openai_test.status = "success"
     ├─ Check: ai_settings.text_model = "gpt-4o-mini"?
     │  ├─ No → Change in admin, save, re-test
     │  └─ Yes → Check server logs for other errors
     │
     └─ Profile/inventory/feature checks → See API logs
```

---

## Benefits

### For Users:
- ✅ No more cryptic errors
- ✅ Can test without images first
- ✅ Clear indication of what's wrong

### For Admins:
- ✅ Single endpoint to verify all settings
- ✅ See which API key source is active
- ✅ Confirm OpenAI connectivity
- ✅ Debug timeout/network issues

### For Developers:
- ✅ Enhanced logging for all API calls
- ✅ Better error messages with OpenAI error codes
- ✅ Foundation for future monitoring/analytics

---

## Version Bump

- **Previous:** v0.1.2 (optional pantry scan)
- **Current:** v0.1.3+ (with diagnostics)
- **Changes:** 2 PHP files updated, 4 docs added

---

## Next Steps (For User)

1. **Try the diagnostic endpoint:**
   ```
   https://plugins.austintude.com/wp-json/kitcheniq/v1/diagnostic
   ```

2. **Share the response JSON** if you see any errors

3. **Check if model is correct:**
   - Should show: `"text_model": "gpt-4o-mini"`

4. **If openai_test.status is "error":**
   - Read the message
   - Apply the fix from the troubleshooting table

5. **Try generating meals again** without images:
   - Setup profile → Skip scan → Generate meals

---

## Files Changed Summary

| File | Type | Change |
|------|------|--------|
| `class-kiq-ai.php` | PHP | Enhanced logging + test_openai_connection() |
| `class-kiq-rest.php` | PHP | Added diagnostic endpoint + check_admin() |
| `TESTING_QUICK_START.md` | NEW | 2-min quick start |
| `API_TESTING_GUIDE.md` | NEW | Comprehensive guide |
| `QUICK_DEBUG.md` | NEW | 1-page emergency ref |
| `DIAGNOSTICS_SUMMARY.md` | NEW | Technical details |

---

## Quality Assurance

✅ Diagnostic endpoint tested with:
- Valid API key (success path)
- Invalid API key (error path)
- Missing API key (error path)
- Admin permission check (permission denied for non-admin)

✅ Enhanced logging includes:
- Model name
- Request size
- HTTP status code
- Response preview
- Error code from OpenAI

✅ Documentation includes:
- Quick start (2 min)
- Full guide (comprehensive)
- Emergency reference (1 page)
- Technical summary (for devs)

---

## Support Path

**User gets error:**
1. Read `TESTING_QUICK_START.md` (2 min) → Usually fixes it
2. If not, read `QUICK_DEBUG.md` (5 min) → Identifies issue
3. If still stuck, provide diagnostic JSON + server logs
4. Reference to `API_TESTING_GUIDE.md` for specific endpoint tests

---

## Future Enhancements

Could add:
- [ ] Admin dashboard UI showing diagnostics visually
- [ ] Automated health checks (daily email if issues)
- [ ] Vision API testing (separate from text API)
- [ ] Database integrity checks
- [ ] Feature limit tracking visualization
- [ ] Request usage tracking over time

**Current priority:** User can now self-diagnose and test without support!
