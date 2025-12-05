# API Testing & Diagnostics - What We Added

## New Diagnostic Features

### 1. **Diagnostic REST Endpoint** (Admin-only)
- **URL:** `GET /wp-json/kitcheniq/v1/diagnostic`
- **Access:** Admin users only (via `current_user_can( 'manage_options' )`)
- **Returns:** Complete system health check including:
  - WordPress & PHP version
  - Plugin version
  - API key source (environment vs WordPress option)
  - All AI settings (model, temperature, tokens, etc.)
  - **OpenAI connectivity test** (attempts a test call to OpenAI)

### 2. **Enhanced Error Logging in AI Class**
- **File:** `includes/class-kiq-ai.php`
- **New function:** `KIQ_AI::test_openai_connection()`
  - Tests that API key is valid format
  - Makes a minimal test call to OpenAI
  - Returns success/failure with specific error details
  - Previews API key (first 10 chars for security)

- **Improved `call_openai()` function**
  - Logs which model is being used
  - Logs request payload size
  - Logs HTTP response code
  - Logs first 500 chars of response body (for debugging)
  - Distinguishes between network errors, API errors, and response format errors
  - Better error messages with error codes from OpenAI

### 3. **Admin Permission Check**
- **File:** `includes/class-kiq-rest.php`
- **New function:** `KIQ_REST::check_admin()`
- **Used by:** `/diagnostic` endpoint only

---

## What You Can Now Diagnose

### Test 1: Is OpenAI Reachable?
```
GET /wp-json/kitcheniq/v1/diagnostic
→ Check: openai_test.status
→ If "error": Network/firewall issue OR invalid API key
```

### Test 2: Is the API Key Configured?
```
GET /wp-json/kitcheniq/v1/diagnostic
→ Check: plugin.api_key_source
→ Should be: "environment" or "wordpress_option"
→ If "not_set": No API key found anywhere
```

### Test 3: Which Model is Being Used?
```
GET /wp-json/kitcheniq/v1/diagnostic
→ Check: ai_settings.text_model
→ Expected: "gpt-4o-mini" (default) or "gpt-4o"
→ If different: Setting not applied correctly
```

### Test 4: Can OpenAI Actually Process Requests?
```
GET /wp-json/kitcheniq/v1/diagnostic
→ Check: openai_test.response
→ If contains "OK" or similar: Connected successfully
→ If error message: API rejected the request
  - "Incorrect API key provided" = Wrong key
  - "You exceeded your current quota" = Out of credits
  - "Model not found" = Model name unsupported
```

---

## Real-World Usage Examples

### Scenario 1: User reports "Error generating meals" (500 error)

**As admin, run:**
```javascript
fetch('/wp-json/kitcheniq/v1/diagnostic')
  .then(r => r.json())
  .then(d => console.log(JSON.stringify(d, null, 2)))
```

**Likely findings:**
- `openai_test.status: "error"` → API key issue
- `openai_test.message: "Incorrect API key provided"` → Update key in admin panel
- `openai_test.message: "You exceeded your current quota"` → No credits on OpenAI account
- `ai_settings.text_model: "gpt-5"` → Unsupported model, change to gpt-4o-mini

---

### Scenario 2: Trying to verify that settings are actually being used

**Current flow:**
1. Admin → KitchenIQ → AI Settings
2. Change model to `gpt-4o`
3. Click Save
4. Run diagnostic endpoint
5. Verify `ai_settings.text_model` shows `gpt-4o`

**If it still shows the old value:**
- Settings didn't save (check permissions)
- Page cache is stale (clear cache)
- Settings value is wrong in database (use WP-CLI to check)

---

### Scenario 3: Testing before going live

**Recommended steps:**

1. **Set API key:**
   - Option A: Environment variable (production)
   - Option B: WordPress admin panel (testing)

2. **Run diagnostic:**
   ```
   GET /wp-json/kitcheniq/v1/diagnostic
   Verify all green ✅
   ```

3. **Complete a full flow:**
   - Save profile
   - Generate meals
   - (Optional) Upload image

4. **Check logs:**
   ```
   tail -f wp-content/debug.log
   Look for success messages (no errors)
   ```

5. **Go live!** ✅

---

