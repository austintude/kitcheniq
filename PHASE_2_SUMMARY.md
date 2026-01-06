# Phase 2 — Inventory Data Model & Freshness

## Completed: January 6, 2026
**Version: 1.0.8.0**

## Overview
Phase 2 extends the inventory data model with comprehensive freshness tracking, decay scoring, and a freshness gate for meal generation. The UI now groups inventory by location and displays visual badges for items needing attention.

---

## 1. Extended Inventory Schema

### New Fields Added to Inventory Items
- **`added_at`**: Timestamp when item was added (ISO 8601)
- **`best_by`**: Explicit expiration date (ISO 8601)
- **`last_confirmed_at`**: Last time user confirmed item freshness (ISO 8601)
- **`location`**: Storage location (`pantry`, `fridge`, `freezer`)
- **`category`**: Item category (`meats`, `veg`, `condiments`, `dry`, `spices`, `drinks`, `prepared`, `other`)
- **`quantity`**: Numeric quantity (default: 1)
- **`confidence`**: AI confidence score for vision-detected items (0-1.0)
- **`decay_score`**: Calculated freshness score (0-100, where 100 = expired)

### Data Layer Updates ([class-kiq-data.php](c:\Users\danie\Documents\GitHub\kitcheniq\kitchen-iq\includes\class-kiq-data.php))

#### New Methods
- **`normalize_inventory_item($item)`**: Ensures all items have default values for new schema fields
- **`calculate_decay_score($item)`**: Returns 0-100 decay score based on:
  - Explicit `best_by` date (if set)
  - `perishability_days` + `added_at` (fallback)
  - Age heuristics for items without expiry data
  - Permanence type (permanent items = 0 decay)
  
- **`refresh_inventory_status($user_id)`**: Recalculates decay scores and updates status for all items
  - Status mapping:
    - `decay_score >= 90` → `expired`
    - `decay_score >= 70` → `nearing`
    - `decay_score < 70` → `fresh`

- **`get_inventory_grouped($user_id, $group_by)`**: Returns inventory grouped by `location` or `category`

- **`get_items_needing_confirmation($user_id)`**: Returns items flagged for user review:
  - High decay score (≥70)
  - Low confidence (<0.7)
  - Not confirmed in 7+ days

- **`filter_inventory_by_freshness($user_id)`**: Pre-filters inventory into three buckets for meal generation:
  - **`fresh`**: Safe to use (decay < 60)
  - **`needs_confirm`**: Questionable (decay 60-89 or low confidence)
  - **`expired`**: Should not use (decay ≥ 90)

---

## 2. Freshness Gate Before Meal Generation

### AI Service Updates ([class-kiq-ai.php](c:\Users\danie\Documents\GitHub\kitcheniq\kitchen-iq\includes\class-kiq-ai.php))

**`generate_meal_plan()` now includes freshness pre-check:**
1. Calls `filter_inventory_by_freshness()` before building meal prompt
2. By default, only uses **fresh** items
3. If inventory is empty but `needs_confirm` items exist, returns error:
   ```php
   new WP_Error('freshness_check_required', 'Some inventory items need confirmation before meal planning.', [
       'needs_confirm' => [...],
       'expired' => [...]
   ]);
   ```
4. Caller can bypass gate by passing `skip_freshness_gate: true` in options
5. Adds freshness note to AI prompt indicating excluded items

**Benefits:**
- Prevents AI from planning meals with likely-spoiled ingredients
- Nudges users to confirm stale items before generating meals
- Reduces food waste by prioritizing fresh inventory

---

## 3. REST API Additions ([class-kiq-rest.php](c:\Users\danie\Documents\GitHub\kitcheniq\kitchen-iq\includes\class-kiq-rest.php))

### New Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/inventory/reclassify` | POST | Update item location, category, best_by, quantity |
| `/inventory/bulk-confirm` | POST | Mark multiple items as confirmed fresh |
| `/inventory/grouped` | GET | Get inventory grouped by location or category |
| `/inventory/needs-confirm` | GET | Get items requiring user confirmation |
| `/inventory/freshness` | GET | Get freshness-filtered inventory (fresh/needs_confirm/expired) |

### Handler Details

#### `/inventory/reclassify`
**Body:**
```json
{
  "item_id": "string",
  "location": "fridge|freezer|pantry",
  "category": "meats|veg|condiments|...",
  "best_by": "2026-01-15",
  "quantity": 2.5
}
```
- Updates specified fields
- Sets `last_confirmed_at` to now
- Recalculates `decay_score`

#### `/inventory/bulk-confirm`
**Body:**
```json
{
  "item_ids": ["item_1", "item_2", ...]
}
```
- Sets `last_confirmed_at` to now
- Sets `confidence` to 1.0
- Recalculates decay scores

#### `/inventory/grouped?group_by=location`
**Response:**
```json
{
  "inventory": {
    "fridge": [...],
    "freezer": [...],
    "pantry": [...]
  }
}
```

