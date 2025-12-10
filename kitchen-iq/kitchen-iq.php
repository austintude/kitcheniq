<?php
/**
 * Plugin Name: KitchenIQ
 * Plugin URI: https://kitcheniq.ai
 * Description: AI-powered kitchen intelligence system. Scan your pantry, get personalized meal plans, and reduce food waste.
 * Version: 0.2.8
 * Author: KitchenIQ
 * Author URI: https://kitcheniq.ai
 * License: GPL-2.0+
 * Text Domain: kitchen-iq
 * Domain Path: /languages
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// Define constants (guarded to avoid redefinition warnings)
if ( ! defined( 'KIQ_PLUGIN_DIR' ) ) {
    define( 'KIQ_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
}
if ( ! defined( 'KIQ_PLUGIN_URL' ) ) {
    define( 'KIQ_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
}
if ( ! defined( 'KIQ_VERSION' ) ) {
    define( 'KIQ_VERSION', '0.2.8' );
}

// API Key configuration - check environment first, then WordPress options
// This allows flexibility: env vars for production, admin panel for testing
if ( getenv( 'KIQ_API_KEY' ) ) {
    define( 'KIQ_API_KEY', getenv( 'KIQ_API_KEY' ) );
} elseif ( function_exists( 'get_option' ) ) {
    define( 'KIQ_API_KEY', get_option( 'kiq_api_key_setting', '' ) );
} else {
    define( 'KIQ_API_KEY', '' );
}

// Airtable (optional analytics)
if ( ! defined( 'KIQ_AIRTABLE_API_KEY' ) ) {
    define( 'KIQ_AIRTABLE_API_KEY', getenv( 'AIRTABLE_API_KEY' ) ?: ( function_exists( 'get_option' ) ? get_option( 'kiq_airtable_key_setting', '' ) : '' ) );
}
if ( ! defined( 'KIQ_AIRTABLE_BASE_ID' ) ) {
    define( 'KIQ_AIRTABLE_BASE_ID', getenv( 'AIRTABLE_BASE_ID' ) ?: ( function_exists( 'get_option' ) ? get_option( 'kiq_airtable_base_setting', '' ) : '' ) );
}
if ( ! defined( 'KIQ_AIRTABLE_TABLE_NAME' ) ) {
    define( 'KIQ_AIRTABLE_TABLE_NAME', 'MealHistory' );
}

// Model configuration
if ( ! defined( 'KIQ_AI_TEXT_MODEL' ) ) {
    define( 'KIQ_AI_TEXT_MODEL', 'gpt-4o-mini' );
}
if ( ! defined( 'KIQ_AI_VISION_MODEL' ) ) {
    define( 'KIQ_AI_VISION_MODEL', 'gpt-4o-mini' );
}

// Include core classes
require_once KIQ_PLUGIN_DIR . 'includes/class-kiq-activator.php';
require_once KIQ_PLUGIN_DIR . 'includes/class-kiq-data.php';
require_once KIQ_PLUGIN_DIR . 'includes/class-kiq-airtable.php';
require_once KIQ_PLUGIN_DIR . 'includes/class-kiq-ai.php';
require_once KIQ_PLUGIN_DIR . 'includes/class-kiq-features.php';
require_once KIQ_PLUGIN_DIR . 'includes/class-kiq-rest.php';
require_once KIQ_PLUGIN_DIR . 'includes/class-kiq-admin.php';

// Activation and deactivation hooks
register_activation_hook( __FILE__, array( 'KIQ_Activator', 'activate' ) );
register_deactivation_hook( __FILE__, array( 'KIQ_Activator', 'deactivate' ) );

// Initialize hooks
add_action( 'plugins_loaded', array( 'KIQ_Main', 'load_textdomain' ) );
add_action( 'init', array( 'KIQ_Main', 'init' ) );

/**
 * Main plugin class
 */
class KIQ_Main {

    /**
     * Load plugin text domain for translations.
     */
    public static function load_textdomain() {
        load_plugin_textdomain(
            'kitchen-iq',
            false,
            dirname( plugin_basename( __FILE__ ) ) . '/languages'
        );
    }

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

        // Initialize admin only within wp-admin
        if ( is_admin() ) {
            KIQ_Admin::init();
        }
    }

    /**
     * Render the dashboard shortcode
     */
    public static function render_dashboard_shortcode() {
        if ( ! is_user_logged_in() ) {
            return '<p>' . esc_html__( 'You must be logged in to use KitchenIQ.', 'kitchen-iq' ) . '</p>';
        }

        // Include the dashboard template so the full HTML is present
        ob_start();
        $template = KIQ_PLUGIN_DIR . 'templates/dashboard.php';
        if ( file_exists( $template ) ) {
            include $template;
        } else {
            echo '<div id="kiq-dashboard-root">', esc_html__( 'Dashboard template missing.', 'kitchen-iq' ), '</div>';
        }

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
                    'kitcheniqData',
                    array(
                        // Provide the base REST URL (so JS appends 'kitcheniq/v1/...')
                        'restRoot'    => esc_url_raw( rest_url() ),
                        'nonce'       => wp_create_nonce( 'wp_rest' ),
                        'currentUser' => get_current_user_id(),
                        'pluginUrl'   => KIQ_PLUGIN_URL,
                    )
                );
        }
    }
}
