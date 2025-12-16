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
                    'members'               => array( 'type' => 'array' ),
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
                    // Accept images and/or videos. At least one must be provided (validated in callback).
                    'image_url'          => array( 'type' => 'string' ),
                    'image_urls'         => array( 'type' => 'array' ),
                    'video_url'          => array( 'type' => 'string' ),
                    'video_urls'         => array( 'type' => 'array' ),
                    'audio_transcription'=> array( 'type' => 'string' ),
                ),
            )
        );

        // Video scan (multipart upload). This is the most reliable path (avoids huge base64 JSON bodies).
        register_rest_route(
            'kitcheniq/v1',
            '/inventory-scan-video',
            array(
                'methods'             => 'POST',
                'callback'            => array( __CLASS__, 'handle_inventory_scan_video' ),
                'permission_callback' => array( __CLASS__, 'check_auth' ),
            )
        );

        // Add pantry item via barcode/QR scan lookup
        register_rest_route(
            'kitcheniq/v1',
            '/inventory-code',
            array(
                'methods'             => 'POST',
                'callback'            => array( __CLASS__, 'handle_inventory_code_lookup' ),
                'permission_callback' => array( __CLASS__, 'check_auth' ),
                'args'                => array(
                    'code'     => array( 'type' => 'string', 'required' => true ),
                    'quantity' => array( 'type' => 'integer', 'default' => 1 ),
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

        // Audio transcription for video scanning
        register_rest_route(
            'kitcheniq/v1',
            '/transcribe-audio',
            array(
                'methods'             => 'POST',
                'callback'            => array( __CLASS__, 'handle_transcribe_audio' ),
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

        // Live assist (top-tier gated): accept transcript + optional frame image (data URL base64)
        register_rest_route(
            'kitcheniq/v1',
            '/live-assist',
            array(
                'methods'             => 'POST',
                'callback'            => array( __CLASS__, 'handle_live_assist' ),
                'permission_callback' => array( __CLASS__, 'check_auth' ),
                'args'                => array(
                    'transcript' => array( 'type' => 'string' ),
                    'frame_jpeg' => array( 'type' => 'string' ), // data URL or base64 string
                ),
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

        // Sanitize basic profile fields
        $profile = array(
            'household_size'        => intval( $params['household_size'] ?? 2 ),
            'dietary_restrictions'  => isset( $params['dietary_restrictions'] ) ? array_map( 'sanitize_text_field', $params['dietary_restrictions'] ) : array(),
            'cooking_skill'         => sanitize_text_field( $params['cooking_skill'] ?? 'intermediate' ),
            'budget_level'          => sanitize_text_field( $params['budget_level'] ?? 'moderate' ),
            'time_per_meal'         => sanitize_text_field( $params['time_per_meal'] ?? 'moderate' ),
            'dislikes'              => isset( $params['dislikes'] ) ? array_map( 'sanitize_text_field', $params['dislikes'] ) : array(),
            'appliances'            => isset( $params['appliances'] ) ? array_map( 'sanitize_text_field', $params['appliances'] ) : array(),
        );

        // Members (optional) - accept array of member objects with fields: name, appetite, allergies, intolerances, dislikes, age
        $members = array();
        if ( isset( $params['members'] ) && is_array( $params['members'] ) ) {
            foreach ( $params['members'] as $m ) {
                if ( ! is_array( $m ) ) {
                    continue;
                }
                $member = array(
                    'name'          => sanitize_text_field( $m['name'] ?? '' ),
                    'appetite'      => intval( $m['appetite'] ?? 3 ),
                    'age'           => isset( $m['age'] ) ? intval( $m['age'] ) : null,
                    'allergies'     => isset( $m['allergies'] ) && is_array( $m['allergies'] ) ? array_map( 'sanitize_text_field', $m['allergies'] ) : array(),
                    'intolerances'  => isset( $m['intolerances'] ) && is_array( $m['intolerances'] ) ? array_map( 'sanitize_text_field', $m['intolerances'] ) : array(),
                    'dislikes'      => isset( $m['dislikes'] ) && is_array( $m['dislikes'] ) ? array_map( 'sanitize_text_field', $m['dislikes'] ) : array(),
                );
                $members[] = $member;
            }
        }

        if ( ! empty( $members ) ) {
            $profile['members'] = $members;
        }

        KIQ_Data::save_profile( $user_id, $profile );

        return new WP_REST_Response( array(
            'success' => true,
            'profile' => $profile,
        ), 200 );
    }

    /**
     * Handle live assist (tier-gated: pro only).
     * Accepts transcript text and optional frame image (base64 or data URL), delegates to KIQ_AI.
     */
    public static function handle_live_assist( $request ) {
        $user_id = get_current_user_id();

        if ( ! KIQ_Features::allows( $user_id, 'live_assist' ) ) {
            return new WP_REST_Response( array( 'error' => 'not_allowed', 'message' => 'Live assist is available on Pro.' ), 403 );
        }

        $params       = $request->get_json_params();
        $transcript   = sanitize_textarea_field( $params['transcript'] ?? '' );
        $frame_raw    = isset( $params['frame_jpeg'] ) ? $params['frame_jpeg'] : '';
        $frame_base64 = '';

        if ( is_string( $frame_raw ) && $frame_raw !== '' ) {
            if ( strpos( $frame_raw, 'data:image' ) === 0 ) {
                $parts        = explode( ',', $frame_raw, 2 );
                $frame_base64 = $parts[1] ?? '';
            } else {
                $frame_base64 = $frame_raw;
            }
        }

        $ai_response = KIQ_AI::live_assist( $user_id, $transcript, $frame_base64 );

        if ( is_wp_error( $ai_response ) ) {
            return new WP_REST_Response( array(
                'error'   => $ai_response->get_error_code(),
                'message' => $ai_response->get_error_message(),
            ), 500 );
        }

        // Persist a short thread history for continuity
        if ( ! empty( $transcript ) ) {
            KIQ_Data::append_live_message( $user_id, array(
                'role'        => 'user',
                'text'        => $transcript,
                'frame_bytes' => $frame_base64 ? strlen( base64_decode( $frame_base64, true ) ) : 0,
            ) );
        }

        if ( ! empty( $ai_response['message'] ) ) {
            KIQ_Data::append_live_message( $user_id, array(
                'role' => 'assistant',
                'text' => $ai_response['message'],
            ) );
        }

        return new WP_REST_Response( array(
            'message'      => $ai_response['message'] ?? '',
            'transcript'   => $transcript,
            'frame_bytes'  => $frame_base64 ? strlen( base64_decode( $frame_base64, true ) ) : 0,
            'usage'        => $ai_response['usage'] ?? array(),
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
        $more_seed = isset( $params['more_seed'] ) ? sanitize_text_field( $params['more_seed'] ) : null;

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
            $opts = array();
            if ( $more_seed ) {
                $opts['more_seed'] = $more_seed;
            }
            $meal_plan = KIQ_AI::generate_meal_plan( $user_id, $profile, $inventory, $plan_type, $mood, $opts );

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
                $meals,
                $shopping_list
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
     * Add an inventory item via barcode/QR scan lookup
     */
    public static function handle_inventory_code_lookup( $request ) {
        $user_id = get_current_user_id();
        $params  = $request->get_json_params();

        $raw_code = $params['code'] ?? '';
        $code     = self::sanitize_code_input( $raw_code );
        if ( is_wp_error( $code ) ) {
            return new WP_REST_Response( array(
                'error' => $code->get_error_message(),
            ), 400 );
        }

        $quantity = max( 1, intval( $params['quantity'] ?? 1 ) );

        $product = self::lookup_product_metadata( $code );
        if ( is_wp_error( $product ) ) {
            $status = $product->get_error_code() === 'product_not_found' ? 404 : 400;
            return new WP_REST_Response( array(
                'error' => $product->get_error_message(),
            ), $status );
        }

        $inventory_item = self::build_inventory_item_from_product( $product, $quantity );

        $inventory   = KIQ_Data::get_inventory( $user_id );
        $inventory[] = $inventory_item;
        KIQ_Data::save_inventory( $user_id, $inventory );

        return new WP_REST_Response( array(
            'success'     => true,
            'code'        => $code,
            'product'     => $product,
            'added_item'  => $inventory_item,
            'inventory'   => $inventory,
        ), 200 );
    }

    /**
     * Handle vision scanning
     */
    public static function handle_inventory_scan( $request ) {
        $user_id = get_current_user_id();

        // Video scanning can take longer (ffmpeg + multiple vision calls).
        if ( function_exists( 'set_time_limit' ) ) {
            @set_time_limit( 180 );
        }

        $t0 = microtime( true );

        $params = $request->get_json_params();

        // Debug logging
        if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
            error_log( 'KIQ inventory-scan: params keys = ' . implode( ', ', array_keys( $params ?? array() ) ) );
            error_log( 'KIQ inventory-scan: video_url length = ' . strlen( $params['video_url'] ?? '' ) );
            error_log( 'KIQ inventory-scan: image_url length = ' . strlen( $params['image_url'] ?? '' ) );
        }

        // Accept a single image_url or a batch of image_urls.
        $raw_images = array();
        if ( isset( $params['image_urls'] ) && is_array( $params['image_urls'] ) ) {
            $raw_images = array_filter( $params['image_urls'] );
        }

        if ( ! empty( $params['image_url'] ) ) {
            $raw_images[] = $params['image_url'];
        }

        // Accept optional video_url(s) for frame extraction.
        $video_inputs = array();
        if ( isset( $params['video_urls'] ) && is_array( $params['video_urls'] ) ) {
            $video_inputs = array_filter( $params['video_urls'] );
        }

        if ( ! empty( $params['video_url'] ) ) {
            $video_inputs[] = $params['video_url'];
        }

        if ( ! empty( $video_inputs ) && ! self::is_video_scanning_enabled() ) {
            $has_ffmpeg = self::has_ffmpeg();
            return new WP_REST_Response( array(
                'error'      => 'Video scanning is not available. ' . ( $has_ffmpeg ? 'Please enable it in settings.' : 'Requires ffmpeg to be installed on the server.' ),
                'ffmpeg'     => $has_ffmpeg,
                'suggestion' => 'Please use photo scanning instead.',
            ), 400 );
        }

        if ( empty( $raw_images ) && empty( $video_inputs ) ) {
            return new WP_REST_Response( array(
                'error'        => 'Missing image_url/image_urls or video_url/video_urls parameter',
                'params_found' => array_keys( $params ?? array() ),
            ), 400 );
        }

        // Keep this small to reduce total processing time on shared hosting.
        $max_frames_per_video = 3;

        // Expand video inputs into frame data URIs
        foreach ( $video_inputs as $video_url ) {
            if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
                error_log( 'KIQ inventory-scan: extracting frames...' );
            }
            $sanitized_video = self::sanitize_video_input( $video_url );
            if ( is_wp_error( $sanitized_video ) ) {
                return new WP_REST_Response( array(
                    'error' => $sanitized_video->get_error_message(),
                ), 400 );
            }

            $frames = self::extract_frames_from_video( $sanitized_video, $max_frames_per_video );
            if ( is_wp_error( $frames ) ) {
                return new WP_REST_Response( array(
                    'error' => $frames->get_error_message(),
                ), 400 );
            }

            $raw_images = array_merge( $raw_images, $frames );
        }

        // Get optional audio transcription for enhanced scanning
        $audio_transcription = isset( $params['audio_transcription'] ) ? sanitize_textarea_field( $params['audio_transcription'] ) : '';

        $resp = self::process_vision_scan_from_raw_images( $user_id, $raw_images, $audio_transcription );
        if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
            error_log( sprintf( 'KIQ inventory-scan: complete in %.2fs', microtime( true ) - $t0 ) );
        }
        return $resp;
    }

    /**
     * Handle multipart video scanning (preferred strategy).
     * Expects a file upload field named "video".
     */
    public static function handle_inventory_scan_video( $request ) {
        $user_id = get_current_user_id();

        if ( function_exists( 'set_time_limit' ) ) {
            @set_time_limit( 180 );
        }

        $t0 = microtime( true );

        if ( ! self::is_video_scanning_enabled() ) {
            $has_ffmpeg = self::has_ffmpeg();
            return new WP_REST_Response( array(
                'error'      => 'Video scanning is not available. ' . ( $has_ffmpeg ? 'Please enable it in settings.' : 'Requires ffmpeg to be installed on the server.' ),
                'ffmpeg'     => $has_ffmpeg,
                'suggestion' => 'Please use photo scanning instead.',
            ), 400 );
        }

        $files = $request->get_file_params();
        if ( empty( $files['video'] ) ) {
            return new WP_REST_Response( array(
                'error' => 'No video file provided',
            ), 400 );
        }

        $video_file = $files['video'];
        if ( ! isset( $video_file['error'] ) || $video_file['error'] !== UPLOAD_ERR_OK ) {
            return new WP_REST_Response( array(
                'error' => 'File upload error: ' . ( $video_file['error'] ?? 'unknown' ),
            ), 400 );
        }

        // Basic validation
        $tmp_name = $video_file['tmp_name'] ?? '';
        if ( empty( $tmp_name ) || ! file_exists( $tmp_name ) ) {
            return new WP_REST_Response( array(
                'error' => 'Uploaded video file missing on server',
            ), 400 );
        }

        if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
            error_log( sprintf( 'KIQ inventory-scan-video: received upload size=%d tmp=%s', intval( $video_file['size'] ?? 0 ), $tmp_name ) );
        }

        // Optional transcription passed in by client (from /transcribe-audio)
        $audio_transcription = $request->get_param( 'audio_transcription' );
        $audio_transcription = is_string( $audio_transcription ) ? sanitize_textarea_field( $audio_transcription ) : '';

        $max_frames_per_video = 3;
        if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
            error_log( 'KIQ inventory-scan-video: extracting frames...' );
        }
        $frames = self::extract_frames_from_video( $tmp_name, $max_frames_per_video );
        if ( is_wp_error( $frames ) ) {
            return new WP_REST_Response( array(
                'error' => $frames->get_error_message(),
            ), 400 );
        }

        if ( empty( $frames ) ) {
            return new WP_REST_Response( array(
                'error' => 'Unable to extract frames from video for scanning.',
            ), 400 );
        }

        $resp = self::process_vision_scan_from_raw_images( $user_id, $frames, $audio_transcription );
        if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
            error_log( sprintf( 'KIQ inventory-scan-video: complete in %.2fs', microtime( true ) - $t0 ) );
        }
        return $resp;
    }

    /**
     * Shared implementation used by image scans and video (frame) scans.
     */
    private static function process_vision_scan_from_raw_images( $user_id, $raw_images, $audio_transcription = '' ) {
        $raw_images = is_array( $raw_images ) ? array_values( array_filter( $raw_images ) ) : array();

        if ( empty( $raw_images ) ) {
            return new WP_REST_Response( array(
                'error' => 'Missing image data',
            ), 400 );
        }

        $remaining_usage = KIQ_Features::get_remaining_usage( $user_id );
        $remaining_scans = intval( $remaining_usage['vision_scans_remaining'] ?? 0 );
        $requested_scans = count( $raw_images );

        if ( $remaining_scans <= 0 || $requested_scans > $remaining_scans ) {
            return new WP_REST_Response( array(
                'error'     => 'Vision scan limit reached',
                'remaining' => $remaining_usage,
            ), 429 );
        }

        if ( ! KIQ_Features::allows( $user_id, 'vision_scanning' ) ) {
            return new WP_REST_Response( array(
                'error' => 'Vision scanning not available on your plan',
            ), 403 );
        }

        $image_urls = array();
        foreach ( $raw_images as $raw_image ) {
            $sanitized = self::sanitize_image_input( $raw_image );
            if ( is_wp_error( $sanitized ) ) {
                return new WP_REST_Response( array(
                    'error' => $sanitized->get_error_message(),
                ), 400 );
            }
            $image_urls[] = $sanitized;
        }

        $scan_results  = array();
        $all_new_items = array();

        foreach ( $image_urls as $index => $image_url ) {
            // Only pass audio transcription to first frame to avoid duplication
            $transcription_for_frame = ( $index === 0 ) ? (string) $audio_transcription : '';
            $extraction              = KIQ_AI::extract_pantry_from_image( $user_id, $image_url, $transcription_for_frame );

            if ( is_wp_error( $extraction ) ) {
                return new WP_REST_Response( array(
                    'error' => $extraction->get_error_message(),
                ), 500 );
            }

            $new_items      = isset( $extraction['items'] ) ? $extraction['items'] : array();
            $all_new_items  = array_merge( $all_new_items, $new_items );
            $scan_results[] = array(
                'source'      => substr( $image_url, 0, 80 ),
                'items_found' => count( $new_items ),
                'summary'     => $extraction['summary'] ?? '',
            );
        }

        // Merge with existing inventory
        $existing_inventory = KIQ_Data::get_inventory( $user_id );
        $new_items          = $all_new_items;

        foreach ( $new_items as &$item ) {
            $item['id']       = wp_rand( 100000, 999999 );
            $item['added_at'] = current_time( 'mysql' );
            $item['category'] = $item['category'] ?? 'general';
        }

        $merged_inventory = array_merge( $existing_inventory, $new_items );
        KIQ_Data::save_inventory( $user_id, $merged_inventory );

        return new WP_REST_Response( array(
            'success'      => true,
            'items_added'  => count( $new_items ),
            'new_items'    => $new_items,
            'inventory'    => $merged_inventory,
            'scan_results' => $scan_results,
            'remaining'    => KIQ_Features::get_remaining_usage( $user_id ),
        ), 200 );
    }

    /**
     * Validate and sanitize an image input (data URI or URL)
     */
    private static function sanitize_image_input( $raw_image ) {
        if ( empty( $raw_image ) ) {
            return new WP_Error( 'invalid_image', 'Missing image data' );
        }

        if ( strpos( $raw_image, 'data:' ) === 0 ) {
            if ( preg_match( '#^data:image/(png|jpeg|jpg);base64,#i', $raw_image ) ) {
                return $raw_image;
            }

            return new WP_Error( 'invalid_image_format', 'Unsupported data URI image format' );
        }

        $image_url = esc_url_raw( $raw_image );
        if ( empty( $image_url ) ) {
            return new WP_Error( 'invalid_image_url', 'Invalid image URL' );
        }

        return $image_url;
    }

    /**
     * Parse and validate a barcode/QR payload
     */
    private static function sanitize_code_input( $raw_code ) {
        $code = sanitize_text_field( trim( (string) $raw_code ) );

        if ( empty( $code ) ) {
            return new WP_Error( 'invalid_code', 'Missing barcode or QR code payload' );
        }

        $parsed = self::extract_barcode_from_payload( $code );
        if ( ! $parsed ) {
            return new WP_Error( 'invalid_code', 'Unable to parse barcode/QR payload. Provide a numeric UPC/EAN or a URL containing it.' );
        }

        return $parsed;
    }

    /**
     * Extract numeric code from QR/barcode payload (raw string or URL)
     */
    private static function extract_barcode_from_payload( $payload ) {
        // Direct numeric payload
        if ( preg_match( '/\b(\d{8,18})\b/', $payload, $matches ) ) {
            return $matches[1];
        }

        // If it's a URL, try to grab any numeric segment
        if ( filter_var( $payload, FILTER_VALIDATE_URL ) ) {
            $path = parse_url( $payload, PHP_URL_PATH );
            if ( $path && preg_match( '/(\d{8,18})/', $path, $matches ) ) {
                return $matches[1];
            }
        }

        return false;
    }

    /**
     * Lookup product metadata from OpenFoodFacts using UPC/EAN code
     */
    private static function lookup_product_metadata( $code ) {
        $endpoint = sprintf( 'https://world.openfoodfacts.org/api/v2/product/%s.json', rawurlencode( $code ) );

        $response = wp_remote_get( $endpoint, array( 'timeout' => 15 ) );
        if ( is_wp_error( $response ) ) {
            return new WP_Error( 'lookup_failed', 'Unable to reach product lookup service.' );
        }

        $body_raw  = wp_remote_retrieve_body( $response );
        $body      = json_decode( $body_raw, true );
        $http_code = wp_remote_retrieve_response_code( $response );

        if ( empty( $body ) || $http_code >= 500 ) {
            return new WP_Error( 'lookup_failed', 'Invalid response from product lookup service.' );
        }

        if ( intval( $body['status'] ?? 0 ) !== 1 ) {
            return new WP_Error( 'product_not_found', 'No product found for this code.' );
        }

        $product = $body['product'] ?? array();

        return array(
            'code'       => $code,
            'name'       => sanitize_text_field( $product['product_name'] ?? $product['product_name_en'] ?? 'Unknown item' ),
            'brand'      => sanitize_text_field( $product['brands'] ?? '' ),
            'quantity'   => sanitize_text_field( $product['quantity'] ?? '' ),
            'categories' => isset( $product['categories_tags'] ) && is_array( $product['categories_tags'] ) ? $product['categories_tags'] : array(),
            'image'      => esc_url_raw( $product['image_front_url'] ?? $product['image_url'] ?? '' ),
            'nutriscore' => sanitize_text_field( $product['nutriscore_grade'] ?? '' ),
            'url'        => esc_url_raw( $product['url'] ?? '' ),
        );
    }

    /**
     * Build an inventory item structure from lookup metadata
     */
    private static function build_inventory_item_from_product( $product, $quantity = 1 ) {
        $category_from_tag = '';

        if ( ! empty( $product['categories'] ) && is_array( $product['categories'] ) ) {
            $category_from_tag = self::normalize_category_tag( $product['categories'][0] );
        }

        $category           = $category_from_tag ? $category_from_tag : 'general';
        $likely_perishable  = self::is_likely_perishable( $product['categories'] ?? array(), $product['name'] ?? '' );
        $estimated_days_good = $likely_perishable ? 7 : 60;

        $notes_parts = array( 'Added via code scan' );
        if ( ! empty( $product['brand'] ) ) {
            $notes_parts[] = 'Brand: ' . $product['brand'];
        }
        $notes_parts[] = 'Code: ' . $product['code'];

        return array(
            'id'                  => wp_rand( 100000, 999999 ),
            'added_at'            => current_time( 'mysql' ),
            'name'                => $product['name'] ?? 'Unknown item',
            'category'            => $category,
            'item_count'          => max( 1, intval( $quantity ) ),
            'quantity_estimate'   => 'full',
            'package_state'       => 'sealed',
            'freshness_label'     => 'fresh',
            'likely_perishable'   => $likely_perishable,
            'estimated_days_good' => $estimated_days_good,
            'notes'               => implode( ' | ', array_filter( $notes_parts ) ),
            'confidence'          => 0.9,
            'barcode'             => $product['code'],
            'image_url'           => $product['image'] ?? '',
        );
    }

    /**
     * Normalize category tag from OpenFoodFacts
     */
    private static function normalize_category_tag( $tag ) {
        $tag = preg_replace( '/^en:/', '', (string) $tag );
        $tag = str_replace( array( '-', '_' ), ' ', $tag );
        return sanitize_text_field( $tag );
    }

    /**
     * Heuristic to decide if product is perishable
     */
    private static function is_likely_perishable( $categories, $name ) {
        $haystack = strtolower( implode( ' ', (array) $categories ) . ' ' . $name );
        $keywords = array( 'produce', 'vegetable', 'fruit', 'meat', 'seafood', 'fish', 'poultry', 'dairy', 'fresh', 'cheese', 'yogurt' );

        foreach ( $keywords as $keyword ) {
            if ( strpos( $haystack, $keyword ) !== false ) {
                return true;
            }
        }

        return false;
    }

    /**
     * Validate and sanitize video URL input (data URI or URL)
     */
    private static function sanitize_video_input( $raw_video ) {
        if ( empty( $raw_video ) ) {
            return new WP_Error( 'invalid_video', 'Missing video data' );
        }

        // Handle data URIs - be flexible with video formats
        if ( strpos( $raw_video, 'data:' ) === 0 ) {
            // Accept any video/* MIME type
            if ( preg_match( '#^data:video/[a-z0-9._+-]+;base64,#i', $raw_video ) ) {
                return $raw_video;
            }

            // Log what we actually received for debugging
            if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
                $prefix = substr( $raw_video, 0, 50 );
                error_log( 'KIQ sanitize_video_input: data URI prefix = ' . $prefix );
            }

            return new WP_Error( 'invalid_video_format', 'Unsupported video data URI format. Expected video/* MIME type.' );
        }

        $video_url = esc_url_raw( $raw_video );
        if ( empty( $video_url ) ) {
            return new WP_Error( 'invalid_video_url', 'Invalid video URL' );
        }

        $path = parse_url( $video_url, PHP_URL_PATH );
        $ext  = $path ? strtolower( pathinfo( $path, PATHINFO_EXTENSION ) ) : '';
        $allowed = array( 'mp4', 'mov', 'm4v', 'webm' );
        if ( $ext && ! in_array( $ext, $allowed, true ) ) {
            return new WP_Error( 'invalid_video_format', 'Unsupported video format. Use mp4, mov, m4v, or webm.' );
        }

        return $video_url;
    }

    /**
     * Extract up to N frames from a video URL or data URI as data URIs for vision scanning.
     * Requires ffmpeg to be installed on the host.
     */
    private static function extract_frames_from_video( $video_url, $max_frames = 5 ) {
        if ( $max_frames < 1 ) {
            $max_frames = 1;
        }

        if ( ! self::has_ffmpeg() ) {
            return new WP_Error( 'ffmpeg_missing', 'Video scanning requires ffmpeg installed on the server. Please upload still photos instead.' );
        }

        // Handle data URI - save to temp file first
        if ( strpos( $video_url, 'data:' ) === 0 ) {
            if ( preg_match( '#^data:video/([a-z0-9._+-]+);base64,(.+)$#is', $video_url, $matches ) ) {
                $extension = strtolower( $matches[1] );
                // Map MIME subtypes to file extensions
                $ext_map = array(
                    'quicktime' => 'mov',
                    'x-m4v'     => 'm4v',
                    'x-matroska' => 'mkv',
                    '3gpp'      => '3gp',
                );
                if ( isset( $ext_map[ $extension ] ) ) {
                    $extension = $ext_map[ $extension ];
                }
                $data = base64_decode( $matches[2] );
                if ( $data === false ) {
                    return new WP_Error( 'invalid_video_data', 'Could not decode video data.' );
                }
                $tmp_file = tempnam( get_temp_dir(), 'kiq_video_' ) . '.' . $extension;
                file_put_contents( $tmp_file, $data );
                
                if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
                    error_log( 'KIQ extract_frames: saved temp file = ' . $tmp_file . ', size = ' . strlen( $data ) );
                }
            } else {
                if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
                    error_log( 'KIQ extract_frames: failed to match data URI, prefix = ' . substr( $video_url, 0, 60 ) );
                }
                return new WP_Error( 'invalid_video_format', 'Invalid video data URI format.' );
            }
        } else {
            // Local file path (e.g., uploaded tmp file) — preferred for reliability.
            if ( file_exists( $video_url ) && is_readable( $video_url ) ) {
                $tmp_file = $video_url;
            } else {
                $tmp_file = download_url( $video_url );
                if ( is_wp_error( $tmp_file ) || empty( $tmp_file ) ) {
                    return new WP_Error( 'video_download_failed', 'Unable to download video for scanning.' );
                }
            }
        }

        $output_dir = trailingslashit( get_temp_dir() );
        $output_base = tempnam( $output_dir, 'kiqframe' );
        if ( file_exists( $output_base ) ) {
            unlink( $output_base );
        }
        $output_pattern = $output_base . '-%02d.jpg';

        $command = sprintf(
            'ffmpeg -hide_banner -loglevel error -i %s -vf "fps=%d,scale=720:-1" -frames:v %d %s',
            escapeshellarg( $tmp_file ),
            max( 1, $max_frames ),
            intval( $max_frames ),
            escapeshellarg( $output_pattern )
        );

        exec( $command, $output_lines, $exit_code );

        $frame_glob = str_replace( '%02d', '*', $output_pattern );
        $frame_files = glob( $frame_glob );

        if ( $exit_code !== 0 || empty( $frame_files ) ) {
            // Only unlink if we created a temp file (avoid deleting uploaded tmp_name managed by PHP)
            if ( strpos( $video_url, 'data:' ) === 0 || filter_var( $video_url, FILTER_VALIDATE_URL ) ) {
                @unlink( $tmp_file );
            }
            return new WP_Error( 'video_frame_extract_failed', 'Unable to extract frames from video for scanning.' );
        }

        $frames = array();
        foreach ( $frame_files as $frame_file ) {
            $data = file_get_contents( $frame_file );
            if ( $data ) {
                $frames[] = 'data:image/jpeg;base64,' . base64_encode( $data );
            }
            @unlink( $frame_file );
        }

        if ( strpos( $video_url, 'data:' ) === 0 || filter_var( $video_url, FILTER_VALIDATE_URL ) ) {
            @unlink( $tmp_file );
        }

        return $frames;
    }

    /**
     * Determine if video scanning is enabled for this site/config.
     * Enabled by default if ffmpeg is available.
     */
    private static function is_video_scanning_enabled() {
        $enabled_env = getenv( 'KIQ_ENABLE_VIDEO_SCANNING' );

        // Check environment variable first (allows explicit disable)
        if ( $enabled_env !== false ) {
            return filter_var( $enabled_env, FILTER_VALIDATE_BOOLEAN );
        }

        // Check WordPress option
        $enabled_option = get_option( 'kiq_enable_video_scanning', null );
        if ( $enabled_option !== null ) {
            return (bool) $enabled_option;
        }

        // Default: enabled if ffmpeg is available
        return self::has_ffmpeg();
    }

    /**
     * Check if ffmpeg is installed
     */
    private static function has_ffmpeg() {
        // Try Windows first
        if ( strtoupper( substr( PHP_OS, 0, 3 ) ) === 'WIN' ) {
            $result = trim( (string) shell_exec( 'where ffmpeg 2>nul' ) );
        } else {
            // Unix/Linux/Mac
            $result = trim( (string) shell_exec( 'command -v ffmpeg 2>/dev/null' ) );
        }
        return ! empty( $result );
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
     * Handle audio transcription from video files using Whisper API
     */
    public static function handle_transcribe_audio( $request ) {
        $user_id = get_current_user_id();

        // Check if files were uploaded
        $files = $request->get_file_params();
        if ( empty( $files['video'] ) ) {
            return new WP_REST_Response( array(
                'error' => 'No video file provided',
            ), 400 );
        }

        $video_file = $files['video'];

        // Validate file
        if ( $video_file['error'] !== UPLOAD_ERR_OK ) {
            return new WP_REST_Response( array(
                'error' => 'File upload error: ' . $video_file['error'],
            ), 400 );
        }

        // Check file size (max 25MB for Whisper API)
        $max_size = 25 * 1024 * 1024;
        if ( $video_file['size'] > $max_size ) {
            return new WP_REST_Response( array(
                'error' => 'Video file too large for audio transcription. Maximum 25MB.',
            ), 400 );
        }

        // Extract audio and transcribe using Whisper
        $transcription = self::transcribe_video_audio( $video_file['tmp_name'] );

        if ( is_wp_error( $transcription ) ) {
            return new WP_REST_Response( array(
                'error'         => $transcription->get_error_message(),
                'transcription' => '',
            ), 200 ); // Return 200 so frontend can continue with video-only scan
        }

        return new WP_REST_Response( array(
            'success'       => true,
            'transcription' => $transcription,
        ), 200 );
    }

    /**
     * Extract audio from video and transcribe using OpenAI Whisper API
     */
    private static function transcribe_video_audio( $video_path ) {
        if ( ! KIQ_API_KEY || empty( KIQ_API_KEY ) ) {
            return new WP_Error( 'missing_api_key', 'OpenAI API key not configured' );
        }

        // Check if ffmpeg is available for audio extraction
        if ( ! self::has_ffmpeg() ) {
            return new WP_Error( 'ffmpeg_missing', 'Audio extraction requires ffmpeg' );
        }

        // Extract audio to temporary file
        $audio_file = tempnam( get_temp_dir(), 'kiq_audio_' ) . '.mp3';
        $command    = sprintf(
            'ffmpeg -hide_banner -loglevel error -i %s -vn -acodec libmp3lame -ar 16000 -ac 1 -b:a 64k %s',
            escapeshellarg( $video_path ),
            escapeshellarg( $audio_file )
        );

        exec( $command, $output_lines, $exit_code );

        if ( $exit_code !== 0 || ! file_exists( $audio_file ) ) {
            @unlink( $audio_file );
            return new WP_Error( 'audio_extraction_failed', 'Could not extract audio from video' );
        }

        // Check audio file size
        $audio_size = filesize( $audio_file );
        if ( $audio_size < 1000 ) {
            // Audio file too small, likely no audio track
            @unlink( $audio_file );
            return new WP_Error( 'no_audio', 'Video has no audio track' );
        }

        // Call Whisper API
        $boundary = wp_generate_password( 24, false );
        $body     = '';

        // Add file
        $body .= "--{$boundary}\r\n";
        $body .= "Content-Disposition: form-data; name=\"file\"; filename=\"audio.mp3\"\r\n";
        $body .= "Content-Type: audio/mpeg\r\n\r\n";
        $body .= file_get_contents( $audio_file );
        $body .= "\r\n";

        // Add model
        $body .= "--{$boundary}\r\n";
        $body .= "Content-Disposition: form-data; name=\"model\"\r\n\r\n";
        $body .= "whisper-1\r\n";

        // Add prompt for better food-related transcription
        $body .= "--{$boundary}\r\n";
        $body .= "Content-Disposition: form-data; name=\"prompt\"\r\n\r\n";
        $body .= "This is someone describing food items in their pantry, fridge, or freezer. They may mention grocery items, produce, beverages, condiments, and quantities.\r\n";

        $body .= "--{$boundary}--\r\n";

        $response = wp_remote_post(
            'https://api.openai.com/v1/audio/transcriptions',
            array(
                'headers' => array(
                    'Authorization' => 'Bearer ' . KIQ_API_KEY,
                    'Content-Type'  => 'multipart/form-data; boundary=' . $boundary,
                ),
                'body'    => $body,
                'timeout' => 60,
            )
        );

        // Clean up audio file
        @unlink( $audio_file );

        if ( is_wp_error( $response ) ) {
            return new WP_Error( 'whisper_api_error', $response->get_error_message() );
        }

        $status_code = wp_remote_retrieve_response_code( $response );
        $body_text   = wp_remote_retrieve_body( $response );
        $data        = json_decode( $body_text, true );

        if ( $status_code !== 200 ) {
            $error_msg = isset( $data['error']['message'] ) ? $data['error']['message'] : 'Whisper API error';
            return new WP_Error( 'whisper_api_error', $error_msg );
        }

        return isset( $data['text'] ) ? trim( $data['text'] ) : '';
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
            'video_scanning' => array(
                'enabled'  => self::is_video_scanning_enabled(),
                'ffmpeg'   => self::has_ffmpeg(),
                'note'     => 'Video inputs are converted to still frames; OpenAI API consumes images only.',
            ),
            'code_lookup' => array(
                'provider' => 'OpenFoodFacts',
                'endpoint' => 'https://world.openfoodfacts.org/api/v2/product/{code}.json',
            ),
        );

        return new WP_REST_Response( $diagnostics, 200 );
    }
}

// Initialize REST API
KIQ_REST::init();
