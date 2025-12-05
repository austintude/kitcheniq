<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Feature gating and tier-based permissions
 */
class KIQ_Features {

    /**
     * Check if user has access to a feature based on their tier
     */
    public static function allows( $user_id, $feature ) {
        $user_plan = KIQ_Data::get_user_plan( $user_id );
        
        $feature_tiers = array(
            'meal_planning'        => array( 'free', 'basic', 'pro' ),
            'vision_scanning'      => array( 'free', 'basic', 'pro' ),
            'perishability'        => array( 'basic', 'pro' ),
            'substitutions'        => array( 'basic', 'pro' ),
            'meal_ratings'         => array( 'basic', 'pro' ),
            'shopping_optimization'=> array( 'basic', 'pro' ),
            'multi_user'           => array( 'pro' ),
            'custom_preferences'   => array( 'pro' ),
        );

        if ( ! isset( $feature_tiers[ $feature ] ) ) {
            return false;
        }

        return in_array( $user_plan, $feature_tiers[ $feature ], true );
    }

    /**
     * Check if user has exceeded their weekly meal limit
     */
    public static function can_generate_meal( $user_id ) {
        $user_plan = KIQ_Data::get_user_plan( $user_id );
        $limits    = self::get_tier_limits( $user_plan );
        $used      = KIQ_Data::get_week_usage( $user_id );

        return $used['meals'] < $limits['meals_per_week'];
    }

    /**
     * Check if user can scan pantry (vision)
     */
    public static function can_scan_pantry( $user_id ) {
        $user_plan = KIQ_Data::get_user_plan( $user_id );
        $limits    = self::get_tier_limits( $user_plan );
        $used      = KIQ_Data::get_week_usage( $user_id );

        return $used['vision_scans'] < $limits['vision_scans_per_week'];
    }

    /**
     * Get tier limits
     */
    public static function get_tier_limits( $tier ) {
        $defaults = array(
            'free'  => array(
                'meals_per_week'     => 1,
                'vision_scans_per_week' => 1,
            ),
            'basic' => array(
                'meals_per_week'     => 5,
                'vision_scans_per_week' => 4,
            ),
            'pro'   => array(
                'meals_per_week'     => 999,
                'vision_scans_per_week' => 999,
            ),
        );

        // Allow customization via admin settings
        $custom_limits = get_option( 'kiq_tier_limits', array() );
        
        if ( isset( $custom_limits[ $tier ] ) ) {
            return $custom_limits[ $tier ];
        }

        return $defaults[ $tier ] ?? $defaults['free'];
    }

    /**
     * Get remaining usage for user
     */
    public static function get_remaining_usage( $user_id ) {
        $user_plan = KIQ_Data::get_user_plan( $user_id );
        $limits    = self::get_tier_limits( $user_plan );
        $used      = KIQ_Data::get_week_usage( $user_id );

        return array(
            'meals_remaining'        => max( 0, $limits['meals_per_week'] - $used['meals'] ),
            'vision_scans_remaining' => max( 0, $limits['vision_scans_per_week'] - $used['vision_scans'] ),
            'plan'                   => $user_plan,
        );
    }

    /**
     * Assemble meal generation prompt based on user's tier
     */
    public static function get_meal_prompt_for_tier( $user_id ) {
        $user_plan = KIQ_Data::get_user_plan( $user_id );
        $blocks    = array();

        // Always include base prompt
        $blocks[] = get_option( 'kiq_ai_meal_system_base', '' );
        $blocks[] = get_option( 'kiq_ai_meal_rules_block', '' );
        $blocks[] = get_option( 'kiq_ai_meal_schema_block', '' );

        // Add optional blocks based on tier
        if ( in_array( $user_plan, array( 'basic', 'pro' ), true ) ) {
            $blocks[] = get_option( 'kiq_ai_meal_ratings_block', '' );
            $blocks[] = get_option( 'kiq_ai_meal_substitutions_block', '' );
            $blocks[] = get_option( 'kiq_ai_meal_perishability_block', '' );
        }

        if ( $user_plan === 'pro' ) {
            $blocks[] = get_option( 'kiq_ai_meal_quantity_level_block', '' );
        }

        $blocks[] = get_option( 'kiq_ai_meal_output_safety_block', '' );

        return implode( "\n\n", array_filter( $blocks ) );
    }

    /**
     * Should we ask user to confirm perishable items manually?
     */
    public static function should_ask_perishable_confirmation( $user_id ) {
        $user_plan = KIQ_Data::get_user_plan( $user_id );
        
        // Only Basic and Pro users get automated perishability
        return ! in_array( $user_plan, array( 'basic', 'pro' ), true );
    }

    /**
     * Get allowed substitution options based on tier
     */
    public static function get_substitution_config( $user_id ) {
        $user_plan = KIQ_Data::get_user_plan( $user_id );

        $config = array(
            'allow_substitutions'      => in_array( $user_plan, array( 'basic', 'pro' ), true ),
            'user_can_override'        => in_array( $user_plan, array( 'pro' ), true ),
            'show_alternatives'        => 2,
            'show_health_warnings'     => in_array( $user_plan, array( 'pro' ), true ),
        );

        return $config;
    }
}
