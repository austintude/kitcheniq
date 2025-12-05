# KitchenIQ Admin Panel Architecture

## WordPress Admin Menu Structure (v0.1.1)

```
WordPress Admin Dashboard
└── KitchenIQ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ [dashicons-restaurant]
    │
    ├─ General Settings
    │  └─ Default Meal Plan Type
    │     Max Inventory Questions Per Session
    │
    ├─ API Key ✨ NEW ✨
    │  ├─ Configuration Status Indicator
    │  │  ├─ ✓ Configured (green)
    │  │  │  └─ Source: Environment Variable OR WordPress Database
    │  │  └─ ✗ Not Configured (red)
    │  │     └─ "The plugin requires an OpenAI API key..."
    │  │
    │  ├─ Settings Form
    │  │  ├─ OpenAI API Key ............ [sk-••••••••••••••] (password field)
    │  │  ├─ Airtable API Key (Opt) ... [pat-•••••••••••••] (password field)
    │  │  ├─ Airtable Base ID (Opt) .. [app•••••••••••••] (text field)
    │  │  │
    │  │  └─ [Save Changes] button
    │  │
    │  └─ Help Section
    │     ├─ How to Get Your API Keys
    │     ├─ OpenAI: (1) Visit platform.openai.com... (2) Create key (3) Copy
    │     └─ Airtable: (1) Visit airtable.com... (2) Generate token (3) Copy
    │
    ├─ AI Settings
    │  ├─ AI Model Selection
    │  │  ├─ Text Model: gpt-4o-mini
    │  │  └─ Vision Model: gpt-4o-mini
    │  │
    │  ├─ Model Parameters
    │  │  ├─ Temperature: 0.3
    │  │  └─ Max Tokens: 2000
    │  │
    │  └─ Feature Flags
    │     ├─ Enable Vision (Pantry Scanning)
    │     └─ Enable Meal Rating
    │
    ├─ Prompts
    │  ├─ Meal Plan Generation Prompt (advanced)
    │  ├─ Pantry Analysis Prompt (advanced)
    │  └─ ⚠️ Warning: Editing prompts may affect quality
    │
    ├─ Perishability
    │  ├─ Edit Perishability Rules
    │  │  ├─ Fruits: 7 days
    │  │  ├─ Vegetables: 10 days
    │  │  ├─ Dairy: 14 days
    │  │  └─ Meat: 3 days
    │  │
    │  └─ Auto-Update Settings
    │
    └─ Debug
       ├─ Plugin Status
       │  ├─ Version: 0.1.1
       │  ├─ API Key Configured: ✓ or ✗
       │  ├─ Database Tables: ✓
       │  └─ REST API: ✓
       │
       ├─ Recent Errors
       │  └─ [Error log display]
       │
       └─ System Information
          ├─ WordPress Version
          ├─ PHP Version
          └─ Database Info
```

## API Key Page - Detailed View

```
┌─────────────────────────────────────────────────────────────────────┐
│ WordPress Admin › KitchenIQ › API Key                              │
└─────────────────────────────────────────────────────────────────────┘

KitchenIQ API Key Configuration

┌─────────────────────────────────────────────────────────────────────┐
│ Configuration Status                                                 │
│                                                                     │
│ ✓ OpenAI API Key Configured                                        │
│ Source: Environment Variable (KIQ_API_KEY)                         │
│                                                                     │
│ ✓ = Configured          ✗ = Not Configured                         │
│ [Color: Green]          [Color: Red]                               │
└─────────────────────────────────────────────────────────────────────┘

API Configuration

OpenAI API Key
[sk-••••••••••••••••••••••••••••••••••••] (password field)
Your OpenAI API key (starts with "sk-").
Note: An environment variable (KIQ_API_KEY) is already configured 
and takes priority over this setting.

Airtable API Key (Optional)
[pat-••••••••••••••••••••••••••••••••••] (password field)
Optional: Used for analytics synchronization to Airtable

Airtable Base ID (Optional)
[appXXXXXXXXXXXXXXXXXXXX] (text field)
Optional: Your Airtable base ID

┌─────────────────────────────────────────────────────────────────────┐
│ [Save Changes] button                                               │
└─────────────────────────────────────────────────────────────────────┘

How to Get Your API Keys

OpenAI API Key:
1. Visit https://platform.openai.com/account/api-keys
2. Sign in with your OpenAI account (create one if needed)
3. Click "Create new secret key"
4. Copy the key and paste it below
5. Note: OpenAI may charge based on API usage

Airtable API Key (Optional):
1. Visit https://airtable.com/account
2. Click "API"
3. Generate a personal access token
4. Copy and paste below (used for analytics)
```

## Configuration Flow

