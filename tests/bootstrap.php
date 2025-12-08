<?php
declare(strict_types=1);

if ( ! defined( 'ABSPATH' ) ) {
    define( 'ABSPATH', dirname( __DIR__ ) . '/' );
}

if ( ! defined( 'WP_DEBUG' ) ) {
    define( 'WP_DEBUG', false );
}

$GLOBALS['kiq_hooks']              = array();
$GLOBALS['kiq_shortcodes']         = array();
$GLOBALS['kiq_options']            = array();
$GLOBALS['kiq_enqueued_styles']    = array();
$GLOBALS['kiq_enqueued_scripts']   = array();
$GLOBALS['kiq_localized_scripts']  = array();
$GLOBALS['kiq_is_admin_request']   = false;
$GLOBALS['kiq_is_user_logged_in']  = false;
$GLOBALS['kiq_is_singular']        = false;
$GLOBALS['kiq_current_user_id']    = 1;

if ( ! function_exists( 'plugin_dir_path' ) ) {
    function plugin_dir_path( $file ) {
        return rtrim( dirname( $file ), '/\\' ) . DIRECTORY_SEPARATOR;
    }
}

if ( ! function_exists( 'plugin_dir_url' ) ) {
    function plugin_dir_url( $file ) {
        return 'https://example.com/wp-content/plugins/kitchen-iq/';
    }
}

if ( ! function_exists( 'plugin_basename' ) ) {
    function plugin_basename( $file ) {
        $file = str_replace( '\\', '/', $file );
        $dir  = basename( dirname( $file ) );
        $base = basename( $file );
        return $dir . '/' . $base;
    }
}

if ( ! function_exists( 'load_plugin_textdomain' ) ) {
    function load_plugin_textdomain( $domain, $deprecated = false, $plugin_rel_path = '' ) {
        $GLOBALS['kiq_textdomain_loaded'] = array(
            'domain' => $domain,
            'path'   => $plugin_rel_path,
        );
        return true;
    }
}

if ( ! function_exists( 'register_activation_hook' ) ) {
    function register_activation_hook( $file, $callback ) {
        $GLOBALS['kiq_activation_hook'] = $callback;
    }
}

if ( ! function_exists( 'register_deactivation_hook' ) ) {
    function register_deactivation_hook( $file, $callback ) {
        $GLOBALS['kiq_deactivation_hook'] = $callback;
    }
}

if ( ! function_exists( 'add_action' ) ) {
    function add_action( $hook, $callback, $priority = 10, $accepted_args = 1 ) {
        $GLOBALS['kiq_hooks'][ $hook ][] = array(
            'callback'      => $callback,
            'priority'      => $priority,
            'accepted_args' => $accepted_args,
        );
    }
}

if ( ! function_exists( 'add_shortcode' ) ) {
    function add_shortcode( $tag, $callback ) {
        $GLOBALS['kiq_shortcodes'][ $tag ] = $callback;
    }
}

if ( ! function_exists( 'get_option' ) ) {
    function get_option( $name, $default = false ) {
        return array_key_exists( $name, $GLOBALS['kiq_options'] )
            ? $GLOBALS['kiq_options'][ $name ]
            : $default;
    }
}

if ( ! function_exists( 'update_option' ) ) {
    function update_option( $name, $value ) {
        $GLOBALS['kiq_options'][ $name ] = $value;
        return true;
    }
}

if ( ! function_exists( 'is_admin' ) ) {
    function is_admin() {
        return (bool) $GLOBALS['kiq_is_admin_request'];
    }
}

if ( ! function_exists( 'is_user_logged_in' ) ) {
    function is_user_logged_in() {
        return (bool) $GLOBALS['kiq_is_user_logged_in'];
    }
}

if ( ! function_exists( 'esc_html__' ) ) {
    function esc_html__( $text, $domain = 'default' ) {
        return htmlspecialchars( (string) $text, ENT_QUOTES, 'UTF-8' );
    }
}

if ( ! function_exists( 'esc_url_raw' ) ) {
    function esc_url_raw( $url ) {
        return $url;
    }
}

if ( ! function_exists( 'rest_url' ) ) {
    function rest_url( $path = '', $scheme = 'rest' ) {
        return 'https://example.com/wp-json/' . ltrim( $path, '/' );
    }
}

if ( ! function_exists( 'wp_create_nonce' ) ) {
    function wp_create_nonce( $action = -1 ) {
        return 'test-nonce';
    }
}

if ( ! function_exists( 'get_current_user_id' ) ) {
    function get_current_user_id() {
        return (int) $GLOBALS['kiq_current_user_id'];
    }
}

if ( ! function_exists( 'wp_enqueue_style' ) ) {
    function wp_enqueue_style( $handle, $src = '', $deps = array(), $ver = false, $media = 'all' ) {
        $GLOBALS['kiq_enqueued_styles'][ $handle ] = compact( 'src', 'deps', 'ver', 'media' );
    }
}

if ( ! function_exists( 'wp_enqueue_script' ) ) {
    function wp_enqueue_script( $handle, $src = '', $deps = array(), $ver = false, $in_footer = false ) {
        $GLOBALS['kiq_enqueued_scripts'][ $handle ] = compact( 'src', 'deps', 'ver', 'in_footer' );
    }
}

if ( ! function_exists( 'wp_localize_script' ) ) {
    function wp_localize_script( $handle, $object_name, $l10n ) {
        $GLOBALS['kiq_localized_scripts'][ $handle ] = array(
            'object_name' => $object_name,
            'data'        => $l10n,
        );
    }
}

if ( ! function_exists( 'is_singular' ) ) {
    function is_singular() {
        return (bool) $GLOBALS['kiq_is_singular'];
    }
}

if ( ! function_exists( 'has_shortcode' ) ) {
    function has_shortcode( $content, $shortcode ) {
        if ( empty( $content ) ) {
            return false;
        }
        return strpos( $content, '[' . $shortcode ) !== false;
    }
}

require_once dirname( __DIR__ ) . '/kitchen-iq/kitchen-iq.php';
