Always update the version inside the kitchen-iq.php file with every incremental change:
Version: 0.5.0 becomes Version: 0.5.1 become Version: 0.5.11 for minor updates and Version: 0.5.2 for bigger updates. 
When a change is MAJOR, then it would become Version: 0.6.0 and so on and so forth. The version changes need to be consistent here as well
if ( ! defined( 'KIQ_VERSION' ) ) {
    define( 'KIQ_VERSION', '0.5.0' );
}
    so they match.