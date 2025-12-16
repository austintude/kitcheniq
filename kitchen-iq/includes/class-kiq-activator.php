<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * Activator class - handles plugin activation and database setup
 */
class KIQ_Activator {

    /**
     * Activate the plugin
     */
    public static function activate() {
        global $wpdb;

        // Create custom tables
        self::create_meal_history_table();
        self::create_meal_ratings_table();
        self::create_usage_tracking_table();

        // Set default options
        self::set_default_options();

        // Register PWA rewrites before flushing
        if ( class_exists( 'KIQ_Main' ) && method_exists( 'KIQ_Main', 'register_pwa_routes' ) ) {
            KIQ_Main::register_pwa_routes();
        } else {
            add_rewrite_rule( '^kitcheniq\\.webmanifest$', 'index.php?kiq_manifest=1', 'top' );
            add_rewrite_rule( '^kitcheniq-sw\\.js$', 'index.php?kiq_sw=1', 'top' );
        }

        flush_rewrite_rules();
    }

    /**
     * Deactivate the plugin
     */
    public static function deactivate() {
        flush_rewrite_rules();
    }

    /**
     * Create meal history table
     */
    private static function create_meal_history_table() {
        global $wpdb;

        $table_name      = $wpdb->prefix . 'kiq_meal_history';
        $charset_collate = $wpdb->get_charset_collate();

        $sql = "CREATE TABLE IF NOT EXISTS {$table_name} (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            user_id bigint(20) unsigned NOT NULL,
            created_at datetime NOT NULL,
            plan_type varchar(20) NOT NULL,
            meals_json longtext NOT NULL,
            shopping_list_json longtext NULL,
            PRIMARY KEY  (id),
            KEY user_id (user_id),
            KEY created_at (created_at)
        ) {$charset_collate};";

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        dbDelta( $sql );
    }

    /**
     * Create meal ratings table
     */
    private static function create_meal_ratings_table() {
        global $wpdb;

        $table_name      = $wpdb->prefix . 'kiq_meal_ratings';
        $charset_collate = $wpdb->get_charset_collate();

        $sql = "CREATE TABLE IF NOT EXISTS {$table_name} (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            user_id bigint(20) unsigned NOT NULL,
            meal_key varchar(191) NOT NULL,
            stars tinyint(1) NOT NULL,
            preference varchar(20) NOT NULL,
            notes text NULL,
            updated_at datetime NOT NULL,
            PRIMARY KEY  (id),
            KEY user_id (user_id),
            KEY meal_key (meal_key),
            UNIQUE KEY user_meal (user_id, meal_key)
        ) {$charset_collate};";

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        dbDelta( $sql );
    }

    /**
     * Create usage tracking table
     */
    private static function create_usage_tracking_table() {
        global $wpdb;

        $table_name      = $wpdb->prefix . 'kiq_usage';
        $charset_collate = $wpdb->get_charset_collate();

        $sql = "CREATE TABLE IF NOT EXISTS {$table_name} (
            id bigint(20) unsigned NOT NULL AUTO_INCREMENT,
            user_id bigint(20) unsigned NOT NULL,
            week_start_date date NOT NULL,
            meals_requested_count int(11) NOT NULL DEFAULT 0,
            vision_scans_count int(11) NOT NULL DEFAULT 0,
            PRIMARY KEY  (id),
            KEY user_id (user_id),
            UNIQUE KEY user_week (user_id, week_start_date)
        ) {$charset_collate};";

        require_once ABSPATH . 'wp-admin/includes/upgrade.php';
        dbDelta( $sql );
    }

    /**
     * Set default options
     */
    private static function set_default_options() {
        // General settings
        if ( ! get_option( 'kiq_default_plan_type' ) ) {
            update_option( 'kiq_default_plan_type', 'single' );
        }
        if ( ! get_option( 'kiq_default_substitution_mode' ) ) {
            update_option( 'kiq_default_substitution_mode', 'always' );
        }
        if ( ! get_option( 'kiq_inventory_confirm_limit' ) ) {
            update_option( 'kiq_inventory_confirm_limit', 3 );
        }

        // AI settings
        if ( ! get_option( 'kiq_ai_provider' ) ) {
            update_option( 'kiq_ai_provider', 'openai' );
        }
        if ( ! get_option( 'kiq_ai_text_model' ) ) {
            update_option( 'kiq_ai_text_model', 'gpt-4o-mini' );
        }
        if ( ! get_option( 'kiq_ai_vision_model' ) ) {
            update_option( 'kiq_ai_vision_model', 'gpt-4o-mini' );
        }
        if ( ! get_option( 'kiq_ai_temperature' ) ) {
            update_option( 'kiq_ai_temperature', '0.3' );
        }

        // Set default prompt blocks if they don't exist
        self::set_default_prompts();
    }

    /**
     * Set default prompt blocks
     */
    private static function set_default_prompts() {
        $system_base = 'You are an expert home cook and professional meal planner.

Your job is to create realistic, family friendly meal plans that:

- Use the ingredients the household already has in their pantry and fridge as much as possible.
- Respect their dietary restrictions, dislikes, cooking skill, and budget.
- Match the requested mood, such as light, comfort, cheesy, quick, or special.
- Avoid repeating the same main dish too often in a short period.
- Produce clear, step by step instructions a tired home cook can follow without guesswork.

Always try to minimize the number of new ingredients the person needs to buy.
Whenever possible, suggest safe and realistic substitutions using items already in the inventory.

You always respond with a single JSON object that strictly follows the response schema you are given.
You never include commentary, markdown, or extra text, only JSON.';

        if ( ! get_option( 'kiq_ai_meal_system_base' ) ) {
            update_option( 'kiq_ai_meal_system_base', $system_base );
        }

        $rules_block = 'Rules for meal planning:

- Prioritize using items already in the inventory, especially perishable items nearing expiration.
- Respect all dietary restrictions and dislikes without exception.
- Create recipes appropriate for the household\'s cooking skill level.
- Ensure recipes fit within the estimated time per meal.
- Vary meals to avoid repetition, especially in weekly plans.';

        if ( ! get_option( 'kiq_ai_meal_rules_block' ) ) {
            update_option( 'kiq_ai_meal_rules_block', $rules_block );
        }

        $subs_block = 'Substitution guidance:

- If substitution_mode is "always": aggressively suggest substitutions using existing pantry items to avoid buying new ingredients.
- If substitution_mode is "sometimes": suggest substitutions only when they are very natural and will not significantly change the dish.
- If substitution_mode is "never": do not suggest substitutions. Instead list missing ingredients in the shopping_list.';

        if ( ! get_option( 'kiq_ai_meal_substitutions_block' ) ) {
            update_option( 'kiq_ai_meal_substitutions_block', $subs_block );
        }
    }
}
