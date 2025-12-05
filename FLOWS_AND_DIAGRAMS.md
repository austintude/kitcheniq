# KitchenIQ User Flow Diagrams

## User Journey Map

```
┌─────────────────────────────────────────────────────────────┐
│                    NEW USER JOURNEY                         │
└─────────────────────────────────────────────────────────────┘

1. SIGNUP
   Landing Page → Create WordPress Account → Email Verification
   
2. FIRST VISIT
   Dashboard → Onboarding Form
   - Household size
   - Dietary restrictions
   - Cooking skill
   - Budget
   - Time preference
   - Dislikes
   - Appliances
   └─→ Profile Saved (usermeta as JSON)

3. PANTRY SETUP
   Camera button → Take photo → AI extracts items
   - See detected items
   - Confirm/edit quantities
   - Items saved to inventory
   
4. FIRST MEAL PLAN
   "Generate Meals" → Select plan type (balanced/quick/healthy/budget)
   - AI calls OpenAI with profile + inventory
   - Returns 3 meal suggestions
   - Each with full recipe, ingredients, missing items
   
5. RATE & LEARN
   ⭐ Rate each meal (1-5 stars)
   - Record preference (often/sometimes/rarely/never)
   - AI learns user taste
   └─→ Next meal plan will be more personalized

6. CONVERT
   After 1-2 uses:
   - Suggest Basic tier ($5.99/mo)
   - Unlock: more meals/week, perishability tracking, ratings
   - Show value: "You've saved $X on food waste"
```

## Feature Matrix by Tier

```
┌─────────────────────────────────────┬────────┬───────┬─────┐
│ Feature                             │ Free   │ Basic │ Pro │
├─────────────────────────────────────┼────────┼───────┼─────┤
│ Meal plans per week                 │   1    │   5   │  ∞  │
│ Vision scans per week               │   1    │   4   │  ∞  │
│ Basic meal generation               │   ✓    │   ✓   │  ✓  │
│ Meal rating & preferences           │   ✗    │   ✓   │  ✓  │
│ Perishability tracking              │   ✗    │   ✓   │  ✓  │
│ Smart substitutions                 │   ✗    │   ✓   │  ✓  │
│ Multi-user households               │   ✗    │   ✗   │  ✓  │
│ Priority API access                 │   ✗    │   ✗   │  ✓  │
├─────────────────────────────────────┼────────┼───────┼─────┤
│ Monthly price                       │ Free   │ $5.99 │$12.99
└─────────────────────────────────────┴────────┴───────┴─────┘
```

## Meal Generation Flow (Technical)

```
┌─────────────────────────────────────┐
│   User clicks "Generate Meals"      │
└──────────────────┬──────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│   Frontend: kiq-dashboard.js         │
│   - Gather plan_type and mood        │
│   - POST /wp-json/kitcheniq/v1/meals │
└──────────────────┬──────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│   REST API: class-kiq-rest.php       │
│   - Check user authentication        │
│   - Validate user_id                 │
└──────────────────┬──────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│   Feature Gating: class-kiq-features │
│   - Check tier allows "meal_planning"│
│   - Enforce weekly meal limit        │
│   └─► Return 429 if exceeded         │
└──────────────────┬──────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│   Data Layer: class-kiq-data.php     │
│   - get_profile($user_id)            │
│   - get_inventory($user_id)          │
│   - get_meal_preferences($user_id)   │
└──────────────────┬──────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│   AI Layer: class-kiq-ai.php         │
│                                      │
│   1. get_meal_prompt_for_tier()      │
│      (assemble modular prompt blocks)│
│                                      │
│   2. build_meal_request_message()    │
│      (format user data for prompt)   │
│                                      │
│   3. call_openai() with:             │
│      - model: gpt-4o-mini            │
│      - temperature: 0.3              │
│      - response_format: json_schema  │
│      - max_tokens: 1500              │
└──────────────────┬──────────────────┘
                   │
                   ▼
         ┌─────────────────┐
         │   OpenAI API    │
         │  GPT-4o-mini    │
         └────────┬────────┘
                  │
                  ▼
        ┌──────────────────────┐
        │   JSON Response:     │
        │ {                    │
        │   "meals": [...],    │
        │   "shopping": {...}  │
        │ }                    │
        └──────────┬───────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│   Save to Database                   │
│   - save_meal_history()              │
│   - increment_meal_count()           │
│   - apply_meal_to_inventory()        │
└──────────────────┬──────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│   Optional: Send to Airtable         │
│   - send_meal_history()              │
│   (if analytics enabled)             │
└──────────────────┬──────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│   Return JSON Response               │
│ {                                    │
│   "success": true,                   │
│   "meal_plan": {...},                │
│   "remaining": {                     │
│     "meals_remaining": 4,            │
│     "vision_scans_remaining": 3      │
│   }                                  │
│ }                                    │
└──────────────────┬──────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│   Frontend: Display Meals             │
│   - Show 3 meal cards                │
│   - Display recipes & ingredients    │
│   - Show missing items & substitutes │
│   - Enable 1-5 star rating           │
└──────────────────────────────────────┘
```

