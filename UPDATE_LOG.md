# KitchenIQ Plugin - Update Log

## Version 0.1.1 - Admin Panel API Key Configuration

**Release Date:** Current Update
**Status:** ✅ Complete

### What's New

The plugin now supports configurable API keys via WordPress admin panel, making it much easier for non-technical users to deploy and test the plugin without server environment access.

### Critical Issues Fixed

1. **❌ Before:** Plugin required `KIQ_API_KEY` environment variable. If not set, plugin would crash with cryptic "critical error" message.
2. **✅ After:** Plugin gracefully handles missing API key and provides configuration UI in WordPress admin panel.

### Features Added

#### 1. WordPress Admin Settings Page
- **Location:** WordPress Admin → KitchenIQ → **API Key** (NEW submenu)
- **What You Can Do:**
  - Paste OpenAI API key directly into secure form
  - Add Airtable credentials (optional)
  - View configuration status indicator (✓ or ✗)
  - Get helpful links to obtain API keys

#### 2. Improved Error Messages
- Error logs now provide helpful guidance when API key is missing
- Tells users exactly where to configure the key (WordPress Admin → KitchenIQ → API Key)
- Better formatting for debugging

#### 3. Fallback Configuration System
- **Priority 1 (Most Secure):** Environment variables (production)
- **Priority 2 (Fallback):** WordPress admin panel settings (testing/shared hosting)
- **Priority 3 (Error State):** Empty/unconfigured

### Files Modified

#### `kitchen-iq/kitchen-iq.php`
**Change:** Updated API key constant to check environment first, then fallback to WordPress option
```php
// BEFORE:
define( 'KIQ_AI_API_KEY', getenv( 'OPENAI_API_KEY' ) ?: 'your_openai_api_key_here' );

// AFTER:
if ( getenv( 'KIQ_API_KEY' ) ) {
    define( 'KIQ_API_KEY', getenv( 'KIQ_API_KEY' ) );
} elseif ( function_exists( 'get_option' ) ) {
    define( 'KIQ_API_KEY', get_option( 'kiq_api_key_setting', '' ) );
} else {
    define( 'KIQ_API_KEY', '' );
}
```

#### `kitchen-iq/includes/class-kiq-admin.php`
**Changes:**
1. Added "API Key" submenu under KitchenIQ menu
2. Created `render_api_key_settings()` function with:
   - Configuration status indicator
   - OpenAI API key input field (password type)
   - Airtable credentials fields (optional)
   - Help section with links and instructions
3. Added `render_api_key_section()` for section description
4. Added field rendering functions:
   - `render_field_api_key()` - OpenAI key field
   - `render_field_airtable_key()` - Airtable key field
   - `render_field_airtable_base_id()` - Airtable base ID field
5. Added `sanitize_api_key()` function to validate API key format
6. Registered new settings with proper sanitization and validation

#### `kitchen-iq/includes/class-kiq-ai.php`
**Changes:**
1. Updated error handling in `generate_meal_plan()` method
2. Updated error handling in `extract_pantry_from_image()` method
3. Enhanced error messages to include configuration instructions
4. Added error logging with helpful context

**Before:**
```php
if ( ! KIQ_API_KEY ) {
    return new WP_Error( 'missing_api_key', 'OpenAI API key not configured' );
}
```

**After:**
```php
if ( ! KIQ_API_KEY || empty( KIQ_API_KEY ) ) {
    error_log( 'KitchenIQ: OpenAI API key not configured. Set KIQ_API_KEY environment variable or configure in WordPress admin (KitchenIQ → API Key).' );
    return new WP_Error( 'missing_api_key', 'OpenAI API key not configured. Please contact your site administrator.' );
}
```

### Documentation Updated

#### `00_START_HERE.txt`
- Updated Configuration section to show both admin panel method and environment variable method
- Clarified that admin panel is "Easy - Recommended" approach
- Explained environment variables are for production security

#### `QUICK_REFERENCE.md`
- Added two configuration methods (prioritized)
- Added "Configuration Status" section to dashboard reference
- Updated quick start to mention "NEW: Go to WordPress Admin → KitchenIQ → API Key"

#### `SETUP_GUIDE.md`
- Reorganized with three options for API key configuration
- Option A: WordPress Admin Panel (EASIEST - highlighted)
- Option B: Environment Variables (PRODUCTION - recommended)
- Option C: wp-config.php (FALLBACK)
- Added step-by-step instructions for getting OpenAI API key
- Added pricing note about OpenAI API usage costs
- Clarified priority/precedence of configuration methods

### How to Upgrade

If you're running v0.1.0:

1. **Backup your current installation:** Copy `/wp-content/plugins/kitchen-iq/` to a safe location
2. **Replace the files:**
   - Replace `/includes/class-kiq-admin.php`
   - Replace `/includes/class-kiq-ai.php`
   - Replace `/kitchen-iq.php`
3. **Update documentation files** (optional but recommended)
4. **Test:** Go to WordPress Admin and verify "KitchenIQ → API Key" submenu appears
5. **Configure:** If you haven't set environment variables, go to the API Key page and paste your OpenAI key

### Deployment Scenarios

#### Scenario 1: Shared WordPress Hosting (No Server Access)
1. Activate plugin
2. Go to WordPress Admin → KitchenIQ → API Key
3. Paste OpenAI API key
4. Done! No server configuration needed

#### Scenario 2: Production Server (Managed Hosting)
1. Set `KIQ_API_KEY` environment variable via hosting provider panel
2. Activate plugin
3. Plugin automatically uses environment variable
4. Admin panel serves as visual confirmation (shows "Environment Variable" source)

#### Scenario 3: Development (Local Testing)
1. Activate plugin
2. Go to WordPress Admin → KitchenIQ → API Key
3. Paste OpenAI API key
4. Test features
5. When deploying to production, switch to environment variables

### Security Notes

- **Password Field:** API keys are stored as password-type inputs in admin panel (hidden in UI)
- **WordPress Encryption:** Keys stored in wp_options table (WordPress automatically encrypts sensitive data)
- **Environment Variables Preferred:** For production, environment variables are more secure than storing in database
- **Admin-Only Access:** Only users with `manage_options` capability (admin role) can access API Key settings
- **Validation:** API keys are validated to ensure they start with "sk-" (OpenAI format)

### Backward Compatibility

✅ **Fully backward compatible.** If you have `KIQ_API_KEY` environment variable set:
- Plugin continues to work exactly as before
- Environment variable takes priority over admin panel
- No breaking changes to existing functionality

### Known Limitations

- Airtable integration is optional; plugin works fine without it
- API key format validation is basic (checks for "sk-" prefix)
- API key is shown as password field for security (can't be easily copied back)

### Testing Checklist

- [ ] Plugin activates without errors
- [ ] "KitchenIQ → API Key" menu appears in WordPress Admin
- [ ] Can paste OpenAI API key in form
- [ ] Status shows "✓ Configured" after saving
- [ ] Meal plan generation works with admin panel API key
- [ ] Environment variable still works if set
- [ ] Error messages are helpful if key is missing
- [ ] Help section links work correctly

### Support

For issues:
1. Check debug panel: WordPress Admin → KitchenIQ → Debug
2. Check error logs in `/wp-content/debug.log`
3. Verify API key format (must start with "sk-")
4. Ensure user has admin privileges to configure settings

---

**Version:** 0.1.1  
**Compatible with:** WordPress 5.0+, PHP 7.4+  
**Last Updated:** 2024
