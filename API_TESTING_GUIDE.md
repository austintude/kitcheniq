# KitchenIQ API Testing & Diagnostics Guide

## Quick Diagnostics - Check Everything at Once

### Run the Diagnostic Endpoint

**URL:**
```
GET https://plugins.austintude.com/wp-json/kitcheniq/v1/diagnostic
```

**Requirements:**
- You must be **logged in as an admin**
- Get a valid nonce if needed (included in dashboard)

**Response Example (Success):**
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

---

## Testing Each Endpoint Individually

### 1. **Test Profile (Setup)**

**Purpose:** Verify you can save/retrieve user preferences

**POST endpoint:**
```
POST /wp-json/kitcheniq/v1/profile
```

**Required headers:**
```
X-WP-Nonce: <nonce>
Content-Type: application/json
```

**Body:**
```json
{
  "household_size": 2,
  "dietary_restrictions": ["vegetarian"],
  "cooking_skill": "intermediate",
  "budget_level": "moderate",
  "time_per_meal": "moderate",
  "dislikes": ["mushrooms", "olives"],
  "appliances": ["oven", "microwave", "stovetop"]
}
```

**Expected response (200):**
```json
{
  "success": true,
  "profile": {
    "household_size": 2,
    "dietary_restrictions": ["vegetarian"],
    ...
  }
}
```

---

### 2. **Test Meals Generation**

**Purpose:** Verify meal generation works and model is correct

**POST endpoint:**
```
POST /wp-json/kitcheniq/v1/meals
```

**Required headers:**
```
X-WP-Nonce: <nonce>
Content-Type: application/json
```

**Body:**
```json
{
  "plan_type": "balanced",
  "mood": "comfort food"
}
```

**Expected response (200):**
```json
{
  "success": true,
  "record_id": 12345,
  "meal_plan": {
    "meals": [
      {
        "meal_name": "Vegetarian Pasta",
        "meal_type": "dinner",
        "cooking_time_mins": 25,
        "difficulty": "easy",
        "ingredients_used": [...],
        "instructions": "...",
        ...
      }
    ],
    "shopping_list": {...}
  },
  "remaining": 4
}
```

**If you see a 500 error:**
1. Check the diagnostic endpoint first
2. Look at server error logs (see below)
3. Verify API key is set and valid
4. Check that the model name is supported (gpt-4o-mini or gpt-4o)

---

### 3. **Test Image Scan (Pantry)**

**Purpose:** Verify vision API works and data-URI handling is correct

**POST endpoint:**
```
POST /wp-json/kitcheniq/v1/inventory-scan
```

**Required headers:**
```
X-WP-Nonce: <nonce>
Content-Type: application/json
```

**Body (with data-URI):**
```json
{
  "image_url": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQE..."
}
```

**Expected response (200):**
```json
{
  "success": true,
  "items_added": 3,
  "new_items": [
    {
      "id": 537291,
      "name": "Milk",
      "category": "dairy",
      "quantity_estimate": "half",
      "likely_perishable": true,
      "estimated_days_good": 7
    }
  ],
  "inventory": [...],
  "remaining": 2
}
```

**Common issues:**
- **400 error**: Missing or invalid `image_url` parameter
- **500 error**: OpenAI vision API failed (check diagnostics)
- **403 error**: User doesn't have vision scanning feature

---

## Testing with Browser DevTools

### Step-by-step in Chrome/Firefox:

1. **Open the dashboard page** with `[kitchen_iq_dashboard]` shortcode
2. **Press F12** to open DevTools
3. **Go to Network tab**
4. **Click "Collect logs"** (optional but helpful)
5. **Perform an action** (generate meals, scan image, etc.)
6. **Find the request** to `/kitcheniq/v1/...`
7. **Click the request** and inspect:

**Request Details:**
- Method: POST
- URL: Full path including query params
- Headers: Check `Authorization`, `Content-Type`
- Body: Raw JSON sent

**Response Details:**
- Status code (200 = OK, 4xx = client error, 5xx = server error)
- Headers: Response headers
- Preview: Formatted JSON (if response is JSON)
- Response: Full text of response

**Example of a working POST:**
```
POST https://plugins.austintude.com/wp-json/kitcheniq/v1/meals
Status: 200 OK

Request body:
{
  "plan_type": "balanced",
  "mood": null
}

Response:
{
  "success": true,
  "meal_plan": { ... }
}
```

---

## Checking Server Logs

### Where to find logs:

**WordPress debug log:**
```
wp-content/debug.log
```

**Check via SSH:**
```bash
tail -f wp-content/debug.log
```

**Or via admin panel:**
- Go to: Settings → General
- Look for "Debug Log" path
- Or enable it: Add to `wp-config.php`:
```php
define( 'WP_DEBUG', true );
define( 'WP_DEBUG_LOG', true );
define( 'WP_DEBUG_DISPLAY', false );
```

### What to look for in logs:

**Success indicators:**
```
[2025-12-05 10:30:15] KitchenIQ: Sending request to OpenAI with model: gpt-4o-mini
[2025-12-05 10:30:17] KitchenIQ: OpenAI HTTP status: 200
```

