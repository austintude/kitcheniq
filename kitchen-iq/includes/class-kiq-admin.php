<?php

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

/**
 * WordPress admin settings panel for KitchenIQ
 */
class KIQ_Admin {

    public static function init() {
        add_action( 'admin_menu', array( __CLASS__, 'add_admin_menu' ) );
        add_action( 'admin_init', array( __CLASS__, 'register_settings' ) );
    }

    public static function add_admin_menu() {
        add_menu_page(
            'KitchenIQ Settings',
            'KitchenIQ',
            'manage_options',
            'kitcheniq',
            array( __CLASS__, 'render_main_page' ),
            'dashicons-restaurant',
            6
        );

        add_submenu_page(
            'kitcheniq',
            'General Settings',
            'General',
            'manage_options',
            'kitcheniq',
            array( __CLASS__, 'render_main_page' )
        );

        add_submenu_page(
            'kitcheniq',
            'AI Settings',
            'AI Settings',
            'manage_options',
            'kitcheniq-ai',
            array( __CLASS__, 'render_ai_settings' )
        );

        add_submenu_page(
            'kitcheniq',
            'Prompt Blocks',
            'Prompts',
            'manage_options',
            'kitcheniq-prompts',
            array( __CLASS__, 'render_prompts' )
        );

        add_submenu_page(
            'kitcheniq',
            'Perishability Rules',
            'Perishability',
            'manage_options',
            'kitcheniq-perishability',
            array( __CLASS__, 'render_perishability' )
        );

        add_submenu_page(
            'kitcheniq',
            'Debug & Logs',
            'Debug',
            'manage_options',
            'kitcheniq-debug',
            array( __CLASS__, 'render_debug' )
        );
    }

    public static function register_settings() {
        // General Settings
        register_setting( 'kitcheniq_general', 'kiq_default_plan_type' );
        register_setting( 'kitcheniq_general', 'kiq_inventory_confirm_limit' );

        add_settings_section(
            'kitcheniq_general_section',
            'KitchenIQ General Settings',
            array( __CLASS__, 'render_general_section' ),
            'kitcheniq_general'
        );

        add_settings_field(
            'kiq_default_plan_type',
            'Default Meal Plan Type',
            array( __CLASS__, 'render_field_default_plan_type' ),
            'kitcheniq_general',
            'kitcheniq_general_section'
        );

        add_settings_field(
            'kiq_inventory_confirm_limit',
            'Max Inventory Questions Per Session',
            array( __CLASS__, 'render_field_inventory_confirm_limit' ),
            'kitcheniq_general',
            'kitcheniq_general_section'
        );

        // AI Settings
        register_setting( 'kitcheniq_ai', 'kiq_ai_text_model' );
        register_setting( 'kitcheniq_ai', 'kiq_ai_vision_model' );
        register_setting( 'kitcheniq_ai', 'kiq_ai_temperature' );
        register_setting( 'kitcheniq_ai', 'kiq_ai_max_tokens' );
        register_setting( 'kitcheniq_ai', 'kiq_enable_ai_logging' );

        add_settings_section(
            'kitcheniq_ai_section',
            'AI Provider Settings',
            array( __CLASS__, 'render_ai_section_info' ),
            'kitcheniq_ai'
        );

        add_settings_field(
            'kiq_ai_text_model',
            'Text Model',
            array( __CLASS__, 'render_field_text_model' ),
            'kitcheniq_ai',
            'kitcheniq_ai_section'
        );

        add_settings_field(
            'kiq_ai_vision_model',
            'Vision Model',
            array( __CLASS__, 'render_field_vision_model' ),
            'kitcheniq_ai',
            'kitcheniq_ai_section'
        );

        add_settings_field(
            'kiq_ai_temperature',
            'Temperature (0.0-2.0)',
            array( __CLASS__, 'render_field_temperature' ),
            'kitcheniq_ai',
            'kitcheniq_ai_section'
        );

        add_settings_field(
            'kiq_ai_max_tokens',
            'Max Tokens Per Request',
            array( __CLASS__, 'render_field_max_tokens' ),
            'kitcheniq_ai',
            'kitcheniq_ai_section'
        );

        add_settings_field(
            'kiq_enable_ai_logging',
            'Enable AI Request Logging',
            array( __CLASS__, 'render_field_enable_logging' ),
            'kitcheniq_ai',
            'kitcheniq_ai_section'
        );

        // Prompt Blocks
        register_setting( 'kitcheniq_prompts', 'kiq_ai_meal_system_base' );
        register_setting( 'kitcheniq_prompts', 'kiq_ai_meal_rules_block' );
        register_setting( 'kitcheniq_prompts', 'kiq_ai_meal_schema_block' );
        register_setting( 'kitcheniq_prompts', 'kiq_ai_meal_ratings_block' );
        register_setting( 'kitcheniq_prompts', 'kiq_ai_meal_substitutions_block' );
        register_setting( 'kitcheniq_prompts', 'kiq_ai_meal_perishability_block' );
        register_setting( 'kitcheniq_prompts', 'kiq_ai_meal_quantity_level_block' );
        register_setting( 'kitcheniq_prompts', 'kiq_ai_meal_output_safety_block' );
        register_setting( 'kitcheniq_prompts', 'kiq_ai_vision_prompt' );

        // Perishability Rules
        register_setting( 'kitcheniq_perishability', 'kiq_perishability_rules' );

        // Debug
        register_setting( 'kitcheniq_debug', 'kiq_debug_mode' );
    }

