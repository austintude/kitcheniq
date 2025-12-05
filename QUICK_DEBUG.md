# 🔧 KitchenIQ Quick Debug Checklist

## 🚨 Got a 500 error on /meals? Try this NOW:

### Step 1: Check if API is connected (30 seconds)
```
Visit: https://plugins.austintude.com/wp-json/kitcheniq/v1/diagnostic

Look for:
  ✅ "status": "success" in openai_test
  ✅ "api_key_source": "environment" or "wordpress_option"
  ✅ "text_model": "gpt-4o-mini" (or gpt-4o)

If anything shows "error":
  → Go to Step 2
```

---

### Step 2: Verify API Key is set
**WordPress Admin → KitchenIQ → API Key**

- [ ] API key field is NOT empty
- [ ] Key starts with `sk-`
- [ ] Key has no extra spaces
- [ ] Click "Save Settings"

If still shows "error":
  → Check /wp-content/debug.log (see Step 3)

---

### Step 3: Check server logs
**Access via SSH or file manager:**

```
/wp-content/debug.log
```

**Look for lines with "KitchenIQ"**

```
Find: KitchenIQ OpenAI API error
Means: API rejected the key or request

Find: Unexpected HTTP status 401
Means: API key is invalid

Find: Connection failed
Means: Server can't reach OpenAI (firewall/network issue)

Find: Unexpected response format
Means: OpenAI returned something unexpected
```

---

### Step 4: Test the model is correct

**In browser console (on dashboard page):**
```javascript
fetch('/wp-json/kitcheniq/v1/diagnostic', {
  headers: { 'X-WP-Nonce': kitcheniqData.nonce }
})
.then(r => r.json())
.then(d => console.log(d.ai_settings))
```

**Should show:**
```
{
  text_model: "gpt-4o-mini",  ← This one
  vision_model: "gpt-4o-mini",
  temperature: 0.3,
  max_tokens: 1500,
  logging_enabled: false
}
```

If different:
  → Go to WordPress Admin → KitchenIQ → AI Settings
  → Change back to `gpt-4o-mini`
  → Save

---

## 📋 Quick Response Code Reference

| Code | Issue | Fix |
|------|-------|-----|
| 200 | ✅ Working | Continue! |
| 400 | Bad input | Check API docs for required fields |
| 401/403 | Auth issue | Log in as admin |
| 429 | Rate limited | Wait 1 minute, retry |
| 500 | Server error | Follow Step 1-3 above |

---

## 🧪 One-Minute Test (No Image)

**In browser Network tab, send:**

```
POST /wp-json/kitcheniq/v1/meals

Body:
{
  "plan_type": "balanced"
}

Expected:
Status 200
{
  "success": true,
  "meal_plan": { "meals": [...] }
}
```

If Status ≠ 200:
  → Read the error message in Response tab
  → Follow fix above

---

## 🔑 Is the API Key actually being used?

**WordPress Admin → KitchenIQ → System Status**

Look for:
```
✓ OpenAI API Key:      Yes
  Source: Environment Variable (KIQ_API_KEY)
  OR
  Source: WordPress Option (Admin Panel)
```

If shows "✗ No":
  → Set your key in WordPress Admin → KitchenIQ → API Key
  → Or add `KIQ_API_KEY=sk-...` to your server environment

---

## 💡 Pro Tips

1. **Always start with `/diagnostic` endpoint** — it tests everything
2. **Check server logs first** — errors are logged there
3. **Use Browser Network tab** — see exactly what's being sent/received
4. **Model name matters** — only `gpt-4o-mini` and `gpt-4o` are supported
5. **API key format** — must start with `sk-` and be 20+ chars

---

## 🆘 Still stuck?

**Collect this info and share:**

1. Diagnostic endpoint response (copy full JSON)
2. Last 20 lines of /wp-content/debug.log
3. Browser Network tab screenshot of failing request
4. Screenshot of WordPress Admin → KitchenIQ → API Key page
5. Model name shown in AI Settings

Send to: [@debug-request](link-to-github-issues)
