# KitchenIQ Developer Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│              Frontend (WordPress Dashboard)              │
│           (kiq-dashboard.js + kiq-dashboard.css)        │
└──────────────────┬──────────────────────────────────────┘
                   │ (Fetch requests with nonces)
┌──────────────────▼──────────────────────────────────────┐
│          REST API Layer (class-kiq-rest.php)            │
│  /meals, /profile, /inventory, /rate-meal, /scan        │
└──────────┬──────────────────────────────────────────────┘
           │
    ┌──────┴──────┐
    │             │
┌───▼────┐   ┌───▼────┐
│ Features│   │ Data   │
│ Gating  │   │ Layer  │
│         │   │        │
└──┬──────┘   └───┬────┘
   │              │
   └──────┬───────┘
          │
      ┌───▼───────────────────────────────────────┐
      │     AI Layer (class-kiq-ai.php)           │
      │  generate_meal_plan()                     │
      │  extract_pantry_from_image()              │
      └───┬───────────────────────────────────────┘
          │ (OpenAI API calls via wp_remote_post)
          │
      ┌───▼───────────────────────────────────────┐
      │         External Services                 │
      │  • OpenAI API (meals, vision)             │
      │  • Airtable API (optional analytics)      │
      └───────────────────────────────────────────┘

Database:
    ├─ WordPress Users (wp_users)
    ├─ User Meta (wp_usermeta)
    │  ├─ kiq_profile
    │  ├─ kiq_inventory
    │  └─ kiq_user_plan
    ├─ Custom Tables
    │  ├─ wp_kiq_meal_history
    │  ├─ wp_kiq_meal_ratings
    │  └─ wp_kiq_usage
    └─ WordPress Options (wp_options)
       ├─ kiq_ai_* (model configs)
       ├─ kiq_*_block (prompts)
       └─ kiq_perishability_* (rules)
```

## Adding New Features

### 1. New REST Endpoint

**Step 1:** Add route in `class-kiq-rest.php`
```php
register_rest_route(
    'kitcheniq/v1',
    '/my-feature',
    array(
        'methods'             => 'POST',
        'callback'            => array( __CLASS__, 'handle_my_feature' ),
        'permission_callback' => array( __CLASS__, 'check_auth' ),
    )
);
```

**Step 2:** Add handler method
```php
public static function handle_my_feature( $request ) {
    $user_id = get_current_user_id();
    
    // Check tier access if needed
    if ( ! KIQ_Features::allows( $user_id, 'my_feature' ) ) {
        return new WP_REST_Response( array( 'error' => 'Not available' ), 403 );
    }
    
    // Your logic here
    return new WP_REST_Response( array( 'success' => true ), 200 );
}
```

**Step 3:** Add tier to `class-kiq-features.php`
```php
'my_feature' => array( 'basic', 'pro' ),  // Which tiers get it
```

**Step 4:** Add frontend call in `kiq-dashboard.js`
```javascript
async handleMyFeature() {
    const response = await fetch(`${this.apiRoot}kitcheniq/v1/my-feature`, {
        method: 'POST',
        headers: { 'X-WP-Nonce': this.nonce },
        body: JSON.stringify({ /* params */ }),
    });
    const data = await response.json();
    // Handle response
}
```

### 2. New Database Table

**Add to `class-kiq-activator.php`:**
```php
public static function create_my_table() {
    global $wpdb;
    
    $sql = "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}kiq_my_table (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT UNSIGNED NOT NULL,
        data LONGTEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_data (user_id)
    ) {$wpdb->get_charset_collate()};";
    
    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    dbDelta( $sql );
}
```

Call it in `activate()`:
```php
public static function activate() {
    // ... existing code ...
    self::create_my_table();
}
```

### 3. New Admin Settings Page

**Add to `class-kiq-admin.php`:**
```php
public static function add_admin_menu() {
    // ... existing menu items ...
    add_submenu_page(
        'kitcheniq',
        'My Feature',
        'My Feature',
        'manage_options',
        'kitcheniq-my-feature',
        array( __CLASS__, 'render_my_feature' )
    );
}

public static function render_my_feature() {
    ?>
    <div class="wrap">
        <h1>My Feature Settings</h1>
        <!-- Your HTML here -->
    </div>
    <?php
}
```

### 4. New AI Function

**In `class-kiq-ai.php`:**
```php
public static function my_ai_feature( $user_id, $input ) {
    $payload = array(
        'model'       => get_option( 'kiq_ai_text_model', 'gpt-4o-mini' ),
        'temperature' => 0.3,
        'max_tokens'  => 500,
        'messages'    => array(
            array(
                'role'    => 'system',
                'content' => 'Your prompt here',
            ),
            array(
                'role'    => 'user',
                'content' => $input,
            ),
        ),
    );

    $response = self::call_openai( $payload );
    
    if ( is_wp_error( $response ) ) {
        return $response;
    }

    return json_decode( $response['content'], true );
}
```

## Data Flow Examples

### Example 1: Meal Generation Flow
```
1. User clicks "Generate Meals"
   → JavaScript: this.generateMeals()
   
2. Call REST API
   → POST /meals?plan_type=balanced&mood=comfort
   
3. Check tier and rate limits
   → KIQ_Features::can_generate_meal($user_id)
   
4. Get user data
   → KIQ_Data::get_profile($user_id)
   → KIQ_Data::get_inventory($user_id)
   
5. Call OpenAI
   → KIQ_AI::generate_meal_plan(...)
   
