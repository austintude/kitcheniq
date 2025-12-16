# Issue: Inventory Duplicate Items on Scan Upload

**Status**: Documented for future implementation  
**Priority**: Medium  
**Severity**: Quality/UX issue (duplicate entries in pantry)

## Problem Description

When a user uploads an image/video for pantry scanning, the AI extracts items from the image. However, the system does **not check the user's existing pantry inventory** before adding these items. This results in:

1. Duplicate line items in the pantry (same item added multiple times)
2. Users seeing items they already logged previously
3. Confusion about what's actually in the pantry vs. what's duplicated

### Example Scenario
- User's pantry has: "Olive Oil (500ml)", "Tomatoes (fresh)"
- User uploads a photo showing their pantry again
- AI extracts: "Olive Oil", "Tomatoes", "Basil"
- Result: Inventory now has BOTH the old entries AND new duplicates

## Root Cause

**File**: [kitchen-iq/includes/class-kiq-rest.php](kitchen-iq/includes/class-kiq-rest.php#L748)  
**Function**: `process_vision_scan_from_raw_images()`  
**Lines**: 806-825

```php
// Current logic:
$existing_inventory = KIQ_Data::get_inventory( $user_id );  // Fetch existing items
$new_items = $all_new_items;  // AI-extracted items from image

// Just assign IDs and merge - NO DEDUP!
foreach ( $new_items as &$item ) {
    $item['id'] = wp_rand( 100000, 999999 );
    $item['added_at'] = current_time( 'mysql' );
}

$merged_inventory = array_merge( $existing_inventory, $new_items );  // Blind merge!
KIQ_Data::save_inventory( $user_id, $merged_inventory );
```

## Solution Design

**Location**: [class-kiq-rest.php](kitchen-iq/includes/class-kiq-rest.php#L748) → `process_vision_scan_from_raw_images()`

### Changes Required:

1. **Extract a dedup helper function** (e.g., `deduplicate_inventory_items()`)
   - Input: `$new_items` (from AI), `$existing_inventory` (from DB)
   - Logic: For each new item, check if it already exists in the user's inventory
   - Match strategy:
     - Normalize item names: lowercase, trim, remove extra whitespace
     - Check for fuzzy match using levenshtein distance (PHP native) for typos
     - If match score > 80%, consider it a duplicate
     - If exact match on name (case-insensitive), definitely a duplicate
   - Output: Filtered `$new_items` with only truly new items

2. **Apply dedup before merging**
   ```php
   $existing_inventory = KIQ_Data::get_inventory( $user_id );
   $new_items = $all_new_items;
   
   // BEFORE merging, remove duplicates
   $truly_new_items = self::deduplicate_inventory_items( $new_items, $existing_inventory );
   
   // Assign IDs/timestamps to truly new items
   foreach ( $truly_new_items as &$item ) {
       $item['id'] = wp_rand( 100000, 999999 );
       $item['added_at'] = current_time( 'mysql' );
   }
   
   // Merge only the new items
   $merged_inventory = array_merge( $existing_inventory, $truly_new_items );
   KIQ_Data::save_inventory( $user_id, $merged_inventory );
   ```

3. **Optional: Smart update instead of skip**
   - If a scan re-detects an item, optionally update its quantity or freshness estimate
   - Requires extending the `$item` schema if not already present
   - Low priority; first pass is just to skip duplicates

4. **Return feedback to user**
   - In the REST response, include:
     - `items_added`: count of actually new items
     - `items_skipped_duplicates`: count of items that were already in inventory
     - Optionally list which items were skipped (for transparency)

### Implementation Steps:

1. Create helper function `deduplicate_inventory_items( $new_items, $existing_inventory )`
2. Integrate into `process_vision_scan_from_raw_images()` before merge
3. Update REST response to reflect skipped duplicates
4. Test with:
   - Same item scanned twice → should not duplicate
   - Similar item names (e.g., "Olive Oil" vs "olive oil") → should recognize as same
   - Legitimately different items → should add both

### Code Location for Implementation:

- **File**: [kitchen-iq/includes/class-kiq-rest.php](kitchen-iq/includes/class-kiq-rest.php)
- **Function**: `process_vision_scan_from_raw_images()` (line ~748)
- **Also check**: [class-kiq-ai.php](kitchen-iq/includes/class-kiq-ai.php) for AI extraction if needed

### Related Classes:

- [KIQ_Data::get_inventory()](kitchen-iq/includes/class-kiq-data.php) - retrieves user inventory
- [KIQ_Data::save_inventory()](kitchen-iq/includes/class-kiq-data.php) - persists to DB
- [KIQ_AI::extract_pantry_from_image()](kitchen-iq/includes/class-kiq-ai.php) - performs AI vision scan

---

## Notes for Implementation:

- Fuzzy matching can be expensive; consider caching normalized names for speed
- Levenshtein distance is good but may need threshold tuning (80% TBD)
- Consider adding a "items_found_but_already_in_pantry" list to the response for user feedback
- This fix also applies to video scanning (via same function)
- Test on mobile devices to ensure dedup logic doesn't slow down large scans

---

**Recorded**: 2025-12-16  
**Reported by**: User testing (audio issue identified, dedup issue noted for later)
