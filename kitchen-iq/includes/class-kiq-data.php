<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Data access layer - handles all database operations
 */
class KIQ_Data {

    /**
     * Get user profile (preferences)
     */
    public static function get_profile( $user_id ) {
        $raw = get_user_meta( $user_id, 'kiq_profile', true );
        return $raw ? json_decode( $raw, true ) : array();
    }

    /**
     * Save user profile
     */
    public static function save_profile( $user_id, $profile ) {
        update_user_meta( $user_id, 'kiq_profile', wp_json_encode( $profile ) );
    }

    /**
     * Get pantry inventory
     */
    public static function get_inventory( $user_id ) {
        $raw = get_user_meta( $user_id, 'kiq_inventory', true );
        return $raw ? json_decode( $raw, true ) : array();
    }

    /**
     * Save pantry inventory
     */
    public static function save_inventory( $user_id, $inventory ) {
        update_user_meta( $user_id, 'kiq_inventory', wp_json_encode( $inventory ) );
    }

    /**
     * Live assist conversation thread (lightweight) stored in usermeta.
     */
    public static function get_live_thread( $user_id ) {
        $raw = get_user_meta( $user_id, 'kiq_live_thread', true );
        if ( ! $raw ) {
            return array();
        }
        $decoded = json_decode( $raw, true );
        return is_array( $decoded ) ? $decoded : array();
    }

    public static function append_live_message( $user_id, $message ) {
        if ( ! is_array( $message ) ) {
            return;
        }

        $thread   = self::get_live_thread( $user_id );
        $message['ts'] = current_time( 'mysql' );

        $thread[] = $message;

        // Keep last 30 entries to cap storage
        if ( count( $thread ) > 30 ) {
            $thread = array_slice( $thread, -30 );
        }

        update_user_meta( $user_id, 'kiq_live_thread', wp_json_encode( $thread ) );
    }

    /**
     * Save meal plan to history
     */
    public static function save_meal_history( $user_id, $plan_type, $meals, $shopping_list ) {
        global $wpdb;
        $table_name = $wpdb->prefix . 'kiq_meal_history';

        $meals_json = wp_json_encode( $meals );
        if ( false === $meals_json ) {
            return new WP_Error( 'kiq_meal_history_encode_failed', 'Failed to encode meals for storage.' );
        }

        $shopping_list_json = wp_json_encode( $shopping_list );
        if ( false === $shopping_list_json ) {
            return new WP_Error( 'kiq_shopping_list_encode_failed', 'Failed to encode shopping list for storage.' );
        }

        $wpdb->insert(
            $table_name,
            array(
                'user_id'             => $user_id,
                'created_at'          => current_time( 'mysql' ),
                'plan_type'           => $plan_type,
                'meals_json'          => $meals_json,
                'shopping_list_json'  => $shopping_list_json,
            ),
            array(
                '%d',
                '%s',
                '%s',
                '%s',
                '%s',
            )
        );

        $insert_id = $wpdb->insert_id;

        if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
            if ( $insert_id ) {
                error_log( sprintf( 'KIQ: save_meal_history success - user_id=%d record_id=%s plan_type=%s meals_len=%d', intval( $user_id ), $insert_id, esc_html( $plan_type ), strlen( $meals_json ) ) );
            } else {
                error_log( sprintf( 'KIQ: save_meal_history FAILED - user_id=%d plan_type=%s wp_error=%s', intval( $user_id ), esc_html( $plan_type ), $wpdb->last_error ) );
            }
        }

