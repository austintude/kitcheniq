<?php
/**
 * Plugin Name: KitchenIQ
 * Plugin URI: https://kitcheniq.ai
 * Description: AI-powered kitchen intelligence system. Scan your pantry, get personalized meal plans, and reduce food waste.
 * Version: 0.1.0
 * Author: KitchenIQ
 * Author URI: https://kitcheniq.ai
 * License: GPL-2.0+
 * Text Domain: kitchen-iq
 * Domain Path: /languages
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// Define constants
define( 'KIQ_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'KIQ_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'KIQ_VERSION', '0.1.0' );

// AI configuration constants (move to wp-config.php in production)
define( 'KIQ_AI_API_KEY', getenv( 'OPENAI_API_KEY' ) ?: 'your_openai_api_key_here' );
define( 'KIQ_AI_TEXT_MODEL', 'gpt-4o-mini' );
define( 'KIQ_AI_VISION_MODEL', 'gpt-4o-mini' );

// Airtable constants (optional - move to wp-config.php in production)
define( 'KIQ_AIRTABLE_API_KEY', getenv( 'AIRTABLE_API_KEY' ) ?: '' );
define( 'KIQ_AIRTABLE_BASE_ID', getenv( 'AIRTABLE_BASE_ID' ) ?: '' );
define( 'KIQ_AIRTABLE_TABLE_NAME', 'MealHistory' );

// Include core classes
require_once KIQ_PLUGIN_DIR . 'includes/class-kiq-activator.php';
require_once KIQ_PLUGIN_DIR . 'includes/class-kiq-data.php';
require_once KIQ_PLUGIN_DIR . 'includes/class-kiq-airtable.php';
require_once KIQ_PLUGIN_DIR . 'includes/class-kiq-ai.php';
require_once KIQ_PLUGIN_DIR . 'includes/class-kiq-features.php';
require_once KIQ_PLUGIN_DIR . 'includes/class-kiq-rest.php';
require_once KIQ_PLUGIN_DIR . 'includes/class-kiq-admin.php';
require_once KIQ_PLUGIN_DIR . 'includes/class-kiq-admin.php';

// Activation and deactivation hooks
register_activation_hook( __FILE__, array( 'KIQ_Activator', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'KIQ_Activator', 'deactivate' ) );

// Initialize hooks
add_action( 'init', array( 'KIQ_Main', 'init' ) );

/**
 * Main plugin class
 */
class KIQ_Main {

    /**
     * Initialize the plugin
     */
    public static function init() {
        // Register shortcodes
        add_shortcode( 'kitchen_iq_dashboard', array( __CLASS__, 'render_dashboard_shortcode' ) );

        // Register REST routes
        add_action( 'rest_api_init', array( 'KIQ_REST', 'register_routes' ) );

        // Enqueue scripts and styles
        add_action( 'wp_enqueue_scripts', array( __CLASS__, 'enqueue_dashboard_assets' ) );

        // Initialize admin
        KIQ_Admin::init();
    }

    /**
     * Render the dashboard shortcode
     */
    public static function render_dashboard_shortcode() {
        if ( ! is_user_logged_in() ) {
            return '<p>' . esc_html__( 'You must be logged in to use KitchenIQ.', 'kitchen-iq' ) . '</p>';
        }

        ob_start();
        ?>
        <div id="kiq-dashboard-root"></div>
        <?php
        return ob_get_clean();
    }

    /**
     * Enqueue dashboard assets
     */
    public static function enqueue_dashboard_assets() {
        if ( ! is_singular() ) {
            return;
        }

        global $post;

        if ( has_shortcode( $post->post_content, 'kitchen_iq_dashboard' ) ) {
            wp_enqueue_style(
                'kiq-dashboard-css',
                KIQ_PLUGIN_URL . 'assets/css/kiq-dashboard.css',
                array(),
                KIQ_VERSION
            );

            wp_enqueue_script(
                'kiq-dashboard-js',
                KIQ_PLUGIN_URL . 'assets/js/kiq-dashboard.js',
                array( 'wp-api-fetch' ),
                KIQ_VERSION,
                true
            );

            wp_localize_script(
                'kiq-dashboard-js',
                'KIQApp',
                array(
                    'root'  => esc_url_raw( rest_url( 'kitchen-iq/v1/' ) ),
                    'nonce' => wp_create_nonce( 'wp_rest' ),
                    'debug' => defined( 'WP_DEBUG' ) && WP_DEBUG,
                )
            );
        }
    }
}
