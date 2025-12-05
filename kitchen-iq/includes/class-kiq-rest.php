<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * REST API endpoints for KitchenIQ
 */
class KIQ_REST {

    public static function init() {
        add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
    }

    public static function register_routes() {
        // Get/Update user profile
        register_rest_route(
            'kitcheniq/v1',
            '/profile',
            array(
                'methods'             => array( 'GET', 'POST' ),
                'callback'            => array( __CLASS__, 'handle_profile' ),
                'permission_callback' => array( __CLASS__, 'check_auth' ),
                'args'                => array(
                    'household_size'        => array( 'type' => 'integer' ),
                    'dietary_restrictions' => array( 'type' => 'array' ),
                    'cooking_skill'        => array( 'type' => 'string' ),
                    'budget_level'         => array( 'type' => 'string' ),
                    'time_per_meal'        => array( 'type' => 'string' ),
                    'dislikes'             => array( 'type' => 'array' ),
                    'appliances'           => array( 'type' => 'array' ),
                ),
            )
        );

        // Get/Update inventory
        register_rest_route(
            'kitcheniq/v1',
            '/inventory',
            array(
                'methods'             => array( 'GET', 'POST' ),
                'callback'            => array( __CLASS__, 'handle_inventory' ),
                'permission_callback' => array( __CLASS__, 'check_auth' ),
                'args'                => array(
                    'items' => array( 'type' => 'array' ),
                ),
            )
        );

        // Generate meal plan
        register_rest_route(
            'kitcheniq/v1',
            '/meals',
            array(
                'methods'             => 'POST',
                'callback'            => array( __CLASS__, 'handle_generate_meals' ),
                'permission_callback' => array( __CLASS__, 'check_auth' ),
                'args'                => array(
                    'plan_type' => array(
                        'type'    => 'string',
                        'default' => 'balanced',
                    ),
                    'mood'      => array( 'type' => 'string' ),
                ),
            )
        );

        // Rate a meal
        register_rest_route(
            'kitcheniq/v1',
            '/rate-meal',
            array(
                'methods'             => 'POST',
                'callback'            => array( __CLASS__, 'handle_rate_meal' ),
                'permission_callback' => array( __CLASS__, 'check_auth' ),
                'args'                => array(
                    'meal_name'  => array( 'type' => 'string', 'required' => true ),
                    'stars'      => array( 'type' => 'integer', 'required' => true ),
                    'preference' => array(
                        'type'    => 'string',
                        'enum'    => array( 'often', 'sometimes', 'rarely', 'never' ),
                        'default' => 'sometimes',
                    ),
                ),
            )
        );

        // Confirm pantry item
        register_rest_route(
            'kitcheniq/v1',
            '/inventory-confirm',
            array(
                'methods'             => 'POST',
                'callback'            => array( __CLASS__, 'handle_inventory_confirm' ),
                'permission_callback' => array( __CLASS__, 'check_auth' ),
                'args'                => array(
                    'item_id'              => array( 'type' => 'integer', 'required' => true ),
                    'status'               => array( 'type' => 'string', 'required' => true ),
                    'days_until_expiry'    => array( 'type' => 'integer' ),
                ),
            )
        );

        // Vision scan
        register_rest_route(
            'kitcheniq/v1',
            '/inventory-scan',
            array(
                'methods'             => 'POST',
                'callback'            => array( __CLASS__, 'handle_inventory_scan' ),
                'permission_callback' => array( __CLASS__, 'check_auth' ),
                'args'                => array(
                    'image_url' => array( 'type' => 'string', 'required' => true ),
                ),
            )
        );

        // Get usage stats
        register_rest_route(
            'kitcheniq/v1',
            '/usage',
            array(
                'methods'             => 'GET',
                'callback'            => array( __CLASS__, 'handle_get_usage' ),
                'permission_callback' => array( __CLASS__, 'check_auth' ),
            )
        );

        // Diagnostic endpoint (public for anyone to see)
        register_rest_route(
            'kitcheniq/v1',
            '/diagnostic',
            array(
                'methods'             => 'GET',
                'callback'            => array( __CLASS__, 'handle_diagnostic' ),
                'permission_callback' => '__return_true',  // Allow public access to diagnostics
            )
        );
    }

