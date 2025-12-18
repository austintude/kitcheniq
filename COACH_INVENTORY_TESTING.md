# KIQ Coach Inventory Testing - Quick Start

## Prerequisites
- WordPress instance with KitchenIQ plugin v0.6.15+
- User with Pro tier (for Coach access)
- Some items already in pantry inventory
- Camera-enabled device (desktop with webcam or mobile)

## Test Scenario 1: Adding New Items (5 min)

### Setup
1. Navigate to KitchenIQ dashboard
2. Go to Pantry tab and note current items
3. Switch to Coach tab

### Steps
1. Click "Start Coach"
2. Point camera at items NOT in your inventory
3. Click "Talk" and say: "What items do you see here?"
4. Wait for Coach response
5. Coach should identify items and ask if you want to add them
6. Say: "Yes, add them all"
7. Wait for confirmation

### Expected Result
- Coach identifies specific items by name
- AI proposes adding them with reasonable quantity/freshness guesses
- System message shows "Inventory updated: ➕ Item1, ➕ Item2..."
- If you switch to Pantry tab, new items appear immediately

### Debug if Failing
- Open browser console (F12)
- Look for "Coach applied inventory changes" log
- Check REST response includes `inventory_updated: true`
- Verify `applied_changes` array has action: "add"

---

## Test Scenario 2: Updating Freshness (5 min)

### Setup
1. Add an item to inventory manually (e.g., Bananas, freshness: "fresh")
2. Find real bananas that are spotted/overripe
3. Go to Coach tab

### Steps
1. Start Coach
2. Point camera at the spotted bananas
3. Say: "How do these bananas look?"
4. Coach should comment on their condition
5. Check if inventory freshness is updated

### Expected Result
- Coach describes visual freshness accurately
- Updates freshness label (e.g., "fresh" → "use_soon")
- System message shows "Inventory updated: ✏️ Bananas"
- Pantry tab reflects new freshness state

### Debug if Failing
- Check AI response in console for `inventory_updates` array
- Verify update action has correct item ID
- Confirm freshness_label matches valid values: fresh|good|use_soon|expired

---

## Test Scenario 3: Removing Items (5 min)

### Setup
1. Add 2-3 items to inventory that you DON'T have physically
2. Go to Coach tab

### Steps
1. Start Coach
2. Point camera at your actual pantry/fridge
3. Say: "Check my inventory against what you see"
4. Coach should notice discrepancies
5. Confirm removals when prompted

### Expected Result
- Coach identifies items in database but not in view
- Asks clarifying questions ("Is X behind something?")
- After confirmation, removes items
- System message shows "Inventory updated: ➖ Item1, ➖ Item2"

### Debug if Failing
- Ensure current_inventory is passed to AI (check backend logs)
- Verify AI system prompt includes "CURRENT PANTRY INVENTORY"
- Check remove actions have valid item IDs

---

## Test Scenario 4: Quantity Updates (5 min)

### Setup
1. Add "Eggs" to inventory with quantity "6"
2. Have a dozen eggs visible
3. Go to Coach tab

### Steps
1. Start Coach
2. Point camera at eggs
3. Say: "I have a full dozen eggs here, update my inventory"
4. Coach should update quantity

### Expected Result
- Coach recognizes quantity mismatch
- Updates quantity field
- System message shows "Inventory updated: ✏️ Eggs"

---

## Test Scenario 5: Mixed Operations (10 min)

### Setup
- Have some inventory items
- Mix of fresh/old items visible
- Some new items not in inventory

### Steps
1. Start Coach
2. Show full pantry view
3. Say: "Give me a complete inventory audit"
4. Follow Coach's questions and confirmations
5. Verify multiple operations (add/update/remove) in one session

### Expected Result
- Coach performs comprehensive analysis
- Multiple changes in single response or across conversation
- All changes reflected in Pantry tab
- Thread shows clear communication about each change

---

## Console Inspection