#### `/inventory/needs-confirm`
**Response:**
```json
{
  "items": [
    { "name": "chicken", "decay_score": 85, "confidence": 0.6, ... }
  ]
}
```

#### `/inventory/freshness`
**Response:**
```json
{
  "fresh": [...],
  "needs_confirm": [...],
  "expired": [...]
}
```

---

## 4. Frontend UI Updates

### Grouped Inventory Display ([kiq-dashboard.js](c:\Users\danie\Documents\GitHub\kitcheniq\kitchen-iq\assets\js\kiq-dashboard.js))

**New rendering features:**
- Items grouped by location (Fridge 🧊, Freezer ❄️, Pantry 🗄️)
- Group headers with item counts
- Visual badges for item status:
  - ⏰ **Expiring Soon** (decay 70-89)
  - ⚠️ **Expired** (decay ≥90)
  - ❓ **Needs Confirm** (confidence <0.7)
  - 🔄 **Check Status** (not confirmed in 7+ days)

**New inline controls:**
- ✓ **Confirm button**: One-tap to mark item fresh
- Dropdowns for `location`, `category`, `status`
- Displays `best_by` date if set

### New Methods
- **`groupInventoryByLocation(items)`**: Organizes items into location-based groups
- **`getLocationLabel(location)`**: Returns friendly label for location
- **`getLocationIcon(location)`**: Returns emoji icon for location
- **`getInventoryBadges(item, decayScore, confidence)`**: Generates HTML badges
- **`confirmInventoryItem(index)`**: Confirms item freshness via API

### CSS Styling ([kiq-dashboard.css](c:\Users\danie\Documents\GitHub\kitcheniq\kitchen-iq\assets\css\kiq-dashboard.css))

**New styles:**
- `.kiq-confirm-btn`: Green checkmark button (✓)
- `.kiq-inventory-group`: Group container with margin
- `.kiq-group-header`: Section header with icon + count
- `.kiq-status-*`: Color-coded status badges (fresh/nearing/expired/low/out)
- `.kiq-badge-*`: Warning/danger/info badges for item flags
- `.kiq-badges`: Badge container with flex wrap

**Visual hierarchy:**
- Fresh items: Green badges
- Expiring soon: Yellow/amber badges
- Expired: Red badges
- Low confidence: Blue badges

---

## 5. Data Flow Example

### Scenario: User scans pantry with vision

1. **Vision scan returns items** with `confidence` scores
2. **`added_at`** is set to current timestamp
3. **AI estimates `perishability_days`** based on item type
4. **`calculate_decay_score()`** computes freshness:
   ```
   decay = (age_days / perishability_days) * 100
   ```
5. **Items displayed** grouped by location with badges
6. **User confirms** fresh items → `last_confirmed_at` updated, `confidence` = 1.0
7. **User generates meal plan**:
   - Freshness gate filters inventory
   - Only fresh items sent to AI
   - If stale items present, user prompted to confirm
8. **AI generates meals** using only fresh ingredients
9. **Meal plan** shows which items are being used

---

## 6. Testing Checklist

- [x] Inventory items have new schema fields
- [x] Decay scores calculated correctly
- [x] Status updates based on decay thresholds
- [x] Freshness gate blocks expired items from meal gen
- [x] REST routes return grouped/filtered inventory
- [x] Frontend displays location groups with badges
- [x] Confirm button updates `last_confirmed_at`
- [x] Dropdowns allow inline location/category changes
- [x] Version bumped to 1.0.8.0

---

## 7. Next Steps: Phase 3 — Store Mode

**Upcoming features:**
- "I'm at the store" button
- Compute gaps vs planned meals
- Propose minimal buy list
- Suggest pantry substitutions to reduce waste
- Voice shortcut: "I'm at the store"

---

## Files Modified

1. [kitchen-iq.php](c:\Users\danie\Documents\GitHub\kitcheniq\kitchen-iq\kitchen-iq.php) — Version bump to 1.0.8.0
2. [class-kiq-data.php](c:\Users\danie\Documents\GitHub\kitcheniq\kitchen-iq\includes\class-kiq-data.php) — Schema + decay logic
3. [class-kiq-rest.php](c:\Users\danie\Documents\GitHub\kitcheniq\kitchen-iq\includes\class-kiq-rest.php) — New inventory routes
4. [class-kiq-ai.php](c:\Users\danie\Documents\GitHub\kitcheniq\kitchen-iq\includes\class-kiq-ai.php) — Freshness gate in meal gen
5. [kiq-dashboard.js](c:\Users\danie\Documents\GitHub\kitcheniq\kitchen-iq\assets\js\kiq-dashboard.js) — Grouped UI + confirm button
6. [kiq-dashboard.css](c:\Users\danie\Documents\GitHub\kitcheniq\kitchen-iq\assets\css\kiq-dashboard.css) — Badge styling

---

## Version History
- **1.0.7.0**: Phase 1 (streaming voice + inline camera)
- **1.0.8.0**: Phase 2 (inventory freshness + decay scoring) ← Current

Ready for Phase 3! 🚀