    /**
     * Check if request is from an admin user (or logged-in user for diagnostics)
     */
    public static function check_admin( $request ) {
        // Must be logged in
        if ( ! is_user_logged_in() ) {
            return false;
        }
        
        // Admin users can always access
        if ( current_user_can( 'manage_options' ) ) {
            return true;
        }
        
        // For diagnostics (debugging), also allow any logged-in user
        // This helps users self-diagnose without needing admin access
        // In production, you can restrict to manage_options only by removing the next line
        return true;
    }

    /**
     * Check if request is authenticated
     */
    public static function check_auth( $request ) {
        return is_user_logged_in();
    }

    /**
     * Handle profile GET/POST
     */
    public static function handle_profile( $request ) {
        $user_id = get_current_user_id();

        if ( 'GET' === $request->get_method() ) {
            $profile = KIQ_Data::get_profile( $user_id );
            return new WP_REST_Response( array( 'profile' => $profile ), 200 );
        }

        // POST: Update profile
        $params = $request->get_json_params();

        $profile = array(
            'household_size'        => intval( $params['household_size'] ?? 2 ),
            'dietary_restrictions' => isset( $params['dietary_restrictions'] ) ? array_map( 'sanitize_text_field', $params['dietary_restrictions'] ) : array(),
            'cooking_skill'        => sanitize_text_field( $params['cooking_skill'] ?? 'intermediate' ),
            'budget_level'         => sanitize_text_field( $params['budget_level'] ?? 'moderate' ),
            'time_per_meal'        => sanitize_text_field( $params['time_per_meal'] ?? 'moderate' ),
            'dislikes'             => isset( $params['dislikes'] ) ? array_map( 'sanitize_text_field', $params['dislikes'] ) : array(),
            'appliances'           => isset( $params['appliances'] ) ? array_map( 'sanitize_text_field', $params['appliances'] ) : array(),
        );

        KIQ_Data::save_profile( $user_id, $profile );

        return new WP_REST_Response( array(
            'success' => true,
            'profile' => $profile,
        ), 200 );
    }

    /**
     * Handle inventory GET/POST
     */
    public static function handle_inventory( $request ) {
        $user_id = get_current_user_id();

        if ( 'GET' === $request->get_method() ) {
            $inventory = KIQ_Data::get_inventory( $user_id );
            return new WP_REST_Response( array( 'inventory' => $inventory ), 200 );
        }

        // POST: Update inventory
        $params = $request->get_json_params();
        $items  = isset( $params['items'] ) ? $params['items'] : array();

        KIQ_Data::save_inventory( $user_id, $items );

        return new WP_REST_Response( array(
            'success'  => true,
            'inventory' => $items,
        ), 200 );
    }

