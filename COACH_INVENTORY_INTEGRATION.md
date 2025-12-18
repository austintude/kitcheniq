# KIQ Coach Inventory Integration - v0.6.15

## Overview
KIQ Coach now actively manages your pantry inventory! The AI can see your current inventory, compare it with what's shown in the video feed, ask clarifying questions, and make updates in real-time.

## Features Added

### 1. Inventory-Aware AI
- **Current State Visibility**: Coach loads your entire pantry inventory before responding
- **Comparison Logic**: AI compares what it sees in video frames with database records
- **Smart Questions**: Asks about quantity changes, freshness states, missing items, or duplicates

### 2. Inventory Management Actions
Coach can now perform three types of inventory operations:

#### Add New Items
- Detects items not in your inventory
- Asks for quantity, freshness state, and category
- Adds with `added_via: 'coach'` tracking

#### Update Existing Items
- Modify quantity (e.g., "I see 3 apples but you have 5 listed")
- Change freshness state (e.g., "Those bananas look like they're use_soon now")
- Update item names if needed

#### Remove Old Items
- Identify expired or spoiled items
- Remove items that are no longer visible
- Ask about items that should be in view but aren't

### 3. Structured Response Format
When inventory is provided, AI returns JSON with:
```json
{
  "message": "Conversational response to user",
  "inventory_updates": [
    {
      "action": "add|update|remove",
      "id": "item_xyz123",
      "name": "Milk",
      "quantity": "1 gallon",
      "freshness_label": "fresh|good|use_soon|expired",
      "category": "Dairy",
      "reason": "Brief explanation for user confirmation"
    }
  ]
}
```

## Technical Implementation

### Backend Changes

#### class-kiq-ai.php
- **live_assist()** now accepts `$current_inventory` parameter
- Enhanced system prompt includes:
  - Full JSON dump of current inventory
  - Instructions for comparison and clarifying questions
  - JSON response format specification
- Increased max_tokens from 400 → 800 for structured responses
- Added JSON mode via `response_format: json_object` when inventory provided
- Parses AI response to extract both message and inventory_updates array

#### class-kiq-rest.php (handle_live_assist)
- Loads user inventory via `KIQ_Data::get_inventory($user_id)` before AI call
- Passes inventory to `KIQ_AI::live_assist()`
- Processes `inventory_updates` array from AI response:
  - **Add**: Creates new item with `uniqid()`, sanitizes fields, tracks via `added_via: 'coach'`
  - **Update**: Finds by ID, updates quantity/freshness/name fields
  - **Remove**: Finds by ID, removes from array
- Saves updated inventory via `KIQ_Data::save_inventory()` after changes
- Returns enhanced response with:
  - `inventory_updated`: boolean flag
  - `applied_changes`: array of change summaries
  - `inventory`: full updated inventory

### Frontend Changes

#### kiq-dashboard.js (sendLiveAssist)
- Checks for `data.inventory_updated` flag in response
- Displays system message with emoji summary (➕/➖/✏️) of changes
- Updates local `this.inventory` state
- Auto-refreshes inventory display if user is on Pantry tab
- Maintains smooth UX with TTS and conversation flow

## User Experience Flow

### Example Interaction 1: Adding New Items
```
User: [Shows camera view of fridge]
      "What do you see in my fridge?"

Coach: "I can see milk, eggs, and cheese. I notice you don't have these 
        in your pantry yet. Should I add them?"

User: "Yes, add them"

Coach: "Great! I've added:
        ➕ Milk (1 container, fresh)
        ➕ Eggs (1 dozen, good)
        ➕ Cheese (1 block, good)
        
        Anything else you'd like me to check?"
```

### Example Interaction 2: Checking Freshness
```
User: [Shows bananas]
      "How do these bananas look?"

Coach: "Those bananas are pretty spotted - they've moved from 'good' to 
        'use soon' territory. I've updated your inventory. Perfect for 
        banana bread if you're not eating them fresh! Want a recipe?"
```

### Example Interaction 3: Removing Expired Items
```
Coach: "I see you have yogurt listed in your inventory, but I can't spot 
        it in the frame. Is it behind something, or should I remove it 
        from your pantry?"

User: "Oh, we finished that yesterday. Remove it."

Coach: "Done! Removed yogurt from your pantry. Anything else to update?"
```

## AI Prompt Engineering

### System Prompt Structure
1. **Identity**: "KitchenIQ Coach, helpful AI kitchen assistant with pantry management superpowers"
2. **Context**: Full JSON of current inventory with pretty printing
3. **Instructions**: 
   - Compare visual/audio input with database
   - Ask clarifying questions for discrepancies
   - Proactive suggestions for freshness issues