```
Plugin Activation
│
└─→ Check Configuration Priority:
    │
    ├─ Priority 1: Environment Variable (KIQ_API_KEY)
    │  │
    │  ├─ If found ──→ Use it ──→ Status: "Environment Variable"
    │  │
    │  └─ If not found ↓
    │
    ├─ Priority 2: WordPress Option (kiq_api_key_setting)
    │  │
    │  ├─ If found ──→ Use it ──→ Status: "WordPress Database"
    │  │
    │  └─ If not found ↓
    │
    └─ Priority 3: Error State
       │
       └─ Define as empty ──→ Trigger error message
          "Please configure via: WordPress Admin → KitchenIQ → API Key"
```

## Data Flow - API Key Configuration

```
User Actions
│
├─ Paste API key in form
└─ Click "Save Changes"
   │
   └─→ WordPress sanitize_api_key() function
       │
       ├─ Check format (must start with "sk-")
       │  ├─ Valid ──→ Continue
       │  └─ Invalid ──→ Show warning but allow
       │
       └─→ Store in wp_options table
           (Option name: kiq_api_key_setting)
           │
           └─→ WordPress encrypts data
               │
               └─→ Display status: "✓ Configured"
```

## Error Handling Flow

```
Generate Meal Plan Request
│
└─→ Check KIQ_API_KEY constant
    │
    ├─ Empty or null
    │  │
    │  ├─ Log to error_log:
    │  │  "KitchenIQ: OpenAI API key not configured. 
    │  │   Set KIQ_API_KEY environment variable or configure 
    │  │   in WordPress admin (KitchenIQ → API Key)."
    │  │
    │  ├─ Return WP_Error to user:
    │  │  "OpenAI API key not configured. 
    │  │   Please contact your site administrator."
    │  │
    │  └─ Frontend shows: ✗ API Key Not Configured
    │     with link to settings page
    │
    └─ Value found
       │
       └─→ Proceed with API call
           │
           └─→ Generate meal plan ✓
```

## Security Model

```
API Key Storage Locations
│
├─ Environment Variable (MOST SECURE)
│  ├─ Location: Server environment
│  ├─ Access: Server level only
│  ├─ Encryption: Depends on server config
│  ├─ Best for: Production
│  └─ Priority: Takes precedence
│
├─ WordPress Database (MORE SECURE)
│  ├─ Location: wp_options table
│  ├─ Access: WordPress admin only
│  ├─ Encryption: WordPress automatic
│  ├─ Best for: Development/Testing
│  └─ Priority: Used as fallback
│
└─ Admin Interface (SECURE)
   ├─ Input Type: Password field (••••••••)
   ├─ Access: Admin role only (manage_options)
   ├─ Validation: Format check (sk- prefix)
   ├─ Sanitization: Text sanitization
   └─ Display: Hidden from UI
```

## File Organization

```
kitchen-iq/
│
├── kitchen-iq.php
│   └─ Lines 23-32: Fallback configuration logic
│      ├─ if ( getenv( 'KIQ_API_KEY' ) )
│      ├─ elseif ( function_exists( 'get_option' ) )
│      └─ else
│
├── includes/
│   ├── class-kiq-admin.php
│   │   ├─ Lines 39-45: Add submenu registration
│   │   ├─ Lines 83-118: Settings registration
│   │   ├─ Lines 509-557: render_api_key_settings() [200+ lines]
│   │   ├─ Lines 558-563: render_api_key_section()
│   │   ├─ Lines 564-576: render_field_api_key()
│   │   ├─ Lines 577-584: render_field_airtable_key()
│   │   ├─ Lines 585-592: render_field_airtable_base_id()
│   │   └─ Lines 593-612: sanitize_api_key()
│   │
│   └── class-kiq-ai.php
│       ├─ Lines 20-24: generate_meal_plan() error check
│       └─ Lines 87-91: extract_pantry_from_image() error check
│
└── [Other files unchanged]
```

## New Admin Page Functions

```
function render_api_key_settings()
├─ Verify admin capability
├─ Get current settings from database
├─ Get environment variable status
├─ Display HTML form with:
│  ├─ Configuration status box
│  ├─ Settings form
│  ├─ Help section with links
│  └─ Resource links (OpenAI, Airtable)
└─ Return: Rendered HTML page

function render_api_key_section()
├─ Purpose: Section header
└─ Return: "Configure your API keys..."

function render_field_api_key()
├─ Get current value from database
├─ Render: <input type="password">
├─ Show: Placeholder "sk-..."
├─ Show: Help text
└─ Show: Environment variable status

function render_field_airtable_key()
├─ Get current value
├─ Render: <input type="password">
├─ Show: Optional indicator
└─ Show: Help text

function render_field_airtable_base_id()
├─ Get current value
├─ Render: <input type="text">
├─ Show: Optional indicator
└─ Show: Help text

function sanitize_api_key( $value )
├─ Sanitize text
├─ Check format (sk- prefix)
├─ If invalid: Add settings error
├─ If valid: Accept and store
└─ Return: Sanitized value
```

---

## Summary

The new admin panel provides:
- ✅ User-friendly API key configuration
- ✅ Visual status indicator
- ✅ Help resources and links
- ✅ Secure password input fields
- ✅ Format validation
- ✅ Clear error messages
- ✅ Backward compatibility with environment variables