        return $insert_id;
    }

    /**
     * Get user plan tier
     */
    public static function get_user_plan( $user_id ) {
        return get_user_meta( $user_id, 'kiq_user_plan_type', true ) ?: 'free';
    }

    /**
     * Set user plan tier
     */
    public static function set_user_plan( $user_id, $plan ) {
        update_user_meta( $user_id, 'kiq_user_plan_type', $plan );
    }

    /**
     * Get meal preferences (ratings)
     */
    public static function get_meal_preferences( $user_id ) {
        global $wpdb;
        $table_name = $wpdb->prefix . 'kiq_meal_ratings';

        $results = $wpdb->get_results(
            $wpdb->prepare(
                "SELECT meal_key, preference FROM {$table_name} WHERE user_id = %d AND preference != 'never'",
                $user_id
            )
        );

        $preferences = array(
            'often'     => array(),
            'sometimes' => array(),
            'rarely'    => array(),
        );

        foreach ( $results as $result ) {
            $preferences[ $result->preference ][] = $result->meal_key;
        }

        return $preferences;
    }

    /**
     * Save meal rating
     */
    public static function save_meal_rating( $user_id, $meal_key, $stars, $preference, $notes = '' ) {
        global $wpdb;
        $table_name = $wpdb->prefix . 'kiq_meal_ratings';

        $existing = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT id FROM {$table_name} WHERE user_id = %d AND meal_key = %s",
                $user_id,
                $meal_key
            )
        );

        if ( $existing ) {
            $wpdb->update(
                $table_name,
                array(
                    'stars'      => $stars,
                    'preference' => $preference,
                    'notes'      => $notes,
                    'updated_at' => current_time( 'mysql' ),
                ),
                array(
                    'user_id'   => $user_id,
                    'meal_key'  => $meal_key,
                ),
                array( '%d', '%s', '%s', '%s' ),
                array( '%d', '%s' )
            );

            return $existing->id;
        }

        $wpdb->insert(
            $table_name,
            array(
                'user_id'    => $user_id,
                'meal_key'   => $meal_key,
                'stars'      => $stars,
                'preference' => $preference,
                'notes'      => $notes,
                'updated_at' => current_time( 'mysql' ),
            ),
            array( '%d', '%s', '%d', '%s', '%s', '%s' )
        );

        return $wpdb->insert_id;
    }

    /**
     * Get or create usage record for user's week
     */
    public static function get_week_usage( $user_id ) {
        global $wpdb;
        $table_name = $wpdb->prefix . 'kiq_usage';

        $week_start = date( 'Y-m-d', strtotime( 'monday this week' ) );

        $usage = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT * FROM {$table_name} WHERE user_id = %d AND week_start_date = %s",
                $user_id,
                $week_start
            )
        );

        if ( ! $usage ) {
            $wpdb->insert(
                $table_name,
                array(
                    'user_id'              => $user_id,
                    'week_start_date'      => $week_start,
                    'meals_requested_count' => 0,
                    'vision_scans_count'   => 0,
                ),
                array( '%d', '%s', '%d', '%d' )
            );

            return $wpdb->get_row(
                $wpdb->prepare(
                    "SELECT * FROM {$table_name} WHERE user_id = %d AND week_start_date = %s",
                    $user_id,
                    $week_start
                )
            );
        }

        return $usage;
    }

    /**
     * Increment meal request count for user's week
     */
    public static function increment_meal_count( $user_id ) {
        global $wpdb;
        $table_name = $wpdb->prefix . 'kiq_usage';

        $week_start = date( 'Y-m-d', strtotime( 'monday this week' ) );

        $wpdb->query(
            $wpdb->prepare(
                "UPDATE {$table_name} SET meals_requested_count = meals_requested_count + 1 WHERE user_id = %d AND week_start_date = %s",
                $user_id,
                $week_start
            )
        );
    }

    /**
     * Increment vision scan count for user's month
     */
    public static function increment_vision_scans( $user_id ) {
        global $wpdb;
        $table_name = $wpdb->prefix . 'kiq_usage';

        $month_start = date( 'Y-m-01' );

        // Get usage for this month
        $usage = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT * FROM {$table_name} WHERE user_id = %d AND week_start_date >= %s ORDER BY week_start_date DESC LIMIT 1",
                $user_id,
                $month_start
            )
        );

        if ( ! $usage ) {
            // Create new record for this month
            $wpdb->insert(
                $table_name,
                array(
                    'user_id'              => $user_id,
                    'week_start_date'      => date( 'Y-m-d' ),
                    'meals_requested_count' => 0,
                    'vision_scans_count'   => 1,
                ),
                array( '%d', '%s', '%d', '%d' )
            );
        } else {
            $wpdb->update(
                $table_name,
                array( 'vision_scans_count' => $usage->vision_scans_count + 1 ),
                array( 'id' => $usage->id ),
                array( '%d' ),
                array( '%d' )
            );
        }
    }

    /**
     * Refresh inventory status based on time and perishability
     */
    public static function refresh_inventory_status( $user_id ) {
        $inventory = self::get_inventory( $user_id );

        if ( empty( $inventory ) ) {
            return;
        }

        $updated = false;

        foreach ( $inventory as &$item ) {
            if ( ! isset( $item['perishability_days'] ) ) {
                continue;
            }

            $added_at = isset( $item['added_at'] ) ? strtotime( $item['added_at'] ) : time();
            $expiry   = $added_at + ( $item['perishability_days'] * DAY_IN_SECONDS );
            $now      = time();

            // Calculate days since expiry
            $days_since_expiry = ( $now - $expiry ) / DAY_IN_SECONDS;

            if ( $days_since_expiry > 0 ) {
                // Past expiry
                if ( $days_since_expiry > 1 ) {
                    $item['status'] = 'expired';
                } else {
                    $item['status'] = 'nearing';
                }
            } elseif ( $days_since_expiry > -1 ) {
                // Within 1 day of expiry
                $item['status'] = 'nearing';
            } else {
                $item['status'] = 'fresh';
            }

            $updated = true;
        }

        if ( $updated ) {
            self::save_inventory( $user_id, $inventory );
        }
    }

    /**
     * Apply meal consumption to inventory (decrement spice/flour levels)
     */
    public static function apply_meal_to_inventory( $user_id, $meals ) {
        $inventory = self::get_inventory( $user_id );

        if ( empty( $inventory ) || empty( $meals ) ) {
            if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
                error_log( sprintf( 'KIQ: apply_meal_to_inventory no-op - user_id=%d inventory_count=%d meals_count=%d', intval( $user_id ), is_array( $inventory ) ? count( $inventory ) : 0, is_array( $meals ) ? count( $meals ) : 0 ) );
            }

            return;
        }

        // Simple decrement map for pantry items
        $decrement_map = array(
            'low'    => 1,
            'medium' => 2,
            'high'   => 3,
        );

        $levels = array( 'full', 'three_quarters', 'half', 'quarter', 'almost_gone', 'empty' );

        // Build a map of ingredients used in meals
        $ingredients_used = array();

        foreach ( $meals as $meal ) {
            if ( isset( $meal['uses_existing_ingredients'] ) ) {
                foreach ( $meal['uses_existing_ingredients'] as $ingredient ) {
                    $key = is_array( $ingredient ) ? ( $ingredient['name'] ?? '' ) : $ingredient;
                    $usage = is_array( $ingredient ) ? ( $ingredient['usage'] ?? 'low' ) : 'low';

                    if ( ! isset( $ingredients_used[ $key ] ) ) {
                        $ingredients_used[ $key ] = $usage;
                    }
                }
            }
        }

        // Update inventory quantities
        foreach ( $inventory as &$item ) {
            $item_name = strtolower( trim( $item['name'] ?? '' ) );

            foreach ( $ingredients_used as $ingredient_name => $usage ) {
                if ( $item_name === strtolower( trim( $ingredient_name ) ) ) {
                    // Only decrement pantry/semi-permanent items
                    if ( isset( $item['permanence'] ) && in_array( $item['permanence'], array( 'semi', 'permanent' ), true ) ) {
                        if ( isset( $item['quantity_level'] ) ) {
                            $current_index = array_search( $item['quantity_level'], $levels, true );
                            if ( $current_index !== false ) {
                                $decrement = $decrement_map[ $usage ] ?? 1;
                                $new_index = min( $current_index + $decrement, count( $levels ) - 1 );
                                $item['quantity_level'] = $levels[ $new_index ];
                            }
                        }
                    }
                }
            }
        }

        self::save_inventory( $user_id, $inventory );

        if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
            error_log( sprintf( 'KIQ: apply_meal_to_inventory complete - user_id=%d inventory_count=%d', intval( $user_id ), count( $inventory ) ) );
        }
    }
}