## Files Modified This Session

### 1. `includes/class-kiq-ai.php`
- Enhanced `call_openai()` with better logging and error handling
- Added `test_openai_connection()` public static method
- Logs HTTP status, response format, and error codes

### 2. `includes/class-kiq-rest.php`
- Added `check_admin()` permission callback
- Added `handle_diagnostic()` REST handler
- Registered `/diagnostic` endpoint (admin-only)

### 3. NEW: `API_TESTING_GUIDE.md`
- Comprehensive guide for testing each endpoint
- Common issues and fixes
- Network tab debugging steps
- Server log interpretation

### 4. NEW: `QUICK_DEBUG.md`
- 1-page quick reference
- Step-by-step troubleshooting for 500 errors
- Response code reference
- Pro debugging tips

---

## Architecture: How Diagnostics Work

```
Admin hits /wp-json/kitcheniq/v1/diagnostic
          ↓
    check_admin() - Verify WordPress admin privileges
          ↓
    handle_diagnostic() collects:
     1. WordPress info (version, PHP, debug status)
     2. Plugin settings (version, API key source)
     3. AI settings (model, temperature, etc.)
     4. OpenAI connection test
          ↓
    test_openai_connection():
     - Validates API key format (starts with "sk-")
     - Makes minimal test request (3 messages)
     - Captures response or error
          ↓
    Returns JSON with all info + test result
          ↓
    Admin can identify exact issue
```

---

## Response Format Reference

### Success Response (200):
```json
{
  "wordpress": {
    "version": "6.4.2",
    "php_version": "8.1.20",
    "wp_debug": true,
    "debug_log": "/var/www/html/wp-content/debug.log"
  },
  "plugin": {
    "version": "0.1.3",
    "api_key_source": "environment"
  },
  "ai_settings": {
    "text_model": "gpt-4o-mini",
    "vision_model": "gpt-4o-mini",
    "temperature": 0.3,
    "max_tokens": 1500,
    "logging_enabled": false
  },
  "openai_test": {
    "status": "success",
    "message": "Successfully connected to OpenAI",
    "model": "gpt-4o-mini",
    "response": "OK",
    "api_key_preview": "sk-proj-5d..."
  }
}
```

### Error Response (API key issue):
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

### Error Response (Connection issue):
```json
{
  "openai_test": {
    "status": "error",
    "message": "Connection failed: cURL error 7: Failed to connect to api.openai.com port 443"
  }
}
```

---

## For Future Debugging

### To add more diagnostics:

1. **In `class-kiq-ai.php`:**
   - Update `test_openai_connection()` to test vision API separately
   - Add JSON schema validation before sending

2. **In `class-kiq-rest.php`:**
   - Add more tests for specific features
   - Check database state (user preferences, inventory, etc.)

3. **Create admin UI page:**
   - Visual dashboard showing diagnostic results
   - One-click API key validation
   - Recent error log viewer

---

## Testing The New Features

### Test the diagnostic endpoint:

**Using cURL:**
```bash
curl -X GET \
  https://plugins.austintude.com/wp-json/kitcheniq/v1/diagnostic \
  -H "Authorization: Bearer $NONCE" \
  -H "Cookie: wordpress_logged_in=..."
```

**Using JavaScript (in browser):**
```javascript
// From dashboard page
const response = await fetch(
  '/wp-json/kitcheniq/v1/diagnostic',
  {
    headers: {
      'X-WP-Nonce': kitcheniqData.nonce,
      'Content-Type': 'application/json'
    }
  }
);
const data = await response.json();
console.log(data);
```

**From WordPress admin:**
- Any admin user can access the endpoint
- Try visiting the URL directly in a new tab
- Response will be plain JSON

---

## Next Steps

1. **Visit the diagnostic endpoint** as an admin
2. **Check the `openai_test` section** - if it shows "error", see what the message says
3. **Update API key** if needed in WordPress Admin → KitchenIQ → API Key
4. **Re-run diagnostic** to confirm connection succeeds
5. **Try generating meals** again

If problems persist after checking diagnostic:
- Check server logs: `/wp-content/debug.log`
- Search for "KitchenIQ" error messages
- Share diagnostic JSON + log excerpt for analysis