    /**
     * Handle meal generation
     */
    public static function handle_generate_meals( $request ) {
        $user_id  = get_current_user_id();
        $params   = $request->get_json_params();
        $plan_type = sanitize_text_field( $params['plan_type'] ?? 'balanced' );
        $mood     = isset( $params['mood'] ) ? sanitize_text_field( $params['mood'] ) : null;

        // Check feature access
        if ( ! KIQ_Features::allows( $user_id, 'meal_planning' ) ) {
            return new WP_REST_Response( array(
                'error' => 'Meal planning not available on your plan',
            ), 403 );
        }

        if ( ! KIQ_Features::can_generate_meal( $user_id ) ) {
            $remaining = KIQ_Features::get_remaining_usage( $user_id );
            return new WP_REST_Response( array(
                'error'     => 'Weekly meal limit reached',
                'remaining' => $remaining,
            ), 429 );
        }

        // Get user's profile and inventory
        $profile    = KIQ_Data::get_profile( $user_id );
        $inventory  = KIQ_Data::get_inventory( $user_id );

        // Generate meal plan via AI and handle errors safely
        $debug = defined( 'WP_DEBUG' ) && WP_DEBUG;

        try {
            $meal_plan = KIQ_AI::generate_meal_plan( $user_id, $profile, $inventory, $plan_type, $mood );

            if ( is_wp_error( $meal_plan ) ) {
                error_log( "KIQ: generate_meal_plan WP_Error: " . $meal_plan->get_error_message() );
                return new WP_REST_Response( array(
                    'error' => $meal_plan->get_error_message(),
                ), 500 );
            }

            if ( ! is_array( $meal_plan ) || ! isset( $meal_plan['meals'] ) ) {
                error_log( "KIQ: generate_meal_plan returned unexpected format: " . wp_json_encode( $meal_plan ) );
                return new WP_REST_Response( array(
                    'error' => 'AI returned unexpected response format',
                    'debug' => $debug ? $meal_plan : null,
                ), 500 );
            }

            $meals = $meal_plan['meals'];
            $shopping_list = isset( $meal_plan['shopping_list'] ) ? $meal_plan['shopping_list'] : array();

            // Save meal history (guard for errors)
            $record_id = KIQ_Data::save_meal_history(
                $user_id,
                $plan_type,
                wp_json_encode( $meals ),
                wp_json_encode( $shopping_list )
            );

            if ( is_wp_error( $record_id ) ) {
                error_log( "KIQ: save_meal_history WP_Error: " . $record_id->get_error_message() );
                return new WP_REST_Response( array(
                    'error' => 'Failed to save meal history',
                ), 500 );
            }

            // Apply meal to inventory (decrement quantities) - non-fatal
            if ( KIQ_Features::allows( $user_id, 'meal_ratings' ) ) {
                try {
                    KIQ_Data::apply_meal_to_inventory( $user_id, $meals );
                } catch ( Exception $e ) {
                    error_log( "KIQ: apply_meal_to_inventory exception: " . $e->getMessage() );
                }
            }

            // Send to Airtable if configured - non-fatal
            try {
                KIQ_Airtable::send_meal_history(
                    $record_id,
                    $user_id,
                    $plan_type,
                    $meals,
                    $shopping_list
                );
            } catch ( Exception $e ) {
                error_log( "KIQ: Airtable send_meal_history exception: " . $e->getMessage() );
            }

            return new WP_REST_Response( array(
                'success'    => true,
                'record_id'  => $record_id,
                'meal_plan'  => $meal_plan,
                'remaining'  => KIQ_Features::get_remaining_usage( $user_id ),
            ), 200 );
        } catch ( Exception $e ) {
            error_log( "KIQ: unexpected exception in handle_generate_meals: " . $e->getMessage() );
            $msg = $debug ? $e->getMessage() : 'Internal server error while generating meals';
            return new WP_REST_Response( array(
                'error' => $msg,
            ), 500 );
        }
    }

    /**
     * Handle meal rating
     */
    public static function handle_rate_meal( $request ) {
        $user_id  = get_current_user_id();
        $params   = $request->get_json_params();

        if ( ! KIQ_Features::allows( $user_id, 'meal_ratings' ) ) {
            return new WP_REST_Response( array(
                'error' => 'Meal ratings not available on your plan',
            ), 403 );
        }

        $meal_name  = sanitize_text_field( $params['meal_name'] );
        $stars      = intval( $params['stars'] );
        $preference = sanitize_text_field( $params['preference'] ?? 'sometimes' );

        if ( $stars < 1 || $stars > 5 ) {
            return new WP_REST_Response( array(
                'error' => 'Stars must be between 1 and 5',
            ), 400 );
        }

        KIQ_Data::save_meal_rating( $user_id, $meal_name, $stars, $preference );

        return new WP_REST_Response( array(
            'success' => true,
        ), 200 );
    }

    /**
     * Handle inventory item confirmation
     */
    public static function handle_inventory_confirm( $request ) {
        $user_id = get_current_user_id();
        $params  = $request->get_json_params();

        $item_id            = intval( $params['item_id'] );
        $status             = sanitize_text_field( $params['status'] );
        $days_until_expiry  = intval( $params['days_until_expiry'] ?? 0 );

        $inventory = KIQ_Data::get_inventory( $user_id );

        // Find and update item
        foreach ( $inventory as &$item ) {
            if ( $item['id'] === $item_id ) {
                $item['status']           = $status;
                $item['last_confirmed_at'] = current_time( 'mysql' );
                if ( $days_until_expiry > 0 ) {
                    $item['expiry_estimate'] = date_i18n( 'Y-m-d', time() + ( $days_until_expiry * DAY_IN_SECONDS ) );
                }
                break;
            }
        }

        KIQ_Data::save_inventory( $user_id, $inventory );

        return new WP_REST_Response( array(
            'success'   => true,
            'inventory' => $inventory,
        ), 200 );
    }

