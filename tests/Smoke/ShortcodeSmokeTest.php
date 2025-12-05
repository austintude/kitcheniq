<?php
declare(strict_types=1);

use PHPUnit\Framework\TestCase;

final class ShortcodeSmokeTest extends TestCase {

    protected function setUp(): void {
        parent::setUp();
        $this->resetGlobals();
    }

    private function resetGlobals(): void {
        $GLOBALS['kiq_enqueued_styles']   = array();
        $GLOBALS['kiq_enqueued_scripts']  = array();
        $GLOBALS['kiq_localized_scripts'] = array();
        $GLOBALS['kiq_is_singular']       = true;
        $GLOBALS['kiq_is_user_logged_in'] = false;
        $GLOBALS['kiq_current_user_id']   = 42;

        $GLOBALS['post'] = (object) array(
            'post_content' => 'Intro text [kitchen_iq_dashboard] outro',
        );
    }

    public function test_enqueue_dashboard_assets_enqueues_scripts_and_localization(): void {
        KIQ_Main::enqueue_dashboard_assets();

        $this->assertArrayHasKey( 'kiq-dashboard-css', $GLOBALS['kiq_enqueued_styles'], 'CSS handle missing' );
        $this->assertArrayHasKey( 'kiq-dashboard-js', $GLOBALS['kiq_enqueued_scripts'], 'JS handle missing' );
        $this->assertArrayHasKey( 'kiq-dashboard-js', $GLOBALS['kiq_localized_scripts'], 'Localization missing' );

        $script = $GLOBALS['kiq_enqueued_scripts']['kiq-dashboard-js'];
        $this->assertSame( array( 'wp-api-fetch' ), $script['deps'] );
        $this->assertTrue( $script['in_footer'] );

        $localized = $GLOBALS['kiq_localized_scripts']['kiq-dashboard-js'];
        $this->assertSame( 'kitcheniqData', $localized['object_name'] );
        $this->assertArrayHasKey( 'restRoot', $localized['data'] );
        $this->assertArrayHasKey( 'nonce', $localized['data'] );
        $this->assertArrayHasKey( 'currentUser', $localized['data'] );
        $this->assertSame( 42, $localized['data']['currentUser'] );
    }

    public function test_render_dashboard_shortcode_requires_login(): void {
        $output = KIQ_Main::render_dashboard_shortcode();
        $this->assertStringContainsString( 'You must be logged in to use KitchenIQ.', $output );
    }
}
