# KitchenIQ WordPress Plugin

AI-powered kitchen intelligence system that uses pantry vision scanning to generate personalized meal plans and minimize food waste.

## 📋 Overview

**KitchenIQ** is a freemium SaaS plugin that:
- Captures household preferences through onboarding
- Uses phone camera to scan fridge/pantry/freezer
- Generates AI-powered personalized meal plans based on available inventory
- Tracks perishability and expiry dates
- Suggests substitutions and shopping lists
- Learns from user ratings to improve recommendations

## 💰 Pricing Tiers

| Feature | Free | Basic ($5.99/mo) | Pro ($12.99/mo) |
|---------|------|------------------|-----------------|
| Meal plans per week | 1 | 5 | Unlimited |
| Vision scans per week | 1 | 4 | Unlimited |
| Perishability tracking | ✗ | ✓ | ✓ |
| Meal ratings & preferences | ✗ | ✓ | ✓ |
| Smart substitutions | ✗ | ✓ | ✓ |
| Multi-user households | ✗ | ✗ | ✓ |

## 🏗️ Architecture

### Plugin Structure
```
kitchen-iq/
├── kitchen-iq.php                 # Main plugin file
├── includes/
│   ├── class-kiq-activator.php   # DB setup on activation
│   ├── class-kiq-data.php         # Data access layer
│   ├── class-kiq-ai.php           # OpenAI API integration
│   ├── class-kiq-features.php     # Feature gating/tier logic
│   ├── class-kiq-rest.php         # REST API endpoints
│   ├── class-kiq-admin.php        # WordPress admin panel
│   └── class-kiq-airtable.php     # Optional Airtable analytics
├── assets/
│   ├── js/kiq-dashboard.js        # Frontend dashboard app
│   └── css/kiq-dashboard.css      # Dashboard styling
├── templates/
│   └── dashboard.php              # Dashboard HTML
└── README.md                       # This file
```

### Database Schema

#### Custom Tables
1. **wp_kiq_meal_history** - Stores generated meal plans
   - user_id, plan_type, meals_json, shopping_list_json, created_at

2. **wp_kiq_meal_ratings** - User's meal preferences
   - user_id, meal_key (unique), stars (1-5), preference (often/sometimes/rarely/never)

3. **wp_kiq_usage** - Rate limiting per week
   - user_id, meals_requested_count, vision_scans_count, week_start, week_end

#### Usermeta Fields
- `kiq_profile` - User household preferences (JSON)
- `kiq_inventory` - Current pantry items (JSON array)
- `kiq_user_plan` - Subscription tier (free/basic/pro)

## 🔌 Configuration

### Required Environment Variables

```bash
# OpenAI API key (required)
KIQ_API_KEY=sk-...

# Airtable (optional, for analytics)
AIRTABLE_API_KEY=key...
AIRTABLE_BASE_ID=app...
```

### WordPress Options (Configurable via Admin Panel)

**General Settings:**
- `kiq_default_plan_type` - Default meal plan type (balanced/quick/healthy/budget)
- `kiq_inventory_confirm_limit` - Max perishable items to ask about per session

**AI Settings:**
- `kiq_ai_text_model` - OpenAI text model (default: gpt-4o-mini)
- `kiq_ai_vision_model` - OpenAI vision model (default: gpt-4o-mini)
- `kiq_ai_temperature` - Temperature (0.0-2.0, default: 0.3)
- `kiq_ai_max_tokens` - Max tokens per request (default: 1500)
- `kiq_enable_ai_logging` - Enable logging to Airtable

**Prompt Blocks:**
- `kiq_ai_meal_system_base` - Core system prompt
- `kiq_ai_meal_rules_block` - Additional rules
- `kiq_ai_meal_schema_block` - JSON schema expectations
- `kiq_ai_meal_ratings_block` - Meal preferences logic
- `kiq_ai_meal_substitutions_block` - Substitution rules
- `kiq_ai_meal_perishability_block` - Expiry handling
- `kiq_ai_meal_quantity_level_block` - Quantity tracking
- `kiq_ai_meal_output_safety_block` - Safety guidelines
- `kiq_ai_vision_prompt` - Vision scanning prompt

**Perishability Rules:**
- `kiq_perishability_rules` - Category-based expiry estimates

## 🚀 Installation

1. Copy the `kitchen-iq` folder to `/wp-content/plugins/`
2. Activate the plugin via WordPress admin
3. Set environment variables (KIQ_API_KEY, etc.)
4. Configure settings at WordPress admin → KitchenIQ
5. Add shortcode to any page: `[kitchen_iq_dashboard]`

## 📡 REST API Endpoints

All endpoints require WordPress authentication and return JSON.

### Profile Management
```
GET /wp-json/kitcheniq/v1/profile
POST /wp-json/kitcheniq/v1/profile
```

### Inventory Management
```
GET /wp-json/kitcheniq/v1/inventory
POST /wp-json/kitcheniq/v1/inventory
```

### Meal Generation
```
POST /wp-json/kitcheniq/v1/meals
{
  "plan_type": "balanced",
  "mood": "comfort food"
}
```

Response:
```json
{
  "success": true,
  "record_id": 123,
  "meal_plan": {
    "meals": [
      {
        "meal_name": "Pasta Carbonara",
        "meal_type": "lunch",
        "cooking_time_mins": 25,
        "difficulty": "easy",
        "ingredients_used": [...],
        "missing_items": [...],
        "instructions": "...",
        "nutrition_estimate": {...}
      }
    ],
    "shopping_list": {
      "missing_items": [...],
      "suggested_substitutions": [...]
    }
  },
  "remaining": {
    "meals_remaining": 4,
    "vision_scans_remaining": 3,
    "plan": "basic"
  }
}
```

