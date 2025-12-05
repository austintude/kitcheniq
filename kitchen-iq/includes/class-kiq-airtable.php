<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Airtable integration for analytics and logging
 */
class KIQ_Airtable {

    /**
     * Send meal history to Airtable for analytics
     */
    public static function send_meal_history( $record_id, $user_id, $plan_type, $meals, $shopping_list ) {
        if ( ! KIQ_AIRTABLE_API_KEY || ! KIQ_AIRTABLE_BASE_ID ) {
            return; // Skip if not configured
        }

        $endpoint = sprintf(
            'https://api.airtable.com/v0/%s/%s',
            rawurlencode( KIQ_AIRTABLE_BASE_ID ),
            rawurlencode( KIQ_AIRTABLE_TABLE_NAME )
        );

        $body = array(
            'records' => array(
                array(
                    'fields' => array(
                        'WPRecordID'           => $record_id,
                        'WPUserID'             => $user_id,
                        'PlanType'             => $plan_type,
                        'CreatedAt'            => current_time( 'mysql' ),
                        'MealCount'            => count( $meals ),
                        'MissingItemsCount'    => count( $shopping_list['missing_items'] ?? array() ),
                        'SubstitutionsCount'   => count( $shopping_list['suggested_substitutions'] ?? array() ),
                        'MealsJSON'            => wp_json_encode( $meals ),
                        'ShoppingJSON'         => wp_json_encode( $shopping_list ),
                    ),
                ),
            ),
        );

        $args = array(
            'headers' => array(
                'Authorization' => 'Bearer ' . KIQ_AIRTABLE_API_KEY,
                'Content-Type'  => 'application/json',
            ),
            'body'    => wp_json_encode( $body ),
            'timeout' => 10,
        );

        $response = wp_remote_post( $endpoint, $args );

        // Log errors but don't break user flow
        if ( is_wp_error( $response ) ) {
            error_log( 'KitchenIQ Airtable error: ' . $response->get_error_message() );
        }
    }

    /**
     * Log AI request for analytics
     */
    public static function log_ai_request( $user_id, $plan_type, $tokens_used, $cost ) {
        if ( ! KIQ_AIRTABLE_API_KEY || ! KIQ_AIRTABLE_BASE_ID ) {
            return;
        }

        // Implement similar logic to send_meal_history but for different Airtable table
        // For now, just store locally via WP options or custom logging
        $log_entry = array(
            'user_id'    => $user_id,
            'plan_type'  => $plan_type,
            'tokens'     => $tokens_used,
            'cost'       => $cost,
            'timestamp'  => current_time( 'mysql' ),
        );

        // You could store these in a log option or a custom table
    }
}