    public static function render_main_page() {
        ?>
        <div class="wrap">
            <h1><?php esc_html_e( 'KitchenIQ Settings', 'kitchen-iq' ); ?></h1>
            
            <form method="post" action="options.php">
                <?php
                settings_fields( 'kitcheniq_general' );
                do_settings_sections( 'kitcheniq_general' );
                submit_button();
                ?>
            </form>

            <hr style="margin-top: 40px;" />

            <h2><?php esc_html_e( 'Pricing Tiers', 'kitchen-iq' ); ?></h2>
            <table class="widefat">
                <thead>
                    <tr>
                        <th>Tier</th>
                        <th>Meals/Week</th>
                        <th>Vision Scans/Week</th>
                        <th>Features</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><strong>Free</strong></td>
                        <td>1</td>
                        <td>1</td>
                        <td>Basic meal planning</td>
                    </tr>
                    <tr>
                        <td><strong>Basic ($5.99/mo)</strong></td>
                        <td>5</td>
                        <td>4</td>
                        <td>Perishability, Ratings, Substitutions</td>
                    </tr>
                    <tr>
                        <td><strong>Pro ($12.99/mo)</strong></td>
                        <td>Unlimited</td>
                        <td>Unlimited</td>
                        <td>All features, Multi-user</td>
                    </tr>
                </tbody>
            </table>
        </div>
        <?php
    }

    public static function render_ai_settings() {
        ?>
        <div class="wrap">
            <h1><?php esc_html_e( 'AI Settings', 'kitchen-iq' ); ?></h1>
            
            <form method="post" action="options.php">
                <?php
                settings_fields( 'kitcheniq_ai' );
                do_settings_sections( 'kitcheniq_ai' );
                submit_button();
                ?>
            </form>

            <div style="background: #f5f5f5; padding: 15px; margin-top: 20px; border-radius: 5px;">
                <p><strong>Note:</strong> OpenAI API key is stored as environment variable KIQ_API_KEY for security.</p>
                <p>Add to your .env or server environment: <code>KIQ_API_KEY=sk-...</code></p>
            </div>
        </div>
        <?php
    }

