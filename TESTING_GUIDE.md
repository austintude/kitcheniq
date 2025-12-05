# KitchenIQ Testing Guide

## Quick Start (No Image Upload Required)

You can now test the meal generation feature **without uploading images**. This makes testing much faster and easier.

### Test Flow - Option A: Generate Meals Immediately

1. **Add shortcode to page**: `[kitchen_iq_dashboard]`
2. **View the dashboard**:
   - Go to Setup tab → fill out profile (household size, diet restrictions, etc.)
   - Click "Let's Get Started!" 
3. **Skip pantry scan**:
   - Go to Pantry tab
   - Click "➡️ Skip & Go to Meals" button
4. **Generate meals**:
   - You're now on Meals tab
   - Set meal plan type (Balanced, Quick & Easy, etc.)
   - (Optional) Add a mood/context
   - Click "✨ Generate Meals"
5. **View results**:
   - Meal suggestions will appear
   - Each meal shows ingredients, missing items, instructions, nutrition, etc.

### Test Flow - Option B: Scan Image Then Generate

1. **Add shortcode to page**: `[kitchen_iq_dashboard]`
2. **View the dashboard**:
   - Go to Setup tab → fill out profile
   - Click "Let's Get Started!"
3. **Scan pantry** (optional):
   - Go to Pantry tab
   - Click "📸 Scan with Camera"
   - Choose or take a photo
   - Wait for processing (status will show "Added X items")
4. **Generate meals**:
   - Click "🍽️ Meals" tab
   - Click "✨ Generate Meals"
5. **View results**:
   - Meals will show what you have vs. what you need to buy

### Key Changes in v0.1.3+

| Feature | Before | After |
|---------|--------|-------|
| Image scanning | Required before meals | Optional |
| Meal generation | Blocked without pantry | Works with empty inventory |
| User flow | Scan → Meals (linear) | Scan (optional) → Meals (flexible) |
| Testing | Required actual image | Can skip straight to meals |

### Troubleshooting

#### "Error processing image" during scan
- Check that you uploaded a photo of food/pantry
- Image should be PNG or JPEG
- If still failing, check browser Network tab (see Network Debugging below)

#### "Error generating meals"
- Check WordPress admin → KitchenIQ → API Key
- Ensure OpenAI API key is set (either env var or admin panel)
- View browser console for more details

#### "You must be logged in"
- Make sure you're logged into WordPress
- Shortcode only works for authenticated users

### Network Debugging

To debug API calls:

1. **Open browser DevTools**: F12
2. **Go to Network tab**
3. **Trigger an action** (scan image or generate meals)
4. **Look for requests** to:
   - `kitcheniq/v1/inventory-scan` (image upload)
   - `kitcheniq/v1/meals` (meal generation)
   - `kitcheniq/v1/profile` (profile save)
5. **Click the request** and check:
   - **Request**: Payload (should be valid JSON)
   - **Response**: Status code (200 = success, 4xx = error)
   - **Response body**: Error message explaining what went wrong

### Test Data

You can manually test with **empty inventory** — the AI will generate meals based on:
- Your household size
- Dietary restrictions
- Cooking skill level
- Budget preference
- Time available
- Foods you dislike

No pantry scan needed!

---

## For Development

### API Endpoints Available

#### 1. Profile (Setup)
```
POST /wp-json/kitcheniq/v1/profile
```
Sets user preferences for meal generation.

#### 2. Inventory (Pantry)
```
POST /wp-json/kitcheniq/v1/inventory-scan
```
Accepts:
- `image_url` (string): Remote URL or base64 data-URI
Returns:
- `items_added` (number)
- `inventory` (array): Full inventory list

#### 3. Meals (Generate)
```
POST /wp-json/kitcheniq/v1/meals
```
Accepts:
- `plan_type` (string): "balanced", "quick", "healthy", "budget"
- `mood` (string, optional): "comfort food", etc.

Returns:
- `meals` (array): 3 meal suggestions
- `shopping_list` (object): Missing items

### Configuration

**API Key**: Set via one of these methods:
1. Environment variable: `KIQ_API_KEY=sk-...`
2. WordPress admin: KitchenIQ → API Key
3. WordPress option: Add to `wp-config.php`:
   ```php
   define( 'KIQ_API_KEY', 'sk-...' );
   ```

**Models**: Change in admin panel or edit these options:
- `kiq_ai_text_model` (default: `gpt-4o-mini`)
- `kiq_ai_vision_model` (default: `gpt-4o-mini`)
- `kiq_ai_temperature` (default: `0.3`)
- `kiq_ai_max_tokens` (default: `1500`)

---

## Version History

### v0.1.3 (Current)
- ✅ Made image scanning optional
- ✅ Allow meal generation without pantry data
- ✅ Improved data-URI handling in image handler
- ✅ Clearer error messages for invalid input

### v0.1.2
- Shortcode now includes full dashboard template
- Fixed JS localization object name

### v0.1.1
- Added WordPress admin settings for API key
- Fallback: env var → WordPress option → blank
- Better error handling in AI class

### v0.1.0
- Initial release (required image scan)
