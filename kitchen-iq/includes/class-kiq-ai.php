<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * OpenAI API integration for meal planning and vision scanning
 */
class KIQ_AI {

    const API_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
    const VISION_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
    const MAX_RETRIES = 2;
    const RETRY_DELAY = 1000; // milliseconds

    /**
     * Generate meal plan using OpenAI
     */
    public static function generate_meal_plan( $user_id, $profile, $inventory, $plan_type = 'balanced', $mood = null, $options = array() ) {
        if ( ! KIQ_API_KEY || empty( KIQ_API_KEY ) ) {
            error_log( 'KitchenIQ: OpenAI API key not configured. Set KIQ_API_KEY environment variable or configure in WordPress admin (KitchenIQ → API Key).' );
            return new WP_Error( 'missing_api_key', 'OpenAI API key not configured. Please contact your site administrator.' );
        }

        if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
            error_log( sprintf( "KIQ: generate_meal_plan start - user_id=%s plan_type=%s mood=%s inventory_count=%d", intval( $user_id ), esc_html( $plan_type ), $mood ? esc_html( $mood ) : 'none', is_array( $inventory ) ? count( $inventory ) : 0 ) );
            error_log( sprintf( "KIQ: profile snapshot: %s", substr( wp_json_encode( $profile ), 0, 800 ) ) );
        }

        // Check feature access
        if ( ! KIQ_Features::can_generate_meal( $user_id ) ) {
            return new WP_Error( 'rate_limit', 'Meal generation limit reached for this week' );
        }

        // Assemble prompt based on tier
        $system_prompt = KIQ_Features::get_meal_prompt_for_tier( $user_id );
        
        $user_message = self::build_meal_request_message( $profile, $inventory, $plan_type, $mood, $user_id, $options );

        $payload = array(
            'model'       => get_option( 'kiq_ai_text_model', 'gpt-4o-mini' ),
            'temperature' => floatval( get_option( 'kiq_ai_temperature', 0.3 ) ),
            'max_tokens'  => intval( get_option( 'kiq_ai_max_tokens', 1500 ) ),
            'messages'    => array(
                array(
                    'role'    => 'system',
                    'content' => $system_prompt,
                ),
                array(
                    'role'    => 'user',
                    'content' => $user_message,
                ),
            ),
            'response_format' => array(
                'type' => 'json_schema',
                'json_schema' => array(
                    'name' => 'meal_plan',
                    'schema' => self::get_meal_plan_schema(),
                ),
            ),
        );

