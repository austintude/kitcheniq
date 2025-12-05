# How to Test OpenAI Connection & Verify Model Settings

**Your Question:** How do we test the API is actually connecting to OpenAI correctly and that the version model listed in the admin settings is actually input correctly and working?

**Answer:** Use the new diagnostic endpoint (takes 30 seconds).

---

## Method 1: Quick Browser URL (Easiest)

### Step 1: Log in as WordPress admin

### Step 2: Copy this URL into your browser:
```
https://plugins.austintude.com/wp-json/kitcheniq/v1/diagnostic
```

### Step 3: You'll see JSON. Look at:

```json
{
  "ai_settings": {
    "text_model": "???"
  },
  "openai_test": {
    "status": "???",
    "message": "???"
  }
}
```

### Interpretation:

| Field | Shows | Meaning |
|-------|-------|---------|
| `text_model` | `gpt-4o-mini` | ✅ Correct model |
| `text_model` | `gpt-4o` | ✅ Advanced model (OK) |
| `text_model` | Anything else | ❌ Wrong model |
| `openai_test.status` | `success` | ✅ Connected to OpenAI |
| `openai_test.status` | `error` | ❌ Connection failed |

---

## Method 2: JavaScript Console (Programmatic)

### Open browser DevTools (F12)

### Go to Console tab

### Paste this:
```javascript
fetch('/wp-json/kitcheniq/v1/diagnostic', {
  headers: { 'X-WP-Nonce': kitcheniqData.nonce }
})
.then(r => r.json())
.then(d => {
  console.log('📊 DIAGNOSTICS:');
  console.log('Model:', d.ai_settings.text_model, d.ai_settings.text_model === 'gpt-4o-mini' ? '✅' : '⚠️');
  console.log('OpenAI Connected:', d.openai_test.status, d.openai_test.status === 'success' ? '✅' : '❌');
  console.log('Full:', d);
})
```

### Result:
```
📊 DIAGNOSTICS:
Model: gpt-4o-mini ✅
OpenAI Connected: success ✅
Full: {...}
```

---

## What Each Field Tests

### ✅ Test 1: Model is Applied Correctly

**Field:** `ai_settings.text_model`

**What it means:**
- Shows which OpenAI model the plugin is actually using
- Even if you set a model in admin, this verifies it was saved

**Expected value:** `gpt-4o-mini` (recommended) or `gpt-4o`

**If wrong:**
1. Go to WordPress Admin
2. KitchenIQ → AI Settings
3. Change "Text Model" to `gpt-4o-mini`
4. Click Save
5. Re-run diagnostic to confirm

### ✅ Test 2: Can Actually Connect to OpenAI

**Field:** `openai_test.status`

**What it means:**
- Tests that a real request can be sent to and received from OpenAI
- Confirms API key is valid
- Confirms network connectivity

**Expected value:** `"success"`

**If `error`:**
- Check `openai_test.message` for details
- Common errors:
  - `"Incorrect API key provided"` = Wrong key
  - `"You exceeded your current quota"` = Out of OpenAI credits
  - `"Connection failed"` = Network/firewall issue

### ✅ Test 3: API Key Source

**Field:** `plugin.api_key_source`

**What it means:**
- Shows where the plugin is getting the API key from
- Environment variables take priority over WordPress option

**Expected value:** `"environment"` or `"wordpress_option"` or `"not_set"`

**What to do:**
- `"environment"` = Great! Key is in server environment
- `"wordpress_option"` = Good, key is in WordPress admin
- `"not_set"` = ❌ No key found! Add one

---

## Full Diagnostic Response Reference

### Response When Everything is Working:

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

**Checklist:**
- ✅ `text_model` = `gpt-4o-mini`
- ✅ `openai_test.status` = `success`
- ✅ `api_key_source` = `environment` or `wordpress_option`
- ✅ `openai_test.response` contains `"OK"`

### Response When Something is Wrong:

```json
{
  "plugin": {
    "api_key_source": "not_set"
  },
  "openai_test": {
    "status": "error",
    "message": "API key not configured",
    "api_key_source": "none"
  }
}
```

**Problem:** No API key set anywhere

**Fix:**
1. WordPress Admin → KitchenIQ → API Key
2. Enter your OpenAI key (starts with `sk-`)
3. Click Save
4. Re-run diagnostic

---

## Step-by-Step Troubleshooting

### Scenario 1: Model Shows Wrong Value

```
"text_model": "gpt-5"
```

**Problem:** You set model to unsupported value  
**Fix:**
1. Admin → KitchenIQ → AI Settings
2. Change Text Model to: `gpt-4o-mini`
3. Click Save
4. Re-run diagnostic to confirm

### Scenario 2: OpenAI Connection Shows Error

```
"openai_test": {
  "status": "error",
  "message": "Incorrect API key provided"
}
```