    /**
     * Handle vision scanning
     */
    public static function handle_inventory_scan( $request ) {
        $user_id = get_current_user_id();

        $params = $request->get_json_params();

        // Accept either a remote URL or a data URI (base64 image) from the client.
        $raw_image = isset( $params['image_url'] ) ? $params['image_url'] : '';

        if ( empty( $raw_image ) ) {
            return new WP_REST_Response( array(
                'error' => 'Missing image_url parameter',
            ), 400 );
        }

        // If it's a data URI (client sent base64 image), keep it but validate the prefix.
        if ( strpos( $raw_image, 'data:' ) === 0 ) {
            if ( preg_match( '#^data:image/(png|jpeg|jpg);base64,#i', $raw_image ) ) {
                $image_url = $raw_image;
            } else {
                return new WP_REST_Response( array(
                    'error' => 'Unsupported data URI image format',
                ), 400 );
            }
        } else {
            // Otherwise treat it as a remote URL and sanitize.
            $image_url = esc_url_raw( $raw_image );
            if ( empty( $image_url ) ) {
                return new WP_REST_Response( array(
                    'error' => 'Invalid image URL',
                ), 400 );
            }
        }

        if ( ! KIQ_Features::allows( $user_id, 'vision_scanning' ) ) {
            return new WP_REST_Response( array(
                'error' => 'Vision scanning not available on your plan',
            ), 403 );
        }

        if ( ! KIQ_Features::can_scan_pantry( $user_id ) ) {
            $remaining = KIQ_Features::get_remaining_usage( $user_id );
            return new WP_REST_Response( array(
                'error'     => 'Vision scan limit reached',
                'remaining' => $remaining,
            ), 429 );
        }

        // Call AI vision
        $extraction = KIQ_AI::extract_pantry_from_image( $user_id, $image_url );

        if ( is_wp_error( $extraction ) ) {
            return new WP_REST_Response( array(
                'error' => $extraction->get_error_message(),
            ), 500 );
        }

        // Merge with existing inventory
        $existing_inventory = KIQ_Data::get_inventory( $user_id );
        $new_items          = isset( $extraction['items'] ) ? $extraction['items'] : array();

        // Add ID and timestamp to new items
        foreach ( $new_items as &$item ) {
            $item['id']        = wp_rand( 100000, 999999 );
            $item['added_at']  = current_time( 'mysql' );
            $item['category'] = $item['category'] ?? 'general';
        }

        $merged_inventory = array_merge( $existing_inventory, $new_items );
        KIQ_Data::save_inventory( $user_id, $merged_inventory );

        return new WP_REST_Response( array(
            'success'       => true,
            'items_added'   => count( $new_items ),
            'new_items'     => $new_items,
            'inventory'     => $merged_inventory,
            'remaining'     => KIQ_Features::get_remaining_usage( $user_id ),
        ), 200 );
    }

    /**
     * Get usage stats
     */
    public static function handle_get_usage( $request ) {
        $user_id = get_current_user_id();
        $usage   = KIQ_Features::get_remaining_usage( $user_id );

        return new WP_REST_Response( array(
            'usage' => $usage,
        ), 200 );
    }

    /**
     * Diagnostic endpoint - test API connectivity and configuration
     */
    public static function handle_diagnostic( $request ) {
        $diagnostics = array(
            'wordpress' => array(
                'version'          => get_bloginfo( 'version' ),
                'php_version'      => phpversion(),
                'wp_debug'         => defined( 'WP_DEBUG' ) ? WP_DEBUG : false,
                'debug_log'        => defined( 'WP_DEBUG_LOG' ) ? WP_DEBUG_LOG : false,
            ),
            'plugin' => array(
                'version'          => get_option( 'kitcheniq_version', 'unknown' ),
                'api_key_source'   => getenv( 'KIQ_API_KEY' ) ? 'environment' : ( get_option( 'kiq_api_key_setting' ) ? 'wordpress_option' : 'not_set' ),
            ),
            'ai_settings' => array(
                'text_model'       => get_option( 'kiq_ai_text_model', 'gpt-4o-mini' ),
                'vision_model'     => get_option( 'kiq_ai_vision_model', 'gpt-4o-mini' ),
                'temperature'      => get_option( 'kiq_ai_temperature', 0.3 ),
                'max_tokens'       => get_option( 'kiq_ai_max_tokens', 1500 ),
                'logging_enabled'  => get_option( 'kiq_enable_ai_logging', false ),
            ),
            'openai_test' => KIQ_AI::test_openai_connection(),
        );

        return new WP_REST_Response( $diagnostics, 200 );
    }
}

// Initialize REST API
KIQ_REST::init();