        if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
            error_log( sprintf( "KIQ: call_openai payload model=%s messages=%d", $payload['model'], count( $payload['messages'] ) ) );
        }

        $response = self::call_openai( $payload );

        if ( is_wp_error( $response ) ) {
            return $response;
        }

        // Parse JSON response
        $parsed = json_decode( $response['content'], true );
        if ( ! $parsed ) {
            error_log( 'KIQ: generate_meal_plan failed to parse AI response. Raw content: ' . substr( $response['content'] ?? '', 0, 800 ) );
            return new WP_Error( 'invalid_json', 'Failed to parse meal plan from AI' );
        }

        if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
            error_log( 'KIQ: generate_meal_plan parsed meal_plan keys: ' . implode( ',', array_keys( $parsed ) ) );
            error_log( 'KIQ: generate_meal_plan meals count: ' . ( is_array( $parsed['meals'] ) ? count( $parsed['meals'] ) : 0 ) );
        }

        // Log the request if enabled
        if ( get_option( 'kiq_enable_ai_logging' ) ) {
            $tokens = $response['usage']['total_tokens'] ?? 0;
            $cost   = ( $tokens / 1000 ) * 0.00015; // Approximate cost for gpt-4o-mini
            KIQ_Airtable::log_ai_request( $user_id, $plan_type, $tokens, $cost );
        }

        // Increment usage
        KIQ_Data::increment_meal_count( $user_id );

        if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
            error_log( sprintf( "KIQ: generate_meal_plan complete - user_id=%s, meals=%d", intval( $user_id ), is_array( $parsed['meals'] ) ? count( $parsed['meals'] ) : 0 ) );
        }

        return $parsed;
    }

    /**
     * Extract pantry items from image using vision
     *
     * @param int    $user_id           The user ID.
     * @param string $image_url         The image URL or data URI.
     * @param string $audio_transcription Optional audio transcription for additional context.
     * @return array|WP_Error
     */
    public static function extract_pantry_from_image( $user_id, $image_url, $audio_transcription = '' ) {
        if ( ! KIQ_API_KEY || empty( KIQ_API_KEY ) ) {
            error_log( 'KitchenIQ: OpenAI API key not configured. Set KIQ_API_KEY environment variable or configure in WordPress admin (KitchenIQ → API Key).' );
            return new WP_Error( 'missing_api_key', 'OpenAI API key not configured. Please contact your site administrator.' );
        }

        if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
            error_log( sprintf( "KIQ: extract_pantry_from_image start - user_id=%s image_url_len=%d audio_len=%d", intval( $user_id ), strlen( $image_url ), strlen( $audio_transcription ) ) );
        }

        // Check feature access
        if ( ! KIQ_Features::allows( $user_id, 'vision_scanning' ) ) {
            return new WP_Error( 'feature_not_allowed', 'Vision scanning not available on your plan' );
        }

        if ( ! KIQ_Features::can_scan_pantry( $user_id ) ) {
            return new WP_Error( 'rate_limit', 'Vision scan limit reached for this month' );
        }

        $vision_prompt = get_option( 'kiq_ai_vision_prompt', self::get_default_vision_prompt() );

        // Enhance prompt with audio transcription if available
        if ( ! empty( $audio_transcription ) ) {
            $vision_prompt .= "\n\n--- AUDIO NARRATION FROM USER ---\n";
            $vision_prompt .= "The user recorded this audio while filming their pantry/fridge. Use this additional context to identify items:\n";
            $vision_prompt .= '"' . $audio_transcription . '"' . "\n";
            $vision_prompt .= "Combine what you see in the image with what the user mentioned in their narration. ";
            $vision_prompt .= "If the user mentions items you can't see clearly in the image, still include them with lower confidence.";
        }

        $payload = array(
            'model'       => get_option( 'kiq_ai_vision_model', 'gpt-4o-mini' ),
            'temperature' => 0.2, // Lower temp for vision for consistency
            'max_tokens'  => 800,
            'messages'    => array(
                array(
                    'role'    => 'user',
                    'content' => array(
                        array(
                            'type' => 'text',
                            'text' => $vision_prompt,
                        ),
                        array(
                            'type'      => 'image_url',
                            'image_url' => array(
                                'url'    => $image_url,
                                'detail' => 'high',
                            ),
                        ),
                    ),
                ),
            ),
            'response_format' => array(
                'type' => 'json_schema',
                'json_schema' => array(
                    'name' => 'pantry_items',
                    'schema' => self::get_pantry_extract_schema(),
                ),
            ),
        );

        $response = self::call_openai( $payload );

        if ( is_wp_error( $response ) ) {
            return $response;
        }

        // Parse response
        $parsed = json_decode( $response['content'], true );
        if ( ! $parsed ) {
            error_log( 'KIQ: extract_pantry_from_image failed to parse AI response. Raw content: ' . substr( $response['content'] ?? '', 0, 800 ) );
            return new WP_Error( 'invalid_json', 'Failed to parse pantry items from image' );
        }

        if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
            error_log( 'KIQ: extract_pantry_from_image parsed items count: ' . ( is_array( $parsed['items'] ) ? count( $parsed['items'] ) : 0 ) );
        }

        // Increment scan count
        KIQ_Data::increment_vision_scans( $user_id );

        return $parsed;
    }

    /**
     * Live assist multimodal helper: takes transcript text and optional JPEG base64 frame.
     * Now includes inventory management capabilities for pantry verification and updates.
     */
    public static function live_assist( $user_id, $transcript, $frame_base64 = '', $current_inventory = array() ) {
        if ( ! KIQ_API_KEY || empty( KIQ_API_KEY ) ) {
            error_log( 'KitchenIQ: OpenAI API key not configured. Set KIQ_API_KEY environment variable or configure in WordPress admin (KitchenIQ → API Key).' );
            return new WP_Error( 'missing_api_key', 'OpenAI API key not configured. Please contact your site administrator.' );
        }

        if ( empty( $transcript ) && empty( $frame_base64 ) ) {
            return new WP_Error( 'missing_input', 'Please provide a transcript or frame to analyze.' );
        }

        // Build system prompt with inventory context if available
        $system_prompt = 'You are KitchenIQ Coach, a helpful AI kitchen assistant with pantry management superpowers. Offer concise, actionable guidance.';
        
        if ( ! empty( $current_inventory ) ) {
            $system_prompt .= "\n\nCURRENT PANTRY INVENTORY:\n" . wp_json_encode( $current_inventory, JSON_PRETTY_PRINT );
            $system_prompt .= "\n\nWhen the user shows you their pantry or mentions items:";
            $system_prompt .= "\n- Compare what you see/hear with the current inventory above";
            $system_prompt .= "\n- Ask clarifying questions about quantity changes, freshness states, or items that look different";
            $system_prompt .= "\n- If items are missing from view but in inventory, ask if they should be removed";
            $system_prompt .= "\n- If new items appear, ask for details (quantity, freshness, category)";
            $system_prompt .= "\n- If something looks spoiled or past due, mention it and ask if it should be removed";
            $system_prompt .= "\n\nReturn your response as JSON with TWO fields:";
            $system_prompt .= "\n1. \"message\": Your conversational response to the user (string)";
            $system_prompt .= "\n2. \"inventory_updates\": Array of inventory changes (can be empty if just chatting). Each update object can have:";
            $system_prompt .= "\n   - \"action\": \"add\", \"update\", or \"remove\"";
            $system_prompt .= "\n   - \"id\": item ID (for update/remove only)";
            $system_prompt .= "\n   - \"name\": item name (for add/update)";
            $system_prompt .= "\n   - \"quantity\": new quantity (for add/update)";
            $system_prompt .= "\n   - \"freshness_label\": \"fresh\", \"good\", \"use_soon\", \"expired\" (for add/update)";
            $system_prompt .= "\n   - \"category\": item category (for add)";
            $system_prompt .= "\n   - \"reason\": brief reason for this change (for user confirmation)";
        }

        $user_content = array();
        if ( ! empty( $transcript ) ) {
            $user_content[] = array(
                'type' => 'text',
                'text' => 'User request: ' . $transcript,
            );
        } else {
            $user_content[] = array(
                'type' => 'text',
                'text' => 'No transcript provided. Analyze the attached frame and suggest 1-2 next actions.',
            );
        }

        if ( ! empty( $frame_base64 ) ) {
            $user_content[] = array(
                'type'      => 'image_url',
                'image_url' => array(
                    'url'    => 'data:image/jpeg;base64,' . $frame_base64,
                    'detail' => 'high',
                ),
            );
        }

        $payload = array(
            'model'       => get_option( 'kiq_ai_text_model', 'gpt-4o-mini' ),
            'temperature' => 0.4,
            'max_tokens'  => 800, // Increased for inventory updates
            'messages'    => array(
                array(
                    'role'    => 'system',
                    'content' => $system_prompt,
                ),
                array(
                    'role'    => 'user',
                    'content' => $user_content,
                ),
            ),
        );

        // Add JSON mode when inventory is provided for structured responses
        if ( ! empty( $current_inventory ) ) {
            $payload['response_format'] = array( 'type' => 'json_object' );
        }

        $response = self::call_openai( $payload );

        if ( is_wp_error( $response ) ) {
            return $response;
        }

        $message = $response['content'] ?? '';
        $inventory_updates = array();

        // Parse JSON response if inventory mode
        if ( ! empty( $current_inventory ) ) {
            $parsed = json_decode( $message, true );
            if ( $parsed && isset( $parsed['message'] ) ) {
                $message = $parsed['message'];
                $inventory_updates = $parsed['inventory_updates'] ?? array();
                
                if ( defined( 'WP_DEBUG' ) && WP_DEBUG && ! empty( $inventory_updates ) ) {
                    error_log( 'KIQ: Coach proposed ' . count( $inventory_updates ) . ' inventory updates' );
                }
            } else {
                // Fallback if AI didn't return proper JSON
                if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
                    error_log( 'KIQ: Coach returned non-JSON response in inventory mode: ' . substr( $message, 0, 200 ) );
                }
            }
        }

        if ( get_option( 'kiq_enable_ai_logging' ) ) {
            $tokens = $response['usage']['total_tokens'] ?? 0;
            $cost   = ( $tokens / 1000 ) * 0.0006; // rough estimate for gpt-4o-mini live assist
            KIQ_Airtable::log_ai_request( $user_id, 'live_assist', $tokens, $cost );
        }

        return array(
            'message'           => $message,
            'inventory_updates' => $inventory_updates,
            'usage'             => $response['usage'] ?? array(),
        );
    }

    /**
     * Call OpenAI API with retry logic and enhanced diagnostics
     */
    private static function call_openai( $payload, $retry_count = 0 ) {
        $args = array(
            'headers' => array(
                'Authorization' => 'Bearer ' . KIQ_API_KEY,
                'Content-Type'  => 'application/json',
            ),
            'body'    => wp_json_encode( $payload ),
            // Vision calls can be slow on shared hosting; keep this high enough to avoid premature timeouts.
            'timeout' => 75,
        );

        // Log diagnostics if debug enabled
        if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
            error_log( 'KitchenIQ: Sending request to OpenAI with model: ' . ( $payload['model'] ?? 'unknown' ) );
            error_log( 'KitchenIQ: Request payload size: ' . strlen( wp_json_encode( $payload ) ) . ' bytes' );
            // redact long strings in messages for log brevity
            $sample = wp_json_encode( array_slice( $payload['messages'], 0, 1 ) );
            error_log( 'KitchenIQ: Message sample: ' . substr( $sample, 0, 600 ) );
        }

        $response = wp_remote_post( self::API_ENDPOINT, $args );

        if ( is_wp_error( $response ) ) {
            $err_msg = $response->get_error_message();
            error_log( 'KitchenIQ OpenAI connection error: ' . $err_msg );
            return $response;
        }

        $http_code = wp_remote_retrieve_response_code( $response );
        $body_raw = wp_remote_retrieve_body( $response );
        $body = json_decode( $body_raw, true );

        // Log HTTP status and response for diagnostics
        if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
            error_log( 'KitchenIQ: OpenAI HTTP status: ' . $http_code );
            error_log( 'KitchenIQ: OpenAI response body: ' . substr( $body_raw, 0, 1000 ) );
        }

        // Check for API errors
        if ( isset( $body['error'] ) ) {
            $error_msg = $body['error']['message'] ?? 'Unknown OpenAI error';
            $error_code = $body['error']['code'] ?? 'unknown';
            error_log( 'KitchenIQ OpenAI API error (' . $error_code . '): ' . $error_msg );
            return new WP_Error( 'openai_error', $error_msg . ' (Code: ' . $error_code . ')' );
        }

        if ( $http_code !== 200 ) {
            error_log( 'KitchenIQ: Unexpected HTTP status ' . $http_code . ' from OpenAI. Response: ' . substr( $body_raw, 0, 200 ) );
            return new WP_Error( 'http_error', 'OpenAI returned HTTP ' . $http_code );
        }

        if ( ! isset( $body['choices'][0]['message']['content'] ) ) {
            error_log( 'KitchenIQ: Invalid response format from OpenAI. Keys: ' . implode( ', ', array_keys( $body ) ) );
            // include body preview for easier debugging
            error_log( 'KitchenIQ: OpenAI invalid response preview: ' . substr( $body_raw, 0, 1200 ) );
            return new WP_Error( 'invalid_response', 'Unexpected OpenAI response format' );
        }

        return array(
            'content' => $body['choices'][0]['message']['content'],
            'usage'   => $body['usage'] ?? array(),
        );
    }

    /**
     * Test OpenAI connectivity and configuration
     * Used by the diagnostic endpoint
     */
    public static function test_openai_connection() {
        if ( ! KIQ_API_KEY || empty( KIQ_API_KEY ) ) {
            return array(
                'status' => 'error',
                'message' => 'API key not configured',
                'api_key_source' => getenv( 'KIQ_API_KEY' ) ? 'environment' : ( get_option( 'kiq_api_key_setting' ) ? 'wordpress' : 'none' ),
            );
        }

        // Validate key format (both old sk-xxx and new sk-proj-xxx formats)
        if ( ! preg_match( '/^sk-(proj-)?[a-zA-Z0-9-]{10,}/', KIQ_API_KEY ) ) {
            return array(
                'status' => 'error',
                'message' => 'API key format invalid (should start with sk- or sk-proj-)',
                'api_key_preview' => substr( KIQ_API_KEY, 0, 15 ) . '...',
            );
        }

        // Test with a minimal completion request
        $test_payload = array(
            'model'      => 'gpt-4o-mini',
            'messages'   => array(
                array(
                    'role'    => 'user',
                    'content' => 'Say "OK" if you receive this.',
                ),
            ),
            'max_tokens' => 10,
        );

        $args = array(
            'headers' => array(
                'Authorization' => 'Bearer ' . KIQ_API_KEY,
                'Content-Type'  => 'application/json',
            ),
            'body'    => wp_json_encode( $test_payload ),
            'timeout' => 15,
        );

        $response = wp_remote_post( self::API_ENDPOINT, $args );

        if ( is_wp_error( $response ) ) {
            return array(
                'status'  => 'error',
                'message' => 'Connection failed: ' . $response->get_error_message(),
            );
        }

        $http_code = wp_remote_retrieve_response_code( $response );
        $body = json_decode( wp_remote_retrieve_body( $response ), true );

        if ( $http_code === 200 && isset( $body['choices'][0]['message']['content'] ) ) {
            return array(
                'status'    => 'success',
                'message'   => 'Successfully connected to OpenAI',
                'model'     => 'gpt-4o-mini',
                'response'  => $body['choices'][0]['message']['content'],
                'api_key_preview' => substr( KIQ_API_KEY, 0, 10 ) . '...',
            );
        }

        if ( isset( $body['error'] ) ) {
            return array(
                'status'  => 'error',
                'message' => 'OpenAI API error: ' . ( $body['error']['message'] ?? 'unknown' ),
                'code'    => $body['error']['code'] ?? 'unknown',
                'http_code' => $http_code,
            );
        }

        return array(
            'status'     => 'error',
            'message'    => 'Unexpected response format',
            'http_code'  => $http_code,
            'response'   => $body,
        );
    }

    /**
     * Build user message for meal request
     */
    private static function build_meal_request_message( $profile, $inventory, $plan_type, $mood, $user_id, $options = array() ) {
        $inventory_text = self::format_inventory_for_prompt( $inventory );
        
        // Get user's meal preferences if they exist
        $preferences = KIQ_Data::get_meal_preferences( $user_id );
        $prefs_text  = self::format_preferences_for_prompt( $preferences );

        // If options include more_seed, ask the model to vary suggestions
        $more_note = '';
        if ( isset( $options['more_seed'] ) ) {
            $more_note = "\n\nNote: The user requested additional alternative ideas (seed: " . esc_html( $options['more_seed'] ) . "). Please vary suggestions accordingly.";
        }

        $message = sprintf(
            "Generate a %s meal plan for a household of %d people.\n\n" .
            "Household Profile:\n%s\n\n" .
            "Current Pantry Inventory:\n%s\n\n" .
            "Past Meal Preferences:\n%s\n\n" .
            "Plan Type: %s\n" .
            "Mood/Context: %s\n\n" .
            "Please generate 3 meals for the next day that use the available inventory.",
            esc_html( $plan_type ),
            intval( $profile['household_size'] ?? 2 ),
            wp_json_encode( $profile, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES ),
            $inventory_text,
            $prefs_text,
            esc_html( $plan_type ),
            $mood ? esc_html( $mood ) : 'no specific mood'
        );

        // Append more_note if present
        if ( $more_note ) {
            $message .= $more_note;
        }

        // Ask the model to scale ingredient quantities to match the household members.
        // We expect the profile to include a 'members' array where each member may have an 'appetite' value 1-5.
        // Tell the model:
        // - Treat appetite=3 as baseline (average). Use each member's appetite to weight portion sizes.
        // - Provide ingredient quantities for the whole household (not per-person), scaled to members' appetites.
        // - If possible, include a per-person breakdown or multiplier used for each ingredient.
        $scaling_instructions = "\n\nImportant: When listing ingredient quantities, scale amounts to feed the full household provided in the profile. " .
                                "Each member may include an 'appetite' value from 1 (small) to 5 (large); treat 3 as average. Use these appetite values to weight portion sizes and output quantities for the entire household. " .
                                "If practical, include a short per-person breakdown or the multiplier used for scaling.\n";

        $message .= $scaling_instructions;

        return $message;
    }

    /**
     * Format inventory for prompt
     */
    private static function format_inventory_for_prompt( $inventory ) {
        if ( empty( $inventory ) ) {
            return 'No items recorded.';
        }

        $lines = array();
        foreach ( $inventory as $item ) {
            $status = isset( $item['status'] ) ? sprintf( ' [%s]', $item['status'] ) : '';
            $qty    = isset( $item['quantity_level'] ) ? sprintf( ' x%s', $item['quantity_level'] ) : '';
            $lines[] = sprintf(
                '- %s%s%s (Category: %s)',
                $item['name'] ?? 'Unknown',
                $qty,
                $status,
                $item['category'] ?? 'general'
            );
        }

        return implode( "\n", $lines );
    }

    /**
     * Format meal preferences for prompt
     */
    private static function format_preferences_for_prompt( $preferences ) {
        $parts = array();

        foreach ( array( 'often', 'sometimes', 'rarely' ) as $pref_level ) {
            if ( ! empty( $preferences[ $pref_level ] ) ) {
                $meals = implode( ', ', array_slice( $preferences[ $pref_level ], 0, 5 ) );
                $parts[] = sprintf( '%s: %s', ucfirst( $pref_level ), $meals );
            }
        }

        return ! empty( $parts ) ? implode( "\n", $parts ) : 'No previous preferences recorded.';
    }

    /**
     * Get meal plan JSON schema
     */
    private static function get_meal_plan_schema() {
        return array(
            'type'       => 'object',
            'properties' => array(
                'meals' => array(
                    'type'  => 'array',
                    'items' => array(
                        'type'       => 'object',
                        'properties' => array(
                            'meal_name'          => array( 'type' => 'string' ),
                            'meal_type'          => array( 'type' => 'string', 'enum' => array( 'breakfast', 'lunch', 'dinner', 'snack' ) ),
                            'cooking_time_mins'  => array( 'type' => 'integer' ),
                            'difficulty'         => array( 'type' => 'string', 'enum' => array( 'easy', 'medium', 'hard' ) ),
                            'ingredients_used'   => array(
                                'type'  => 'array',
                                'items' => array(
                                    'type'       => 'object',
                                    'properties' => array(
                                        'ingredient' => array( 'type' => 'string' ),
                                        'quantity'   => array( 'type' => 'string' ),
                                    ),
                                ),
                            ),
                            'missing_items'      => array(
                                'type'  => 'array',
                                'items' => array(
                                    'type'       => 'object',
                                    'properties' => array(
                                        'item'       => array( 'type' => 'string' ),
                                        'importance' => array( 'type' => 'string', 'enum' => array( 'critical', 'enhances', 'optional' ) ),
                                    ),
                                ),
                            ),
                            'instructions'       => array( 'type' => 'string' ),
                            'nutrition_estimate' => array(
                                'type'       => 'object',
                                'properties' => array(
                                    'calories'  => array( 'type' => 'integer' ),
                                    'protein_g' => array( 'type' => 'number' ),
                                    'carbs_g'   => array( 'type' => 'number' ),
                                    'fat_g'     => array( 'type' => 'number' ),
                                ),
                            ),
                        ),
                        'required' => array( 'meal_name', 'meal_type', 'instructions' ),
                    ),
                ),
                'shopping_list' => array(
                    'type'       => 'object',
                    'properties' => array(
                        'missing_items'          => array(
                            'type'  => 'array',
                            'items' => array( 'type' => 'string' ),
                        ),
                        'suggested_substitutions' => array(
                            'type'  => 'array',
                            'items' => array( 'type' => 'string' ),
                        ),
                    ),
                ),
                'summary'       => array( 'type' => 'string' ),
            ),
            'required' => array( 'meals', 'shopping_list' ),
        );
    }

    /**
     * Get pantry extract schema for vision
     */
    private static function get_pantry_extract_schema() {
        return array(
            'type'       => 'object',
            'properties' => array(
                'items' => array(
                    'type'  => 'array',
                    'items' => array(
                        'type'       => 'object',
                        'properties' => array(
                            'name'                => array( 'type' => 'string' ),
                            'category'            => array( 'type' => 'string' ),
                            'item_count'          => array( 'type' => 'integer', 'minimum' => 1 ),
                            'quantity_estimate'   => array( 'type' => 'string', 'enum' => array( 'full', 'half', 'quarter', 'almost_gone' ) ),
                            'package_state'       => array( 'type' => 'string', 'enum' => array( 'sealed', 'opened', 'half_full', 'mostly_empty' ) ),
                            'freshness_label'     => array( 'type' => 'string', 'enum' => array( 'fresh', 'ripe', 'aging', 'spoiling', 'expired' ) ),
                            'likely_perishable'   => array( 'type' => 'boolean' ),
                            'estimated_days_good' => array( 'type' => 'integer' ),
                            'notes'               => array( 'type' => 'string' ),
                            'confidence'          => array( 'type' => 'number', 'minimum' => 0, 'maximum' => 1 ),
                        ),
                        'required' => array( 'name', 'category' ),
                    ),
                ),
                'summary' => array( 'type' => 'string' ),
            ),
            'required' => array( 'items' ),
        );
    }

    /**
     * Default vision prompt
     */
    private static function get_default_vision_prompt() {
         return 'Analyze this image of a fridge, pantry, or freezer. Capture items cleanly and deduplicated with sensible grouping rules: ' .
             'Group homogenous produce like apples, oranges, or heads of lettuce into one entry using item_count, but DO NOT group spices, herbs, or seasonings—identify each jar/tin individually by label text (e.g., cumin, paprika, oregano). ' .
             'Avoid generic names like "spices (various)"; prefer distinct item names whenever labels are visible. ' .
             'When an item is cut, half-used, or wilted, set freshness_label (aging/spoiling) and reflect fill level via quantity_estimate and package_state. ' .
             'Differentiate beverages precisely (sparkling water vs. soda vs. juice) and snacks; if a bag or box looks half empty, mark package_state=half_full or mostly_empty. ' .
             'Use the provided schema fields: name, category, item_count (defaults to 1), quantity_estimate, package_state, freshness_label, likely_perishable, estimated_days_good, notes, confidence. ' .
             'If multiple photos or angles overlap, still deduplicate, merging identical items only when names and packaging clearly match. Return concise JSON only.';
    }
}