4. **Response Format**: JSON schema for structured updates

### Key Behavioral Guidelines
- Ask before making changes (unless user explicitly confirms)
- Explain reasoning in the `reason` field
- Be conversational in the `message` field
- Look for items hiding behind others
- Check for quantity mismatches
- Flag freshness concerns

## Configuration

### AI Model Settings
- Model: `gpt-4o-mini` (default) with vision support
- Temperature: 0.4 (balanced creativity/consistency)
- Max Tokens: 800 (up from 400 to accommodate inventory context + structured response)
- Response Format: `json_object` when inventory provided

### Feature Gating
- Requires Pro tier (`KIQ_Features::allows($user_id, 'live_assist')`)
- No additional rate limits beyond existing Coach restrictions

## Testing Recommendations

### Test Case 1: New Item Detection
1. Start Coach with some items in inventory
2. Show camera view with new items not in database
3. Verify AI asks about adding them
4. Confirm items are added with proper fields

### Test Case 2: Freshness Updates
1. Have items marked as "fresh" in inventory
2. Show older/spotted versions in video
3. Verify AI suggests freshness downgrade
4. Confirm inventory reflects new freshness state

### Test Case 3: Missing Item Removal
1. Have items in inventory that aren't visible
2. Show full pantry view without those items
3. Verify AI asks if they should be removed
4. Confirm removal after user confirmation

### Test Case 4: Tab Refresh
1. Be on Pantry tab
2. Use Coach to make inventory changes
3. Verify Pantry tab auto-refreshes with new data

## Known Limitations

1. **AI Judgment**: Quality of suggestions depends on image clarity and AI interpretation
2. **No Undo**: Changes are immediate - consider adding confirmation UI in future
3. **Conflict Resolution**: If user manually edits inventory during Coach session, may cause confusion
4. **Thread Context**: 30-message cap means long sessions may lose early context

## Future Enhancements

### High Priority
- **Confirmation UI**: Show pending changes in a modal before applying
- **Change History**: Log all Coach-initiated changes with timestamps
- **Barcode Integration**: Coach could scan barcodes via camera for exact product matching

### Medium Priority
- **Batch Operations**: Allow Coach to process entire pantry in one session
- **Smart Deduplication**: Merge similar items detected by Coach with existing inventory
- **Expiry Tracking**: Use added_at dates to proactively flag old items

### Low Priority
- **Voice Commands**: Hands-free approval ("yes, add that" without typing)
- **Recipe Suggestions**: "You have milk about to expire - want smoothie recipes?"
- **Shopping List**: Coach notices missing staples and suggests additions

## Rollback Instructions

If issues arise, revert to v0.6.14:

1. **class-kiq-ai.php**: Remove `$current_inventory` parameter and JSON response parsing
2. **class-kiq-rest.php**: Remove inventory loading/updating logic from `handle_live_assist()`
3. **kiq-dashboard.js**: Remove inventory update handling in `sendLiveAssist()`
4. Bump version back to 0.6.14

## Version History
- **v0.6.15** (Current): Full inventory integration with Coach
- **v0.6.14**: Continuous speech mode fix
- **v0.6.13**: Audio conflict resolution
- **v0.6.11**: Initial Coach feature launch

## Support & Troubleshooting

### Common Issues

**Coach doesn't see inventory changes**
- Check that user is logged in and inventory exists
- Verify `KIQ_Data::get_inventory()` returns array
- Enable WP_DEBUG to see AI prompt in logs

**AI returns plain text instead of JSON**
- Verify `response_format` is set to `json_object`
- Check max_tokens is sufficient (800+)
- AI may fall back to plain text if prompt is too long

**Inventory updates not saving**
- Verify `KIQ_Data::save_inventory()` is called
- Check for proper array re-indexing with `array_values()`
- Confirm usermeta is not hitting size limits

**Frontend doesn't refresh after changes**
- Check `data.inventory_updated` flag in response
- Verify `this.inventory` is updated
- Ensure `renderInventory()` is called

## Documentation References
- REST API: [API_TESTING_GUIDE.md](API_TESTING_GUIDE.md)
- AI Integration: [class-kiq-ai.php](kitchen-iq/includes/class-kiq-ai.php) lines 196-320
- Coach Frontend: [kiq-dashboard.js](kitchen-iq/assets/js/kiq-dashboard.js) lines 1045-1435
- Data Layer: [class-kiq-data.php](kitchen-iq/includes/class-kiq-data.php)