    public static function render_prompts() {
        ?>
        <div class="wrap">
            <h1><?php esc_html_e( 'Meal Planning Prompts', 'kitchen-iq' ); ?></h1>
            
            <form method="post" action="options.php">
                <?php
                settings_fields( 'kitcheniq_prompts' );
                ?>

                <h2><?php esc_html_e( 'System Prompt (Base)', 'kitchen-iq' ); ?></h2>
                <textarea name="kiq_ai_meal_system_base" rows="8" cols="80" class="large-text"><?php echo esc_textarea( get_option( 'kiq_ai_meal_system_base' ) ); ?></textarea>
                <p class="description">Core system instructions for meal planning AI</p>

                <h2><?php esc_html_e( 'Rules Block', 'kitchen-iq' ); ?></h2>
                <textarea name="kiq_ai_meal_rules_block" rows="8" cols="80" class="large-text"><?php echo esc_textarea( get_option( 'kiq_ai_meal_rules_block' ) ); ?></textarea>
                <p class="description">Additional rules and constraints</p>

                <h2><?php esc_html_e( 'Schema Block', 'kitchen-iq' ); ?></h2>
                <textarea name="kiq_ai_meal_schema_block" rows="6" cols="80" class="large-text"><?php echo esc_textarea( get_option( 'kiq_ai_meal_schema_block' ) ); ?></textarea>
                <p class="description">JSON schema expectations (read-only via UI)</p>

                <h2><?php esc_html_e( 'Ratings Block (Basic+)', 'kitchen-iq' ); ?></h2>
                <textarea name="kiq_ai_meal_ratings_block" rows="6" cols="80" class="large-text"><?php echo esc_textarea( get_option( 'kiq_ai_meal_ratings_block' ) ); ?></textarea>

                <h2><?php esc_html_e( 'Substitutions Block (Basic+)', 'kitchen-iq' ); ?></h2>
                <textarea name="kiq_ai_meal_substitutions_block" rows="6" cols="80" class="large-text"><?php echo esc_textarea( get_option( 'kiq_ai_meal_substitutions_block' ) ); ?></textarea>

                <h2><?php esc_html_e( 'Perishability Block (Basic+)', 'kitchen-iq' ); ?></h2>
                <textarea name="kiq_ai_meal_perishability_block" rows="6" cols="80" class="large-text"><?php echo esc_textarea( get_option( 'kiq_ai_meal_perishability_block' ) ); ?></textarea>

                <h2><?php esc_html_e( 'Quantity Level Block (Pro)', 'kitchen-iq' ); ?></h2>
                <textarea name="kiq_ai_meal_quantity_level_block" rows="6" cols="80" class="large-text"><?php echo esc_textarea( get_option( 'kiq_ai_meal_quantity_level_block' ) ); ?></textarea>

                <h2><?php esc_html_e( 'Output Safety Block', 'kitchen-iq' ); ?></h2>
                <textarea name="kiq_ai_meal_output_safety_block" rows="6" cols="80" class="large-text"><?php echo esc_textarea( get_option( 'kiq_ai_meal_output_safety_block' ) ); ?></textarea>

                <h2><?php esc_html_e( 'Vision Scan Prompt', 'kitchen-iq' ); ?></h2>
                <textarea name="kiq_ai_vision_prompt" rows="6" cols="80" class="large-text"><?php echo esc_textarea( get_option( 'kiq_ai_vision_prompt' ) ); ?></textarea>

                <?php submit_button(); ?>
            </form>
        </div>
        <?php
    }

