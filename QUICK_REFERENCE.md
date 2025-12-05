# KitchenIQ Quick Reference

## 🚀 Quick Start (30 seconds)
1. Copy `kitchen-iq` folder to `/wp-content/plugins/`
2. Activate in WordPress Admin
3. Set `KIQ_API_KEY` environment variable
4. Add page with shortcode: `[kitchen_iq_dashboard]`
5. Done!

## 📁 File Structure
```
kitchen-iq/
├── kitchen-iq.php              Main plugin bootstrap
├── includes/
│   ├── class-kiq-data.php      Database operations
│   ├── class-kiq-ai.php        OpenAI integration
│   ├── class-kiq-rest.php      API endpoints
│   ├── class-kiq-features.php  Tier logic
│   ├── class-kiq-admin.php     Settings panel
│   ├── class-kiq-activator.php DB setup
│   └── class-kiq-airtable.php  Analytics
├── assets/
│   ├── js/kiq-dashboard.js     Frontend app
│   └── css/kiq-dashboard.css   Styles
├── templates/
│   └── dashboard.php           HTML template
└── README.md                   Full docs
```

## 🔑 Environment Variables
```bash
KIQ_API_KEY=sk-...              # OpenAI (required)
AIRTABLE_API_KEY=key-...        # Analytics (optional)
AIRTABLE_BASE_ID=app-...        # Analytics (optional)
```

## 💾 Database Tables
| Table | Purpose |
|-------|---------|
| `wp_kiq_meal_history` | Generated meal plans |
| `wp_kiq_meal_ratings` | User meal preferences |
| `wp_kiq_usage` | Weekly usage tracking |
| `wp_usermeta` (kiq_*) | User profiles & inventory |

## 🎯 Key Classes

### KIQ_Data
- `get_profile()` / `save_profile()`
- `get_inventory()` / `save_inventory()`
- `save_meal_history()`
- `save_meal_rating()`
- `get_week_usage()` / `increment_meal_count()`
- `refresh_inventory_status()`

### KIQ_AI
- `generate_meal_plan($user_id, $profile, $inventory, $plan_type, $mood)`
- `extract_pantry_from_image($user_id, $image_url)`

### KIQ_Features
- `allows($user_id, $feature)` - Check tier
- `can_generate_meal($user_id)` - Rate limit check
- `can_scan_pantry($user_id)` - Scan limit check
- `get_remaining_usage($user_id)` - Stats

### KIQ_REST
All routes at `/wp-json/kitcheniq/v1/`
- `GET/POST /profile`
- `GET/POST /inventory`
- `POST /meals`
- `POST /rate-meal`
- `POST /inventory-scan`
- `GET /usage`

## 👥 Pricing Tiers
| Free | Basic | Pro |
|------|-------|-----|
| 1 meal/week | 5 meals/week | Unlimited |
| 1 vision/month | 4 vision/week | Unlimited |
| - | Ratings, Subs, Expiry | All features |

## 🔌 REST API Examples

### Generate Meals
```bash
curl -X POST https://yoursite.com/wp-json/kitcheniq/v1/meals \
  -H "X-WP-Nonce: $NONCE" \
  -H "Content-Type: application/json" \
  -d '{"plan_type":"balanced","mood":"comfort"}'
```

### Scan Pantry
```bash
curl -X POST https://yoursite.com/wp-json/kitcheniq/v1/inventory-scan \
  -H "X-WP-Nonce: $NONCE" \
  -H "Content-Type: application/json" \
  -d '{"image_url":"data:image/jpeg;base64,..."}'
```

### Get Profile
```bash
curl -X GET https://yoursite.com/wp-json/kitcheniq/v1/profile \
  -H "X-WP-Nonce: $NONCE"
```

## 🛠️ Common Tasks

### Change Default Plan Type
WordPress Admin → KitchenIQ → General Settings → Default Meal Plan Type

### Adjust AI Behavior
WordPress Admin → KitchenIQ → Prompts (edit any block)

### Check Database Status
WordPress Admin → KitchenIQ → Debug → Database Tables

### Clear Test Data
WordPress Admin → KitchenIQ → Debug → Clear All Ratings/History

### Enable Analytics Logging
WordPress Admin → KitchenIQ → AI Settings → Enable AI Request Logging
(Requires Airtable config)

## 🐛 Troubleshooting Quick Fixes

| Issue | Fix |
|-------|-----|
| "API Key Not Configured" | Set KIQ_API_KEY env var |
| Tables not created | Deactivate/reactivate plugin |
| Onboarding not saving | Check browser console (F12) for CSRF errors |
| Slow meal generation | Normal: 2-10 seconds first time, then 1-3 seconds |
| Vision scan fails | Check image quality, lighting, and visibility |

## 📊 Cost per User
- **Free user:** $0.001-0.01/month
- **Basic user:** $0.02-0.05/month
- **Pro user:** $0.05-0.10/month

Breakeven at ~2% conversion to Basic tier.

## 🎨 Frontend Components
Dashboard has 5 tabs:
1. **Setup** - Onboarding form
2. **Pantry** - Camera scan + inventory grid
3. **Meals** - Meal generator + results
4. **History** - Past meals (coming soon)
5. **Settings** - Profile + usage stats

## 🔐 Security Checklist
- ✓ API keys in env vars only
- ✓ All REST endpoints require auth
- ✓ Input sanitization everywhere
- ✓ SQL injection prevention via prepare()
- ✓ CSRF protection via nonces
- ✓ JSON mode prevents prompt injection

## 📈 Monitoring
Check WordPress Admin → KitchenIQ → Debug for:
- API key status ✓
- Database table status ✓
- Total user count
- Meal histories count
- Meal ratings count

## 🚀 Deployment Checklist
- [ ] Plugin folder in `/wp-content/plugins/`
- [ ] KIQ_API_KEY environment variable set
- [ ] WordPress page created with shortcode
- [ ] Database tables created (check Debug tab)
- [ ] Test onboarding as new user
- [ ] Test meal generation
- [ ] Test vision scanning
- [ ] Admin panel accessible
- [ ] Settings saving correctly
- [ ] Ready for users!

## 📚 Documentation Files
| File | Purpose |
|------|---------|
| README.md | Full architecture & API reference |
| SETUP_GUIDE.md | Installation & configuration |
| DEVELOPER_GUIDE.md | For future enhancements |
| .env.example | Environment variable template |

## 💬 Support
- **Docs:** See README.md
- **Setup:** See SETUP_GUIDE.md
- **Develop:** See DEVELOPER_GUIDE.md
- **Debug:** WordPress Admin → KitchenIQ → Debug
- **Email:** support@kitcheniq.ai

---

**Version:** 1.0.0 | **License:** Proprietary | **Website:** https://kitcheniq.ai