6. Save to database
   → KIQ_Data::save_meal_history(...)
   
7. Send to Airtable
   → KIQ_Airtable::send_meal_history(...)
   
8. Increment usage counter
   → KIQ_Data::increment_meal_count($user_id)
   
9. Return JSON response with meals and remaining usage
```

### Example 2: Vision Scan Flow
```
1. User takes photo
   → JavaScript: this.handleImageUpload(e)
   
2. Convert to data URL
   → FileReader → base64 image
   
3. Call REST API
   → POST /inventory-scan with image_url
   
4. Check tier and rate limits
   → KIQ_Features::allows($user_id, 'vision_scanning')
   → KIQ_Features::can_scan_pantry($user_id)
   
5. Call OpenAI Vision
   → KIQ_AI::extract_pantry_from_image($image_url)
   
6. Merge with existing inventory
   → Get current: KIQ_Data::get_inventory($user_id)
   → Merge new items
   → Save: KIQ_Data::save_inventory($user_id, $merged)
   
7. Increment vision scan counter
   → KIQ_Data::increment_vision_scans($user_id)
   
8. Return items and remaining usage
```

## Testing

### Manual Testing Checklist
- [ ] Free user can see only 1 meal/week
- [ ] Basic user can see 5 meals/week
- [ ] Pro user can see unlimited
- [ ] Rate limiting resets on Monday
- [ ] Vision scan limit enforced
- [ ] Meal ratings save correctly
- [ ] Perishability auto-updates
- [ ] Substitutions only show for Basic+
- [ ] Airtable logging works (if enabled)

### Test Users Setup
```php
// Create test users in WordPress
wp-cli user create testfree testfree@example.com --role=subscriber --user_pass=pass123
wp-cli user create testbasic testbasic@example.com --role=subscriber --user_pass=pass123
wp-cli user create testpro testpro@example.com --role=subscriber --user_pass=pass123

// Set their plans via WordPress Admin or code:
KIQ_Data::set_user_plan($free_user_id, 'free');
KIQ_Data::set_user_plan($basic_user_id, 'basic');
KIQ_Data::set_user_plan($pro_user_id, 'pro');
```

## Performance Optimization

### Database Indexes
Current schema has indexes on:
- user_id (all tables)
- meal_key + user_id (ratings table)

Add more if queries are slow:
```php
// In create_*_table() methods:
$sql .= "KEY idx_created_at (created_at),";
$sql .= "KEY idx_week_start (week_start),";
```

### API Caching
Consider caching meal plans:
```php
// After generate_meal_plan()
$cache_key = 'kiq_meal_plan_' . $user_id . '_' . $plan_type;
wp_cache_set( $cache_key, $meal_plan, '', 1 * HOUR_IN_SECONDS );

// On next request, try cache first:
$meal_plan = wp_cache_get( $cache_key );
```

### Rate Limiting
Current rate limits are configurable:
- Free: 1 meal/week, 1 vision/month
- Basic: 5 meals/week, 4 vision/week
- Pro: Unlimited

Adjust in `class-kiq-features.php`:
```php
$limits = array(
    'free'  => array( 'meals_per_week' => 2 ),  // Changed from 1
    'basic' => array( 'meals_per_week' => 10 ), // Changed from 5
);
```

## Extending the Admin Panel

### Add New Settings Section
```php
add_settings_section(
    'my_section_id',
    'My Section Title',
    array( __CLASS__, 'my_section_callback' ),
    'my_settings_page'
);

add_settings_field(
    'my_field_id',
    'My Field Label',
    array( __CLASS__, 'my_field_callback' ),
    'my_settings_page',
    'my_section_id'
);

register_setting( 'my_settings_page', 'my_option_name' );
```

## Debugging Tips

### Enable Query Logging
```php
// Add to wp-config.php
define( 'WP_DEBUG', true );
define( 'WP_DEBUG_LOG', true );
define( 'WP_DEBUG_DISPLAY', false );

// Logs appear in wp-content/debug.log
```

### Debug REST API
```javascript
// In browser console
fetch('/wp-json/kitcheniq/v1/profile', {
    headers: { 'X-WP-Nonce': kitcheniqData.nonce }
}).then(r => r.json()).then(console.log)
```

### Check Database
```sql
-- SSH access to MySQL
SELECT * FROM wp_kiq_meal_history LIMIT 5;
SELECT * FROM wp_kiq_meal_ratings LIMIT 5;
SELECT * FROM wp_kiq_usage LIMIT 5;
SELECT meta_value FROM wp_usermeta WHERE meta_key='kiq_profile' LIMIT 1;
```

## Future Roadmap

### Phase 2 Features
- [ ] Stripe payment integration
- [ ] Multi-user household support
- [ ] Sharing meal plans with family
- [ ] Export meal plan as PDF
- [ ] Grocery list sync with Amazon Fresh
- [ ] Smart shopping (show deals on missing items)

### Phase 3+ Features
- [ ] Mobile app (React Native)
- [ ] Meal prep macros/calories tracking
- [ ] Restaurant recommendation based on pantry
- [ ] Seasonal/local ingredient suggestions
- [ ] Chef AI personalization
- [ ] Email digest of weekly meals

## Release Process

1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes and commit
3. Create pull request with description
4. Test in staging environment
5. Update version in `kitchen-iq.php` (semantic versioning)
6. Merge to main
7. Tag release: `git tag v1.2.0`
8. Deploy to production

---

**Questions?** Check README.md or reach out to the team.