## Vision Scanning Flow

```
┌────────────────────────────────────┐
│   User taps camera icon            │
└────────────┬───────────────────────┘
             │
             ▼
┌────────────────────────────────────┐
│   Browser opens camera             │
│   (via HTML5 file input capture)   │
└────────────┬───────────────────────┘
             │
             ▼
┌────────────────────────────────────┐
│   User takes photo of pantry       │
└────────────┬───────────────────────┘
             │
             ▼
┌────────────────────────────────────┐
│   Frontend converts to base64      │
│   POST /inventory-scan             │
│   with image_url                   │
└────────────┬───────────────────────┘
             │
             ▼
┌────────────────────────────────────┐
│   REST API validates tier:         │
│   - Check "vision_scanning" access │
│   - Check scan limit not exceeded  │
└────────────┬───────────────────────┘
             │
             ▼
┌────────────────────────────────────┐
│   AI Layer: extract_pantry_from_   │
│   image()                          │
│   - Call OpenAI vision model       │
│   - JSON output format             │
└────────────┬───────────────────────┘
             │
             ▼
     ┌───────────────────┐
     │   OpenAI Vision   │
     │   (gpt-4o-mini)   │
     └─────────┬─────────┘
               │
               ▼
    ┌──────────────────────────┐
    │   Extracted Items:       │
    │ [                        │
    │   {                      │
    │     "name": "Milk",      │
    │     "category": "dairy", │
    │     "qty": "full",       │
    │     "perishable": true,  │
    │     "days_good": 5       │
    │   },                     │
    │   ...                    │
    │ ]                        │
    └────────────┬─────────────┘
                 │
                 ▼
┌────────────────────────────────────┐
│   Merge with existing inventory    │
│   - Get current items              │
│   - Add new items with IDs         │
│   - Preserve user edits            │
└────────────┬───────────────────────┘
             │
             ▼
┌────────────────────────────────────┐
│   Save combined inventory          │
│   - increment_vision_scans()       │
│   - save_inventory()               │
└────────────┬───────────────────────┘
             │
             ▼
┌────────────────────────────────────┐
│   Return response                  │
│ {                                  │
│   "success": true,                 │
│   "items_added": 5,                │
│   "inventory": [...]               │
│ }                                  │
└────────────┬───────────────────────┘
             │
             ▼
┌────────────────────────────────────┐
│   Frontend displays:               │
│   - New items added (highlighted)  │
│   - Full inventory grid            │
│   - Remaining scans for week       │
└────────────────────────────────────┘
```

## Database Query Patterns

```
┌──────────────────────────────────────────────┐
│        Common Database Operations            │
└──────────────────────────────────────────────┘

1. SAVE USER PROFILE
   ├─ user_id: 123
   ├─ meta_key: 'kiq_profile'
   └─ meta_value: JSON string
   
   Query: update_user_meta(123, 'kiq_profile', json_encode($profile))

2. GET MEAL PREFERENCES
   ├─ user_id: 123
   ├─ table: wp_kiq_meal_ratings
   └─ SELECT meal_key, preference FROM ratings WHERE user_id=123
   
   Result:
   [
     "often" => ["Pasta Carbonara", "Stir Fry"],
     "sometimes" => ["Tacos", "Risotto"],
     "rarely" => ["Liver", "Anchovies"],
     "never" => ["Durian", "Okra"]
   ]

3. GET WEEK USAGE
   ├─ user_id: 123
   ├─ table: wp_kiq_usage
   └─ WHERE user_id=123 AND week_start <= NOW() AND week_end > NOW()
   
   Result:
   {
     "meals": 2,        ← out of 5 allowed (Basic)
     "vision_scans": 1  ← out of 4 allowed (Basic)
   }

4. SAVE MEAL HISTORY
   ├─ user_id: 123
   ├─ plan_type: "balanced"
   ├─ meals_json: "[{meal_name, ingredients, ...}]"
   ├─ shopping_json: "{missing_items: [...], ...}"
   └─ created_at: NOW()

5. REFRESH PERISHABILITY STATUS
   ├─ Get all items from kiq_inventory
   ├─ For each item:
   │  └─ Compare expiry_estimate to NOW()
   │     ├─ Fresh: expiry > today + 2 days
   │     ├─ Nearing: expiry <= today + 2 days
   │     └─ Expired: expiry < today
   └─ Update status field
```

## API Response Examples

