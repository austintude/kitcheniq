# KitchenIQ Setup Guide

## Quick Start (5 minutes)

### 1. Prerequisites
- WordPress 6.0+ installed on SiteGround or similar hosting
- PHP 7.4+
- MySQL 5.7+
- OpenAI API account with active API key

### 2. Install the Plugin

```bash
# Via SFTP / File Manager:
1. Download kitchen-iq folder
2. Upload to /wp-content/plugins/
3. Log in to WordPress admin
4. Plugins → Installed Plugins
5. Find "KitchenIQ" and click "Activate"
```

### 3. Configure API Keys

**Option A: Via Environment Variables (Recommended)**

Add to your WordPress hosting environment:
```bash
KIQ_API_KEY=sk-your-openai-api-key-here
AIRTABLE_API_KEY=key-... (optional)
AIRTABLE_BASE_ID=app-... (optional)
```

For **SiteGround**, set environment variables via cPanel:
1. Log in to SiteGround cPanel
2. Go to System Environment Variables (or Environment Manager)
3. Add `KIQ_API_KEY` with your OpenAI API key value
4. Add `AIRTABLE_API_KEY` and `AIRTABLE_BASE_ID` if using analytics

**Option B: Via wp-config.php**

Edit `/wp-content/plugins/kitchen-iq/kitchen-iq.php` and set constants:
```php
define( 'KIQ_API_KEY', 'sk-...' );
```

### 4. Set Up WordPress Page

1. WordPress Admin → Pages → Add New
2. Title: "Kitchen IQ" (or your preference)
3. Add shortcode: `[kitchen_iq_dashboard]`
4. Publish
5. Share URL with users

### 5. Configure Settings (Optional)

WordPress Admin → KitchenIQ → General Settings

Common configurations:
- **AI Settings:** Keep defaults (gpt-4o-mini, temp 0.3)
- **Prompts:** Advanced users only - all defaults are optimized
- **Perishability:** Adjust if your defaults differ

### 6. Test the Plugin

1. Log in as a WordPress user
2. Navigate to your KitchenIQ page
3. Complete onboarding form
4. Try scanning a pantry photo
5. Generate a meal plan

## Troubleshooting

### "API Key Not Configured"
- Check that `KIQ_API_KEY` environment variable is set
- Go to WordPress Admin → KitchenIQ → Debug
- Verify "API Key Configured" shows ✓

### Vision Scanning Returns Empty Items
- Check image lighting and visibility
- Try with a clearer photo
- Ensure items are in focus and visible
- Pro tip: Take photos section-by-section of your pantry

### Meal Generation is Slow
- First request takes 5-10 seconds (normal)
- Subsequent requests should be 2-5 seconds
- If slower, check your internet connection
- Consider upgrading to Pro plan for priority (future feature)

### "Database Tables Not Created"
- Deactivate plugin: WordPress Admin → Plugins
- Reactivate plugin
- This re-runs the activator and creates tables
- Go to Debug tab to verify tables exist

### Users Keep Seeing Onboarding
- Clear browser cache/cookies
- Profile data should be in usermeta as JSON
- Check database: `wp_usermeta` for `kiq_profile` entry
- If missing, user needs to complete onboarding

## Cost Optimization

### Reduce AI Spending
1. Lower `kiq_ai_max_tokens` (default 1500 is good)
2. Increase `kiq_ai_temperature` slightly (makes responses less creative)
3. Use gpt-4o-mini (not gpt-4 - same quality, 1/10th cost)

### Monitor Usage
- Go to WordPress Admin → KitchenIQ → Debug
- Check "Database Stats" for meal/rating counts
- Each meal = ~$0.0005-0.001 cost

### Free Tier Cost-Benefit
- 1 meal/week per free user = minimal API spend
- 1 vision scan/month = even less
- Free users are low-cost acquisition funnel

## Advanced: Custom Prompts

Edit meal generation behavior via:
WordPress Admin → KitchenIQ → Prompts

Key sections:
- **System Base:** How the AI should think
- **Rules Block:** Hard constraints
- **Ratings Block:** How to weight user preferences
- **Substitutions Block:** How to suggest alternatives
- **Perishability Block:** How to handle expiring items

Pro tip: Test changes with debug users before pushing to production.

## Analytics with Airtable (Optional)

### Setup Airtable
1. Create Airtable workspace
2. Create base for KitchenIQ data
3. Create tables:
   - `meal_history` - With fields: WPRecordID, WPUserID, PlanType, CreatedAt, MealCount, etc.
   - `ai_logs` - For API cost tracking

4. Get API key: https://airtable.com/account → API Key
5. Get Base ID: https://airtable.com/account → Bases (looks like `app123...`)

### Configure in WordPress
1. WordPress Admin → KitchenIQ → AI Settings
2. Set `AIRTABLE_API_KEY` and `AIRTABLE_BASE_ID` environment variables
3. Enable logging in WordPress Admin → KitchenIQ → AI Settings
4. Check box: "Enable AI Request Logging"

## Production Checklist

- [ ] OpenAI API key configured
- [ ] Database tables created (check Debug tab)
- [ ] WordPress page created with shortcode
- [ ] Test user created and onboarding completed
- [ ] First meal generation works
- [ ] Vision scanning tested with 2+ images
- [ ] Meal ratings working
- [ ] Usage stats displaying correctly
- [ ] Admin panel accessible
- [ ] Settings saved successfully

## Support

**Common Issues:**
- https://github.com/kitcheniq/wp-plugin/issues

**Documentation:**
- README.md - Full plugin documentation
- Admin Panel Debug tab - System info and diagnostics

**Debugging:**
- Check PHP error log (contact hosting provider)
- WordPress Admin → KitchenIQ → Debug → System Information
- Look for nonce errors in browser console (F12)

---

**Questions?** Email: support@kitcheniq.ai
