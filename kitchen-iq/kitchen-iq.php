<?php
/**
 * Plugin Name: KitchenIQ
 * Plugin URI: https://kitcheniq.ai
 * Description: AI-powered kitchen intelligence system. Scan your pantry, get personalized meal plans, and reduce food waste.
 * Version: 1.0.6.15
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
    define( 'KIQ_VERSION', '1.0.6.15' );
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

    private static $pwa_enabled_on_request = false;
    private static $pwa_start_path         = '/';

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

        // PWA endpoints served from site root (required for correct service worker scope)
        add_action( 'init', array( __CLASS__, 'register_pwa_routes' ) );
        add_filter( 'query_vars', array( __CLASS__, 'register_pwa_query_vars' ) );
        // Serve PWA assets early, before WP routing kicks in
        add_action( 'parse_request', array( __CLASS__, 'maybe_serve_pwa_assets' ) );

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

        // Hide the WordPress admin bar when displaying the dashboard
        add_filter( 'show_admin_bar', '__return_false' );

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
            // Enable PWA tags + registration on this request.
            self::$pwa_enabled_on_request = true;
            $request_uri = isset( $_SERVER['REQUEST_URI'] ) ? wp_unslash( $_SERVER['REQUEST_URI'] ) : '/';
            $request_path = wp_parse_url( $request_uri, PHP_URL_PATH );
            self::$pwa_start_path = is_string( $request_path ) && $request_path !== '' ? $request_path : '/';
            add_action( 'wp_head', array( __CLASS__, 'output_pwa_head_tags' ), 1 );

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
                        // PWA endpoints scoped to /app
                        'pwaManifest' => home_url( '/app/kitcheniq.webmanifest' ),
                        'pwaSw'       => home_url( '/app/kitcheniq-sw.js' ),
                    )
                );
        }
    }

    /**
     * Register site-root PWA URLs.
     */
    public static function register_pwa_routes() {
        // PWA assets under /app for scoped service worker
        add_rewrite_rule( '^app/kitcheniq\\.webmanifest$', 'index.php?kiq_manifest=1', 'top' );
        add_rewrite_rule( '^app/kitcheniq-sw\\.js$', 'index.php?kiq_sw=1', 'top' );
        // Backwards compatibility: still serve root paths if requested
        add_rewrite_rule( '^kitcheniq\\.webmanifest$', 'index.php?kiq_manifest=1', 'top' );
        add_rewrite_rule( '^kitcheniq-sw\\.js$', 'index.php?kiq_sw=1', 'top' );
    }

    public static function register_pwa_query_vars( $vars ) {
        $vars[] = 'kiq_manifest';
        $vars[] = 'kiq_sw';
        $vars[] = 'kiq_start';
        return $vars;
    }

    /**
     * Output PWA meta tags on the dashboard page.
     */
    public static function output_pwa_head_tags() {
        if ( ! self::$pwa_enabled_on_request ) {
            return;
        }

        // Pass the current page path as the desired start URL for the manifest.
        $start = self::$pwa_start_path ?: '/';
        if ( is_string( $start ) ) {
            // Only allow same-origin paths.
            $start = preg_replace( '#\s+#', '', $start );
            if ( strpos( $start, '://' ) !== false ) {
                $start = '/';
            }
            if ( $start === '' || $start[0] !== '/' ) {
                $start = '/';
            }
        }

        // Serve manifest from /app path so scope is correctly limited
        $manifest_url = add_query_arg( 'kiq_start', rawurlencode( $start ), home_url( '/app/kitcheniq.webmanifest' ) );

        echo '<link rel="manifest" href="' . esc_url( $manifest_url ) . '">\n';
        echo '<meta name="theme-color" content="#f05a24">\n';
        echo '<meta name="apple-mobile-web-app-capable" content="yes">\n';
        echo '<meta name="apple-mobile-web-app-status-bar-style" content="default">\n';
        echo '<meta name="apple-mobile-web-app-title" content="KitchenIQ">\n';
    }

    /**
     * Serve PWA assets from site root.
     */
    public static function maybe_serve_pwa_assets() {
        // Robust handling: honor query vars and direct path hits even if rewrites are stale.
        $request_uri = isset( $_SERVER['REQUEST_URI'] ) ? wp_unslash( $_SERVER['REQUEST_URI'] ) : '';
        $path = wp_parse_url( $request_uri, PHP_URL_PATH );
        $path = is_string( $path ) ? $path : '';

        $wants_manifest = (bool) get_query_var( 'kiq_manifest' );
        $wants_sw       = (bool) get_query_var( 'kiq_sw' );

        // Also serve if the request path directly targets the manifest/SW under /app or root.
        if ( $path === '/app/kitcheniq.webmanifest' || $path === '/kitcheniq.webmanifest' ) {
            $wants_manifest = true;
        }
        if ( $path === '/app/kitcheniq-sw.js' || $path === '/kitcheniq-sw.js' ) {
            $wants_sw = true;
        }

        // Log all PWA requests if WP_DEBUG is on
        if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
            error_log( 'KIQ PWA check: path=' . $path . ', uri=' . $request_uri . ', manifest=' . ( $wants_manifest ? 'yes' : 'no' ) . ', sw=' . ( $wants_sw ? 'yes' : 'no' ) );
        }

        if ( $wants_manifest ) {
            self::serve_pwa_manifest();
            exit;
        }

        if ( $wants_sw ) {
            self::serve_pwa_service_worker();
            exit;
        }
    }

    private static function serve_pwa_manifest() {
        $start = get_query_var( 'kiq_start' );
        $start = is_string( $start ) ? rawurldecode( $start ) : '/';
        $start = preg_replace( '#\s+#', '', $start );
        if ( strpos( $start, '://' ) !== false ) {
            $start = '/';
        }
        if ( $start === '' || $start[0] !== '/' ) {
            $start = '/';
        }

        // Force scope to /app/ to keep the PWA contained within the subdirectory.
        $scope = '/app/';

        // If start doesn't live under /app, default start to /app/
        if ( strpos( $start, '/app/' ) !== 0 ) {
            $start = '/app/';
        }

        $icon192 = function_exists( 'get_site_icon_url' ) ? get_site_icon_url( 192 ) : '';
        $icon512 = function_exists( 'get_site_icon_url' ) ? get_site_icon_url( 512 ) : '';

        $manifest = array(
            'name'             => 'KitchenIQ',
            'short_name'       => 'KitchenIQ',
            'start_url'        => $start,
            'scope'            => $scope,
            'display'          => 'standalone',
            'background_color' => '#ffffff',
            'theme_color'      => '#f05a24',
            'orientation'      => 'portrait-primary',
            'categories'       => array( 'productivity', 'utilities' ),
        );

        $icons = array();
        if ( ! empty( $icon192 ) ) {
            $icons[] = array(
                'src'   => $icon192,
                'sizes' => '192x192',
                'type'  => 'image/png',
            );
        }
        if ( ! empty( $icon512 ) ) {
            $icons[] = array(
                'src'   => $icon512,
                'sizes' => '512x512',
                'type'  => 'image/png',
            );
        }
        if ( ! empty( $icons ) ) {
            $manifest['icons'] = $icons;
        }

        // Log manifest serving if WP_DEBUG is on
        if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
            error_log( 'KIQ: Serving manifest with scope=' . $scope . ', start_url=' . $start );
        }

        // Ensure clean output - no buffering, no warnings
        if ( ob_get_level() > 0 ) {
            ob_end_clean();
        }
        
        nocache_headers();
        header( 'Content-Type: application/manifest+json; charset=utf-8' );
        echo wp_json_encode( $manifest );
        exit;
    }

    private static function serve_pwa_service_worker() {
        nocache_headers();
        header( 'Content-Type: application/javascript; charset=utf-8' );

        $cache_name = 'kiq-cache-' . KIQ_VERSION;
        $plugin_prefix = wp_parse_url( KIQ_PLUGIN_URL, PHP_URL_PATH );
        if ( empty( $plugin_prefix ) ) {
            $plugin_prefix = '/wp-content/plugins/kitchen-iq/';
        }

        echo "/* KitchenIQ Service Worker */\n";
        echo "const CACHE_NAME = " . wp_json_encode( $cache_name ) . ";\n";
        echo "const PLUGIN_PREFIX = " . wp_json_encode( $plugin_prefix ) . ";\n";
        echo "const APP_SCOPE = '/app/';\n";

        // Network-first for navigations; cache static plugin assets opportunistically.
        echo "self.addEventListener('install', (event) => {\n";
        echo "  self.skipWaiting();\n";
        echo "});\n\n";

        echo "self.addEventListener('activate', (event) => {\n";
        echo "  event.waitUntil(self.clients.claim());\n";
        echo "});\n\n";

        echo "self.addEventListener('fetch', (event) => {\n";
        echo "  const req = event.request;\n";
        echo "  const url = new URL(req.url);\n";
        echo "\n";
        echo "  // Only handle same-origin requests within /app scope or plugin assets\n";
        echo "  if (url.origin !== self.location.origin) return;\n";
        echo "\n";
        echo "  // Navigations under /app: network-first, fall back to cache\n";
        echo "  if (req.mode === 'navigate' && url.pathname.startsWith(APP_SCOPE)) {\n";
        echo "    event.respondWith((async () => {\n";
        echo "      try {\n";
        echo "        const fresh = await fetch(req);\n";
        echo "        const cache = await caches.open(CACHE_NAME);\n";
        echo "        cache.put(req, fresh.clone());\n";
        echo "        return fresh;\n";
        echo "      } catch (e) {\n";
        echo "        const cached = await caches.match(req);\n";
        echo "        return cached || Response.error();\n";
        echo "      }\n";
        echo "    })());\n";
        echo "    return;\n";
        echo "  }\n";

        echo "  // Static assets under plugin path: cache-first\n";
        echo "  if (url.pathname.startsWith(PLUGIN_PREFIX)) {\n";
        echo "    event.respondWith((async () => {\n";
        echo "      const cached = await caches.match(req);\n";
        echo "      if (cached) return cached;\n";
        echo "      const fresh = await fetch(req);\n";
        echo "      const cache = await caches.open(CACHE_NAME);\n";
        echo "      cache.put(req, fresh.clone());\n";
        echo "      return fresh;\n";
        echo "    })());\n";
        echo "  }\n";
        echo "});\n";
    }
}