```json
POST /wp-json/kitcheniq/v1/meals (Success)
{
  "success": true,
  "record_id": 456,
  "meal_plan": {
    "meals": [
      {
        "meal_name": "Mushroom Risotto",
        "meal_type": "lunch",
        "cooking_time_mins": 30,
        "difficulty": "medium",
        "ingredients_used": [
          {"ingredient": "Arborio rice", "quantity": "2 cups"},
          {"ingredient": "White wine", "quantity": "1 cup"},
          {"ingredient": "Mushrooms", "quantity": "500g"}
        ],
        "missing_items": [
          {"item": "Parmesan cheese", "importance": "critical"}
        ],
        "instructions": "Heat broth... Toast rice... Add wine...",
        "nutrition_estimate": {
          "calories": 450,
          "protein_g": 15,
          "carbs_g": 65,
          "fat_g": 12
        }
      },
      {...},
      {...}
    ],
    "shopping_list": {
      "missing_items": ["Parmesan", "Fresh herbs"],
      "suggested_substitutions": ["Pecorino for Parmesan"]
    }
  },
  "remaining": {
    "meals_remaining": 4,
    "vision_scans_remaining": 3,
    "plan": "basic"
  }
}

POST /wp-json/kitcheniq/v1/meals (Rate Limited)
{
  "success": false,
  "error": "Weekly meal limit reached",
  "remaining": {
    "meals_remaining": 0,
    "vision_scans_remaining": 3,
    "plan": "free"
  }
}

POST /wp-json/kitcheniq/v1/inventory-scan (Success)
{
  "success": true,
  "items_added": 8,
  "new_items": [
    {
      "id": 456123,
      "name": "Cheddar Cheese",
      "category": "dairy",
      "quantity_level": "half",
      "likely_perishable": true,
      "estimated_days_good": 7,
      "added_at": "2024-01-15 14:32:00"
    },
    {...}
  ],
  "inventory": [...],
  "remaining": {
    "meals_remaining": 5,
    "vision_scans_remaining": 3,
    "plan": "basic"
  }
}
```

## Admin Panel Layout

```
WordPress Admin → KitchenIQ
│
├─ Main Dashboard
│  ├─ Plugin Status
│  ├─ Pricing Tiers Table
│  └─ Quick Stats
│
├─ General Settings
│  ├─ Default Meal Plan Type
│  └─ Inventory Confirm Limit
│
├─ AI Settings
│  ├─ Text Model (gpt-4o-mini)
│  ├─ Vision Model (gpt-4o-mini)
│  ├─ Temperature (0.0-2.0)
│  ├─ Max Tokens (1500)
│  └─ Enable Logging
│
├─ Prompt Blocks
│  ├─ System Base (textarea)
│  ├─ Rules Block (textarea)
│  ├─ Schema Block (textarea)
│  ├─ Ratings Block (textarea)
│  ├─ Substitutions Block (textarea)
│  ├─ Perishability Block (textarea)
│  ├─ Quantity Level Block (textarea)
│  ├─ Output Safety Block (textarea)
│  └─ Vision Prompt (textarea)
│
├─ Perishability Rules
│  └─ Category-based table:
│     ├─ Meat: 7 days fresh, 2 days nearing
│     ├─ Dairy: 10 days fresh, 3 days nearing
│     ├─ Produce: 5 days fresh, 1 day nearing
│     └─ [editable per category]
│
└─ Debug & Logs
   ├─ System Information
   │  ├─ Plugin Version
   │  ├─ API Key Status
   │  ├─ Airtable Status
   │  └─ Database Tables
   │
   ├─ Database Stats
   │  ├─ Total Users
   │  ├─ Meal Histories
   │  └─ Meal Ratings
   │
   └─ Clear Data
      ├─ Clear All Ratings
      └─ Clear All History
```

## Conversion Funnel

```
100 Visitors
    │
    ├─→ 80 Sign up
    │      │
    │      ├─→ 60 Complete onboarding
    │      │      │
    │      │      ├─→ 50 Scan pantry (magic moment!)
    │      │      │      │
    │      │      │      ├─→ 45 Generate first meal
    │      │      │      │      │
    │      │      │      │      ├─→ 30 Rate meals & return
    │      │      │      │      │      │
    │      │      │      │      │      └─→ 15 (50%) Convert to Basic
    │      │      │      │      │              (at ~$5.99/mo = $89.85/mo)
    │      │      │      │      │
    │      │      │      │      └─→ 15 (50%) Churn
    │      │      │      │
    │      │      │      └─→ 5 Don't scan (lost)
    │      │      │
    │      │      └─→ 10 Abandon at onboarding
    │      │
    │      └─→ 20 Don't scan (lost)
    │
    └─→ 20 Don't sign up

Revenue at 3% conversion:
  3 Conversions × $5.99 = $17.97/month per 100 visitors
```

---

All flows are implemented and integrated. Ready to deploy! 🚀