    public static function render_perishability() {
        ?>
        <div class="wrap">
            <h1><?php esc_html_e( 'Perishability Rules', 'kitchen-iq' ); ?></h1>
            
            <form method="post" action="options.php">
                <?php settings_fields( 'kitcheniq_perishability' ); ?>

                <table class="widefat">
                    <thead>
                        <tr>
                            <th>Item Category</th>
                            <th>Days Until Expiry (Fresh)</th>
                            <th>Days Until Nearing (Warning)</th>
                            <th>Grace Period (Days)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php
                        $categories = array( 'meat', 'dairy', 'produce', 'grains', 'condiments' );
                        $rules      = get_option( 'kiq_perishability_rules', array() );
                        foreach ( $categories as $cat ) {
                            $fresh = isset( $rules[ $cat ]['fresh_days'] ) ? $rules[ $cat ]['fresh_days'] : 7;
                            $nearing = isset( $rules[ $cat ]['nearing_days'] ) ? $rules[ $cat ]['nearing_days'] : 2;
                            ?>
                            <tr>
                                <td><?php echo esc_html( ucfirst( $cat ) ); ?></td>
                                <td><input type="number" name="kiq_perishability_<?php echo esc_attr( $cat ); ?>_fresh" value="<?php echo esc_attr( $fresh ); ?>" min="1" /></td>
                                <td><input type="number" name="kiq_perishability_<?php echo esc_attr( $cat ); ?>_nearing" value="<?php echo esc_attr( $nearing ); ?>" min="0" /></td>
                                <td><input type="number" name="kiq_perishability_<?php echo esc_attr( $cat ); ?>_grace" value="<?php echo esc_attr( isset( $rules[ $cat ]['grace_days'] ) ? $rules[ $cat ]['grace_days'] : 0 ); ?>" min="0" /></td>
                            </tr>
                            <?php
                        }
                        ?>
                    </tbody>
                </table>

                <?php submit_button(); ?>
            </form>
        </div>
        <?php
    }