**Problem:** API key is invalid  
**Fix:**
1. Go to OpenAI platform: https://platform.openai.com/api-keys
2. Create a new key or copy existing one
3. Admin → KitchenIQ → API Key
4. Paste the key (no extra spaces)
5. Click Save
6. Re-run diagnostic

### Scenario 3: Model is Correct but Meals Still Error

```
"text_model": "gpt-4o-mini",
"openai_test": {
  "status": "success"
}
```

**But still getting 500 error on /meals**

**Problem:** Different issue, not the API  
**Fix:**
1. Check server logs: `/wp-content/debug.log`
2. Look for "KitchenIQ" errors
3. Or: Check profile was saved (required first)
4. Or: Check rate limit (weekly limit reached?)

---

## Verification Checklist

### Before you go live, verify:

- [ ] Visit diagnostic endpoint
- [ ] See JSON response
- [ ] `text_model` = `gpt-4o-mini` ✅
- [ ] `openai_test.status` = `success` ✅
- [ ] `api_key_source` = `environment` or `wordpress_option` ✅
- [ ] Try generating meals (should work)
- [ ] Check server logs (no errors)

All green? **Ready to launch!** 🚀

---

## Testing Meal Generation After Confirming Connection

Once diagnostic shows success, test meals:

### Test 1: Generate Meals (Simplest)
```
POST /wp-json/kitcheniq/v1/meals
Body: { "plan_type": "balanced" }
Expected: Status 200, meals in response
```

### Test 2: Generate with Mood
```
POST /wp-json/kitcheniq/v1/meals
Body: { "plan_type": "quick", "mood": "Asian-inspired" }
Expected: Status 200, different meals
```

### Test 3: Via Dashboard UI
1. Go to page with `[kitchen_iq_dashboard]`
2. Complete profile setup
3. Go to Meals tab
4. Click Generate Meals
5. Should see 3 meals in seconds

If meals don't appear:
- Check browser Network tab for errors
- Check server logs for exceptions
- Run diagnostic to re-verify

---

## Pro Tips

### Tip 1: Quick Health Check Every Time
Keep this bookmarked (as admin):
```
https://plugins.austintude.com/wp-json/kitcheniq/v1/diagnostic
```

Can run anytime to verify API is working.

### Tip 2: Monitor Server Logs
```
tail -f wp-content/debug.log | grep KitchenIQ
```

Watch for errors in real-time as you test.

### Tip 3: Use Browser Console
```javascript
// Paste this in console to auto-format diagnostic output
fetch('/wp-json/kitcheniq/v1/diagnostic', {
  headers: { 'X-WP-Nonce': kitcheniqData.nonce }
}).then(r => r.json()).then(d => console.table({
  'Model': d.ai_settings.text_model,
  'API Key': d.plugin.api_key_source,
  'OpenAI': d.openai_test.status,
  'PHP': d.wordpress.php_version
}))
```

---

## Answers to Your Original Questions

**Q: How do we test the API is actually connecting to OpenAI correctly?**

A: Call the diagnostic endpoint:
```
GET /wp-json/kitcheniq/v1/diagnostic
```

Check `openai_test.status` — if "success", it's connected. The endpoint makes a real test request to OpenAI's API.

---

**Q: That the version model listed in the admin settings is actually input correctly?**

A: Same endpoint. Check:
```
ai_settings.text_model
```

It shows exactly which model is configured. Should match what you see in WordPress Admin → KitchenIQ → AI Settings.

---

**Q: And working?**

A: Both are verified:
1. Model is correct: `ai_settings.text_model` shows it
2. It's working: `openai_test` shows successful test request

If both show success values, the API is connected and configured correctly.

---

## One-Command Everything Check

**In browser console:**
```javascript
fetch('/wp-json/kitcheniq/v1/diagnostic', {
  headers: { 'X-WP-Nonce': kitcheniqData.nonce }
})
.then(r => r.json())
.then(d => {
  const checks = {
    '✅ Model': d.ai_settings.text_model === 'gpt-4o-mini',
    '✅ Connected': d.openai_test.status === 'success',
    '✅ API Key': d.plugin.api_key_source !== 'not_set'
  };
  console.log(checks);
  return Object.entries(checks).every(([k,v]) => v) ? '🎉 ALL GOOD!' : '⚠️ Issues detected';
})
.then(console.log)
```

**Output:**
```
{ '✅ Model': true, '✅ Connected': true, '✅ API Key': true }
🎉 ALL GOOD!
```

---

## That's It!

You now have complete visibility into:
- ✅ Is the API key configured?
- ✅ Which model is being used?
- ✅ Can it connect to OpenAI?
- ✅ Is the model working correctly?

Test anytime by visiting the diagnostic endpoint as an admin.