### Vision Scanning
```
POST /wp-json/kitcheniq/v1/inventory-scan
{
  "image_url": "data:image/jpeg;base64,..."
}
```

### Meal Rating
```
POST /wp-json/kitcheniq/v1/rate-meal
{
  "meal_name": "Pasta Carbonara",
  "stars": 5,
  "preference": "often"
}
```

### Inventory Confirmation
```
POST /wp-json/kitcheniq/v1/inventory-confirm
{
  "item_id": 123,
  "status": "fresh",
  "days_until_expiry": 5
}
```

### Usage Stats
```
GET /wp-json/kitcheniq/v1/usage
```

## 🎨 Frontend Dashboard

The dashboard is a single-page app with 5 tabs:

1. **Setup** - Onboarding questionnaire
   - Household size, dietary restrictions, cooking skill, budget, time per meal
   - Dislikes and available appliances

2. **Pantry** - Inventory management
   - Camera button to scan fridge/pantry/freezer
   - Visual inventory grid with expiry dates

3. **Meals** - Meal plan generation
   - Plan type selector (balanced/quick/healthy/budget)
   - Optional mood input
   - Displays 3 meals with full recipes, ingredients, missing items
   - Star rating interface

4. **History** - Past meals and ratings
   - Browse previous meal plans
   - View ratings and preferences

5. **Settings** - User profile and account
   - Profile summary
   - Usage statistics
   - Account info

## 🤖 AI Integration

### Text Generation (Meal Planning)
- **Provider:** OpenAI API
- **Model:** gpt-4o-mini (cost-optimized)
- **Temperature:** 0.3 (low for consistency)
- **JSON Mode:** Enabled for strict output
- **Max Tokens:** 1500

### Vision Recognition (Pantry Scanning)
- **Model:** gpt-4o-mini with vision
- **Prompt:** Configurable via admin
- **Output:** Detected items with categories, quantities, perishability estimates

### Modular Prompts
The AI behavior is assembled from configurable prompt blocks:
```python
System Prompt = [
    system_base,           # Core instructions
    rules_block,           # Constraints
    schema_block,          # Output format
    [ratings_block if tier >= basic],
    [substitutions_block if tier >= basic],
    [perishability_block if tier >= basic],
    [quantity_level_block if tier >= pro],
    output_safety_block
]
```

This allows fine-tuning without code changes via WordPress admin panel.

## 🔐 Security

- API keys stored as environment variables (never in code)
- All REST endpoints require WordPress authentication
- Input sanitization via `sanitize_text_field()`, `esc_url()`, etc.
- SQL injection prevention via `$wpdb->prepare()`
- CSRF protection via nonces
- JSON mode enforces strict output format

## 💾 Airtable Integration (Optional)

One-way data sync for analytics. Sends:
- Meal history records
- User API usage
- AI token counts and costs

Useful for monitoring, A/B testing, and analytics dashboards.

Enable in admin: KitchenIQ → Debug → Enable Logging

## 📊 Cost Model

### Per-User Monthly Cost
- **AI:** $0.02-0.08/month (gpt-4o-mini at ~$0.15/1M tokens)
- **Storage:** < $0.01/month (AWS/SiteGround MySQL)
- **Hosting:** Included with WordPress hosting
- **Total:** ~$0.10/month

### Revenue per User
- Free: $0
- Basic: $5.99/month
- Pro: $12.99/month

**Breakeven:** ~1% Basic or 1% Pro conversions
**Target:** $5K+/month = ~1000 users (~2-3% conversion)

## 🚦 Development Status

### ✅ Completed
- Database schema and activation
- Data access layer (15+ methods)
- AI integration (OpenAI API calls)
- Feature gating and tier logic
- REST API endpoints (7 routes)
- Admin panel (settings, prompts, debug)
- Frontend dashboard UI and interaction

### 🟡 In Progress
- User authentication flow (WordPress native)
- Payment integration (Stripe - future)
- Advanced analytics dashboard

### ❌ Not Yet Started
- Email notifications
- Sharing meal plans
- Household multi-user sync
- Mobile app wrapper
- Internationalization

## 🐛 Debugging

Access admin panel for debugging:
- WordPress Admin → KitchenIQ → Debug
- View system info, database stats, table status
- Clear ratings/history for testing
- Check API key configuration

Error logs appear in PHP error log.

## 📚 Key Classes

### KIQ_Data
Data access layer with methods for:
- User profiles and inventory
- Meal history and ratings
- Usage tracking and rate limiting
- Perishability calculations

### KIQ_AI
OpenAI API wrapper with methods for:
- `generate_meal_plan()` - Text generation
- `extract_pantry_from_image()` - Vision scanning
- JSON schema validation

### KIQ_Features
Feature gating with methods for:
- `allows($user_id, $feature)` - Check if feature available
- `can_generate_meal()`, `can_scan_pantry()` - Rate limit checks
- `get_remaining_usage()` - Stats for frontend

### KIQ_REST
REST API routes with endpoints for:
- Profile, inventory, meals, ratings, scanning
- Input validation, tier checking, error handling

### KIQ_Admin
WordPress admin panel with settings for:
- General behavior
- AI model parameters
- Prompt customization
- Perishability rules
- Debug utilities

## 📄 License

Proprietary - KitchenIQ.ai

---

**Support:** Contact support@kitcheniq.ai

**Website:** https://kitcheniq.ai

**Version:** 1.0.0