    public static function render_debug() {
        ?>
        <div class="wrap">
            <h1><?php esc_html_e( 'KitchenIQ Debug', 'kitchen-iq' ); ?></h1>

            <h2><?php esc_html_e( 'System Information', 'kitchen-iq' ); ?></h2>
            <table class="widefat">
                <tbody>
                    <tr>
                        <td><strong>Plugin Version:</strong></td>
                        <td><?php echo esc_html( KIQ_VERSION ); ?></td>
                    </tr>
                    <tr>
                        <td><strong>API Key Configured:</strong></td>
                        <td><?php echo KIQ_API_KEY ? '✓ Yes' : '✗ No (Set KIQ_API_KEY env var)'; ?></td>
                    </tr>
                    <tr>
                        <td><strong>Airtable Configured:</strong></td>
                        <td><?php echo ( KIQ_AIRTABLE_API_KEY && KIQ_AIRTABLE_BASE_ID ) ? '✓ Yes' : '✗ No (Optional)'; ?></td>
                    </tr>
                    <tr>
                        <td><strong>Database Tables:</strong></td>
                        <td>
                            <?php
                            global $wpdb;
                            $tables = array(
                                $wpdb->prefix . 'kiq_meal_history',
                                $wpdb->prefix . 'kiq_meal_ratings',
                                $wpdb->prefix . 'kiq_usage',
                            );
                            foreach ( $tables as $table ) {
                                $exists = $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $table ) ) === $table;
                                echo ( $exists ? '✓' : '✗' ) . ' ' . esc_html( $table ) . '<br />';
                            }
                            ?>
                        </td>
                    </tr>
                </tbody>
            </table>

            <h2><?php esc_html_e( 'Database Stats', 'kitchen-iq' ); ?></h2>
            <table class="widefat">
                <tbody>
                    <tr>
                        <td><strong>Total Users:</strong></td>
                        <td><?php echo count_users()['total_users']; ?></td>
                    </tr>
                    <tr>
                        <td><strong>Meal Histories:</strong></td>
                        <td><?php echo intval( $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->prefix}kiq_meal_history" ) ); ?></td>
                    </tr>
                    <tr>
                        <td><strong>Meal Ratings:</strong></td>
                        <td><?php echo intval( $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->prefix}kiq_meal_ratings" ) ); ?></td>
                    </tr>
                </tbody>
            </table>

            <h2><?php esc_html_e( 'Clear Data', 'kitchen-iq' ); ?></h2>
            <p style="color: #dc3545;">
                <strong>Warning:</strong> These actions cannot be undone!
            </p>
            <form method="post">
                <?php wp_nonce_field( 'kiq_clear_data' ); ?>
                <button type="submit" name="kiq_clear_ratings" class="button button-secondary" onclick="return confirm('Clear all meal ratings?');">
                    Clear All Ratings
                </button>
                <button type="submit" name="kiq_clear_history" class="button button-secondary" onclick="return confirm('Clear all meal history?');">
                    Clear All History
                </button>
            </form>
        </div>
        <?php

        // Handle clear data actions
        if ( isset( $_POST['kiq_clear_ratings'] ) ) {
            check_admin_referer( 'kiq_clear_data' );
            global $wpdb;
            $wpdb->query( "TRUNCATE TABLE {$wpdb->prefix}kiq_meal_ratings" );
            echo '<div class="notice notice-success"><p>Ratings cleared.</p></div>';
        }
        if ( isset( $_POST['kiq_clear_history'] ) ) {
            check_admin_referer( 'kiq_clear_data' );
            global $wpdb;
            $wpdb->query( "TRUNCATE TABLE {$wpdb->prefix}kiq_meal_history" );
            echo '<div class="notice notice-success"><p>Meal history cleared.</p></div>';
        }
    }

    // Settings field renderers
    public static function render_general_section() {
        esc_html_e( 'Configure default behavior for KitchenIQ', 'kitchen-iq' );
    }

    public static function render_field_default_plan_type() {
        $value = get_option( 'kiq_default_plan_type', 'balanced' );
        ?>
        <select name="kiq_default_plan_type">
            <option value="balanced" <?php selected( $value, 'balanced' ); ?>>Balanced</option>
            <option value="quick" <?php selected( $value, 'quick' ); ?>>Quick & Easy</option>
            <option value="healthy" <?php selected( $value, 'healthy' ); ?>>Healthy</option>
            <option value="budget" <?php selected( $value, 'budget' ); ?>>Budget-Friendly</option>
        </select>
        <?php
    }

    public static function render_field_inventory_confirm_limit() {
        $value = get_option( 'kiq_inventory_confirm_limit', 5 );
        ?>
        <input type="number" name="kiq_inventory_confirm_limit" value="<?php echo esc_attr( $value ); ?>" min="1" max="20" />
        <p class="description">Max number of perishable items to ask user about per session</p>
        <?php
    }

    public static function render_ai_section_info() {
        esc_html_e( 'Configure AI model parameters', 'kitchen-iq' );
    }

    public static function render_field_text_model() {
        $value = get_option( 'kiq_ai_text_model', 'gpt-4o-mini' );
        ?>
        <input type="text" name="kiq_ai_text_model" value="<?php echo esc_attr( $value ); ?>" />
        <p class="description">OpenAI model ID for text generation (e.g., gpt-4o-mini, gpt-4)</p>
        <?php
    }

    public static function render_field_vision_model() {
        $value = get_option( 'kiq_ai_vision_model', 'gpt-4o-mini' );
        ?>
        <input type="text" name="kiq_ai_vision_model" value="<?php echo esc_attr( $value ); ?>" />
        <p class="description">OpenAI model ID for vision (e.g., gpt-4o-mini, gpt-4-turbo)</p>
        <?php
    }

    public static function render_field_temperature() {
        $value = get_option( 'kiq_ai_temperature', 0.3 );
        ?>
        <input type="number" name="kiq_ai_temperature" value="<?php echo esc_attr( $value ); ?>" min="0" max="2" step="0.1" />
        <p class="description">Lower = more consistent, Higher = more creative (0.0-2.0)</p>
        <?php
    }

    public static function render_field_max_tokens() {
        $value = get_option( 'kiq_ai_max_tokens', 1500 );
        ?>
        <input type="number" name="kiq_ai_max_tokens" value="<?php echo esc_attr( $value ); ?>" min="100" max="4000" />
        <p class="description">Maximum tokens per API call (affects cost and length)</p>
        <?php
    }

    public static function render_field_enable_logging() {
        $value = get_option( 'kiq_enable_ai_logging' );
        ?>
        <input type="checkbox" name="kiq_enable_ai_logging" value="1" <?php checked( $value ); ?> />
        <p class="description">Log all AI requests and responses to Airtable (requires Airtable config)</p>
        <?php
    }
}

// Initialize admin
KIQ_Admin::init();
