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
    public static function generate_meal_plan( $user_id, $profile, $inventory, $plan_type = 'balanced', $mood = null ) {
        if ( ! KIQ_API_KEY || empty( KIQ_API_KEY ) ) {
            error_log( 'KitchenIQ: OpenAI API key not configured. Set KIQ_API_KEY environment variable or configure in WordPress admin (KitchenIQ → API Key).' );
            return new WP_Error( 'missing_api_key', 'OpenAI API key not configured. Please contact your site administrator.' );
        }

        // Check feature access
        if ( ! KIQ_Features::can_generate_meal( $user_id ) ) {
            return new WP_Error( 'rate_limit', 'Meal generation limit reached for this week' );
        }

        // Assemble prompt based on tier
        $system_prompt = KIQ_Features::get_meal_prompt_for_tier( $user_id );
        
        $user_message = self::build_meal_request_message( $profile, $inventory, $plan_type, $mood, $user_id );

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

        $response = self::call_openai( $payload );

        if ( is_wp_error( $response ) ) {
            return $response;
        }

        // Parse JSON response
        $parsed = json_decode( $response['content'], true );
        if ( ! $parsed ) {
            return new WP_Error( 'invalid_json', 'Failed to parse meal plan from AI' );
        }

        // Log the request if enabled
        if ( get_option( 'kiq_enable_ai_logging' ) ) {
            $tokens = $response['usage']['total_tokens'] ?? 0;
            $cost   = ( $tokens / 1000 ) * 0.00015; // Approximate cost for gpt-4o-mini
            KIQ_Airtable::log_ai_request( $user_id, $plan_type, $tokens, $cost );
        }

        // Increment usage
        KIQ_Data::increment_meal_count( $user_id );

        return $parsed;
    }

    /**
     * Extract pantry items from image using vision
     */
    public static function extract_pantry_from_image( $user_id, $image_url ) {
        if ( ! KIQ_API_KEY || empty( KIQ_API_KEY ) ) {
            error_log( 'KitchenIQ: OpenAI API key not configured. Set KIQ_API_KEY environment variable or configure in WordPress admin (KitchenIQ → API Key).' );
            return new WP_Error( 'missing_api_key', 'OpenAI API key not configured. Please contact your site administrator.' );
        }

        // Check feature access
        if ( ! KIQ_Features::allows( $user_id, 'vision_scanning' ) ) {
            return new WP_Error( 'feature_not_allowed', 'Vision scanning not available on your plan' );
        }

        if ( ! KIQ_Features::can_scan_pantry( $user_id ) ) {
            return new WP_Error( 'rate_limit', 'Vision scan limit reached for this month' );
        }

        $vision_prompt = get_option( 'kiq_ai_vision_prompt', self::get_default_vision_prompt() );

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
            return new WP_Error( 'invalid_json', 'Failed to parse pantry items from image' );
        }

        // Increment scan count
        KIQ_Data::increment_vision_scans( $user_id );

        return $parsed;
    }

    /**
     * Call OpenAI API with retry logic
     */
    private static function call_openai( $payload, $retry_count = 0 ) {
        $args = array(
            'headers' => array(
                'Authorization' => 'Bearer ' . KIQ_API_KEY,
                'Content-Type'  => 'application/json',
            ),
            'body'    => wp_json_encode( $payload ),
            'timeout' => 30,
        );

        $response = wp_remote_post( self::API_ENDPOINT, $args );

        if ( is_wp_error( $response ) ) {
            error_log( 'KitchenIQ OpenAI error: ' . $response->get_error_message() );
            return $response;
        }

        $body = json_decode( wp_remote_retrieve_body( $response ), true );

        // Check for API errors
        if ( isset( $body['error'] ) ) {
            $error_msg = $body['error']['message'] ?? 'Unknown OpenAI error';
            error_log( 'KitchenIQ OpenAI API error: ' . $error_msg );
            return new WP_Error( 'openai_error', $error_msg );
        }

        if ( ! isset( $body['choices'][0]['message']['content'] ) ) {
            return new WP_Error( 'invalid_response', 'Unexpected OpenAI response format' );
        }

        return array(
            'content' => $body['choices'][0]['message']['content'],
            'usage'   => $body['usage'] ?? array(),
        );
    }

    /**
     * Build user message for meal request
     */
    private static function build_meal_request_message( $profile, $inventory, $plan_type, $mood, $user_id ) {
        $inventory_text = self::format_inventory_for_prompt( $inventory );
        
        // Get user's meal preferences if they exist
        $preferences = KIQ_Data::get_meal_preferences( $user_id );
        $prefs_text  = self::format_preferences_for_prompt( $preferences );

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
                            'quantity_estimate'   => array( 'type' => 'string', 'enum' => array( 'full', 'half', 'quarter', 'almost_gone' ) ),
                            'likely_perishable'   => array( 'type' => 'boolean' ),
                            'estimated_days_good' => array( 'type' => 'integer' ),
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
        return 'Analyze this image of a fridge, pantry, or freezer. Extract all visible food items and estimate their quantities and freshness. ' .
               'For each item, guess if it\'s perishable and estimate how many days it will likely stay fresh. ' .
               'Return results as JSON with item names, categories, quantity estimates, and perishability info.';
    }
}