### Key Log Messages to Watch
```javascript
// When inventory is loaded
"Coach applied inventory changes: [{action: 'add', name: 'Milk', reason: '...'}]"

// When updates are applied
"Inventory updated: ➕ Milk, ✏️ Eggs, ➖ Yogurt"

// When state is synced
"Response data: {inventory_updated: true, applied_changes: [...], inventory: [...]}"
```

### Backend Logs (WP_DEBUG = true)
```
KIQ: Coach proposed 3 inventory updates
KIQ: live_assist(user_id, transcript, frame, current_inventory[5 items])
```

---

## API Testing (Manual)

### Endpoint: POST /wp-json/kitcheniq/v1/live-assist

**Request:**
```json
{
  "transcript": "I see milk and eggs",
  "frame_jpeg": "data:image/jpeg;base64,..."
}
```

**Expected Response:**
```json
{
  "message": "Great! I can see milk and eggs. Should I add them to your pantry?",
  "inventory_updated": false,
  "applied_changes": [],
  "inventory": [...],
  "transcript": "I see milk and eggs",
  "frame_bytes": 12345,
  "usage": {
    "prompt_tokens": 250,
    "completion_tokens": 100,
    "total_tokens": 350
  }
}
```

**After User Confirms:**
```json
{
  "message": "Added milk and eggs to your pantry!",
  "inventory_updated": true,
  "applied_changes": [
    {"action": "add", "name": "Milk", "reason": "User confirmed new item"},
    {"action": "add", "name": "Eggs", "reason": "User confirmed new item"}
  ],
  "inventory": [
    {"id": "item_abc123", "name": "Milk", "quantity": "1", "freshness_label": "fresh", ...},
    {"id": "item_def456", "name": "Eggs", "quantity": "1 dozen", "freshness_label": "good", ...}
  ]
}
```

---

## Common Issues & Fixes

### Issue: Coach doesn't mention inventory at all
**Cause**: Inventory not loaded or empty
**Fix**: Add at least one item manually first, refresh page

### Issue: AI returns plain text, no JSON
**Cause**: Prompt too long or response_format not set
**Fix**: Check max_tokens (should be 800), verify JSON mode enabled when inventory provided

### Issue: Changes not saving
**Cause**: Sanitization removing data or array index issues
**Fix**: Check `array_values()` is called after unset(), verify all fields are sanitized properly

### Issue: Frontend doesn't refresh
**Cause**: Event handling or state sync issue
**Fix**: Verify `this.inventory = data.inventory` is executed, check `currentView === 'inventory'` condition

### Issue: Wrong items updated/removed
**Cause**: ID mismatch between AI response and database
**Fix**: Ensure AI receives full inventory with IDs, verify ID matching logic in REST handler

---

## Performance Notes

- **First Request (Cold Start)**: 3-5 seconds (loads inventory, sends to AI, processes response)
- **Subsequent Requests**: 2-3 seconds (inventory already in thread context)
- **Large Inventories (50+ items)**: May need max_tokens adjustment or inventory summarization

---

## Success Criteria

✅ Coach can see and reference existing inventory items
✅ Coach asks intelligent questions about discrepancies
✅ New items are added with reasonable defaults
✅ Quantity/freshness updates work correctly
✅ Items can be removed based on conversation
✅ Pantry tab auto-refreshes after changes
✅ System messages clearly communicate what changed
✅ No crashes or JavaScript errors
✅ Changes persist after page refresh

---

## Next Steps After Testing

1. **Gather Feedback**: What inventory operations are most valuable?
2. **Refinement**: Adjust AI prompt based on real-world usage patterns
3. **UX Polish**: Add confirmation modals for destructive operations
4. **Deduplication**: Implement fuzzy matching to avoid duplicate entries
5. **Change History**: Log all Coach-initiated changes for accountability

---

## Related Documentation
- [COACH_INVENTORY_INTEGRATION.md](COACH_INVENTORY_INTEGRATION.md) - Full feature documentation
- [API_TESTING_GUIDE.md](API_TESTING_GUIDE.md) - Complete API reference
- [QUICK_DEBUG.md](QUICK_DEBUG.md) - Troubleshooting guide
