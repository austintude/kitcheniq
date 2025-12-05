# 🎯 How to Test API & Model Settings - Quick Start

## TL;DR - Get Answer in 2 Minutes

### Copy this URL into your browser (as an admin)
```
https://plugins.austintude.com/wp-json/kitcheniq/v1/diagnostic
```

### You'll see JSON. Look for:

```
"openai_test": {
  "status": "???"
}
```

| Status | Meaning | What to do |
|--------|---------|-----------|
| **success** | ✅ API connected and working | Try generating meals! |
| **error** | ❌ Connection failed | Read the message below it |

---

## If You See "error"

### Check the message field:

```
"message": "API key not configured"
→ Fix: WordPress Admin → KitchenIQ → API Key → Enter key → Save

"message": "Incorrect API key provided"  
→ Fix: Check key, make sure no extra spaces, try again

"message": "Connection failed: cURL error 7"
→ Fix: Server firewall issue, contact hosting provider

"message": "Model not found: gpt-5"
→ Fix: Go to AI Settings, change model to gpt-4o-mini
```

---

## Verify the Model is Correct

### Same diagnostic response, look for:

```json
"ai_settings": {
  "text_model": "gpt-4o-mini"  ← Should be this
}
```

If it's different:
1. Go to WordPress Admin
2. Navigate to: KitchenIQ → AI Settings
3. Change "Text Model" back to `gpt-4o-mini`
4. Click Save
5. Re-run diagnostic - should now show correct model

---

## One-Line Test: "Can you actually call OpenAI?"

**In browser console on the dashboard page:**
```javascript
fetch('/wp-json/kitcheniq/v1/diagnostic', {
  headers: { 'X-WP-Nonce': kitcheniqData.nonce }
})
.then(r => r.json())
.then(d => d.openai_test.status === 'success' ? '✅ Connected!' : '❌ Error: ' + d.openai_test.message)
.then(console.log)
```

**You'll see either:**
- `✅ Connected!` — Everything is working
- `❌ Error: [message]` — See what's wrong

---

## Full Testing Checklist

### ✅ Before your first meal generation:

- [ ] Log in as WordPress admin
- [ ] Go to WordPress Admin → KitchenIQ → API Key
- [ ] Enter your OpenAI API key (starts with `sk-`)
- [ ] Click "Save Settings"
- [ ] Go to AI Settings section
- [ ] Verify model is `gpt-4o-mini` (or `gpt-4o`)
- [ ] Click "Save Settings"
- [ ] Visit `/wp-json/kitcheniq/v1/diagnostic`
- [ ] Check that `openai_test.status` is `"success"`

### ✅ Test the actual meal generation:

- [ ] Go to dashboard page with `[kitchen_iq_dashboard]` shortcode
- [ ] Complete setup (profile info)
- [ ] Skip pantry scan (or scan an image)
- [ ] Go to "Meals" tab
- [ ] Click "Generate Meals"
- [ ] Should see 3 meal suggestions in a few seconds

If you don't see meals:
1. Open browser DevTools (F12)
2. Go to Network tab
3. Click "Generate Meals" again
4. Find the request to `/kitcheniq/v1/meals`
5. Check the Response tab
6. Copy the error and check the Quick Debug guide

---

## Troubleshooting Table

| Problem | First Check | Fix |
|---------|------------|-----|
| Diagnostic shows error | Read the error message in JSON | Apply specific fix above |
| Meals endpoint 500 error | Run diagnostic, check openai_test | Fix whatever diagnostic reports |
| Model setting not saving | Check AI Settings page | Clear cache, try again, contact support |
| Model wrong in diagnostic | Check if environment var conflicts | Environment var takes priority, change it |
| API key preview wrong | Check WordPress option & env var | Verify which source is being used |

---

## Understanding the API Key Priority

KitchenIQ checks for API key in this order:

1. **Environment variable** `KIQ_API_KEY` (if you set this, it always wins)
2. **WordPress option** `kiq_api_key_setting` (set via admin panel)
3. **Nothing** (empty, plugin won't work)

**Check which source you're using:**
- Look at diagnostic response
- `"api_key_source": "environment"` = Using env var
- `"api_key_source": "wordpress_option"` = Using admin panel setting
- `"api_key_source": "not_set"` = No key anywhere!

---

## Testing Without Using Images

**You CAN test without any images:**

1. Complete profile setup
2. Skip pantry scan
3. Go straight to "Meals" tab
4. Click "Generate Meals"
5. AI will generate meals based on your preferences alone

No image needed for testing! The image scan is totally optional.

---

## What the Model Setting Actually Does

The model setting in AI Settings controls which OpenAI model processes your requests:

| Model | Cost | Speed | Quality | Use When |
|-------|------|-------|---------|----------|
| `gpt-4o-mini` | Cheapest | Fastest | Great | Testing, production (recommended) |
| `gpt-4o` | More | Slower | Best | You need maximum quality |

**Recommended:** Leave as `gpt-4o-mini` — it's fast, cheap, and produces excellent meal plans.

---

## Quick Network Debugging

### See exactly what's being sent to OpenAI:

1. Press F12 (open DevTools)
2. Go to Network tab
3. Click "Generate Meals"
4. Find request to `/kitcheniq/v1/meals`
5. Click it, go to Response tab
6. If there's an error, you'll see it here

**Look for:**
- Status 200 = Success ✅
- Status 400-499 = Your fault (bad input)
- Status 500 = Server fault (see error message)

---

## Is the Plugin Even Loading?

### Check that KitchenIQ is activated:

1. WordPress Admin → Plugins
2. Look for "KitchenIQ"
3. Should show as "Active"

If not active:
- Click "Activate"
- Refresh page

---

## Questions About Your Setup?

Use this checklist to answer:

- **Is my API key being used?**
  → Check diagnostic response: `api_key_source` field

- **Is my model setting being applied?**
  → Check diagnostic response: `ai_settings.text_model` field

- **Is the API actually working?**
  → Check diagnostic response: `openai_test.status` field

- **What happens when I generate meals?**
  → Check browser Network tab: `/kitcheniq/v1/meals` response

---

## Still Having Issues?

### Collect this info for support:

1. Output of `/wp-json/kitcheniq/v1/diagnostic` (copy the full JSON)
2. Last 10 lines of `/wp-content/debug.log`
3. Model name from WordPress Admin → KitchenIQ → AI Settings
4. Screenshot of browser Network tab showing `/meals` request/response

Share this and the issue can be diagnosed in seconds!

---

## One Final Test Command

**Paste into browser console on dashboard:**

```javascript
Promise.all([
  fetch('/wp-json/kitcheniq/v1/diagnostic', {
    headers: { 'X-WP-Nonce': kitcheniqData.nonce }
  }).then(r => r.json()),
  fetch(kitcheniqData.restRoot + 'kitcheniq/v1/profile', {
    headers: { 'X-WP-Nonce': kitcheniqData.nonce }
  }).then(r => r.json())
]).then(([diag, profile]) => {
  console.log('🔧 Diagnostics:', diag);
  console.log('👤 Profile loaded:', !!profile.profile);
  console.log('🔑 API Key source:', diag.plugin.api_key_source);
  console.log('🤖 Model:', diag.ai_settings.text_model);
  console.log('✅ OpenAI connected:', diag.openai_test.status);
})
```

**This will output everything in one place. If it all shows green (success, environment/wordpress_option, gpt-4o-mini, success) — you're ready to go!**