**Error indicators:**
```
[2025-12-05 10:30:16] KitchenIQ OpenAI API error (invalid_api_key): Incorrect API key provided
[2025-12-05 10:30:17] KitchenIQ: Unexpected HTTP status 401 from OpenAI
[2025-12-05 10:30:18] KitchenIQ OpenAI connection error: cURL error 7: Failed to connect
```

---

## Common Issues & Fixes

### Issue: 500 Error on `/meals`

**Possible causes:**

1. **Missing API key**
   - Check: `GET /wp-json/kitcheniq/v1/diagnostic`
   - Fix: Set `KIQ_API_KEY` env var or add via WordPress admin

2. **Invalid API key**
   - Check: Key should start with `sk-`
   - Fix: Verify key is correct (no extra spaces, typos)

3. **Model not supported**
   - Check: Admin panel → KitchenIQ → AI Settings
   - Fix: Change model to `gpt-4o-mini` (default) or `gpt-4o`
   - Note: Some custom models may not be available

4. **OpenAI rate limit**
   - Check: Server logs for "rate limit exceeded"
   - Fix: Wait a minute and retry

5. **Invalid request format**
   - Check: Browser Network tab → Request body
   - Fix: Ensure `plan_type` is one of: balanced, quick, healthy, budget

### Issue: 400 Error on `/inventory-scan`

**Causes:**
- Missing `image_url` parameter
- Invalid data-URI format (should be `data:image/png;base64,...`)
- Invalid remote URL

**Fix:**
- Ensure image is PNG or JPEG
- Data-URI should match: `^data:image/(png|jpeg|jpg);base64,`

---

## Verifying the Model is Correct

### Check current model:

**In browser console:**
```javascript
await fetch('/wp-json/kitcheniq/v1/diagnostic', {
  headers: { 'X-WP-Nonce': kitcheniqData.nonce }
})
.then(r => r.json())
.then(d => console.log('Model:', d.ai_settings.text_model))
```

**Or via cURL:**
```bash
curl -H "Authorization: Bearer $(wp eval 'echo get_option("kiq_api_key_setting");')" \
  https://plugins.austintude.com/wp-json/kitcheniq/v1/diagnostic
```

### What models are available:

- `gpt-4o` - Advanced, most capable, ~$0.003 per 1K input tokens
- `gpt-4o-mini` - Recommended, fast & cheap, ~$0.00015 per 1K input tokens
- `gpt-4-turbo` - Legacy, older model
- `gpt-3.5-turbo` - Legacy, older model

**Current default:** `gpt-4o-mini` ✅

---

## API Key Setup Reference

### Method 1: Environment Variable (Production)

**Most secure.** Set on your hosting provider:

```
KIQ_API_KEY=sk-proj-xxxxx...
```

### Method 2: WordPress Option (Testing)

Go to: **WordPress Admin → KitchenIQ → API Key**

Enter your OpenAI API key (stored encrypted).

### Method 3: WordPress Config

Add to `wp-config.php`:
```php
define( 'KIQ_API_KEY', 'sk-proj-xxxxx...' );
```

**Priority order:**
1. Environment variable (highest)
2. WordPress option
3. Hard-coded define()
4. Empty (falls back to empty, triggers errors)

---

## Real-World Testing Workflow

### Complete end-to-end test:

1. **Start with diagnostics**
   ```
   GET /wp-json/kitcheniq/v1/diagnostic
   ```
   - Verify `openai_test.status` is "success"

2. **Save a profile**
   ```
   POST /wp-json/kitcheniq/v1/profile
   ```
   - Should return `success: true`

3. **Generate meals (no scan)**
   ```
   POST /wp-json/kitcheniq/v1/meals
   ```
   - Should return `meal_plan` with 3 meals

4. **Generate meals with mood**
   ```
   POST /wp-json/kitcheniq/v1/meals
   { "plan_type": "quick", "mood": "Asian-inspired" }
   ```
   - Should return different meals

5. **Try a scan (optional)**
   ```
   POST /wp-json/kitcheniq/v1/inventory-scan
   { "image_url": "data:image/jpeg;base64,..." }
   ```
   - If using actual image, should return items

---

## API Response Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | Meals generated, profile saved |
| 400 | Bad request | Missing parameter, invalid format |
| 401 | Unauthorized | Not logged in |
| 403 | Forbidden | Feature not available on your plan |
| 429 | Rate limit | Weekly/monthly limit reached |
| 500 | Server error | OpenAI error, exception in code |

---

## Debugging Tips

### Enable verbose logging:

**In `wp-config.php`:**
```php
define( 'WP_DEBUG', true );
define( 'WP_DEBUG_LOG', true );
define( 'WP_DEBUG_DISPLAY', false );
```

Then check `wp-content/debug.log` for detailed messages.

### Test the OpenAI API directly:

```bash
curl https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4o-mini",
    "messages": [{"role": "user", "content": "Say OK"}],
    "max_tokens": 10
  }'
```

### Check WordPress options:

**Via WP-CLI:**
```bash
wp option get kiq_ai_text_model
wp option get kiq_api_key_setting
```

**Or in PHP:**
```php
error_log( 'Text model: ' . get_option( 'kiq_ai_text_model' ) );
error_log( 'Vision model: ' . get_option( 'kiq_ai_vision_model' ) );
```
