<?php

return [
    /*
    | The Android application id the managed products live under. Must match the
    | package the app is published as — the same one the APK is signed for.
    */
    'package_name' => env('GOOGLE_PLAY_PACKAGE_NAME', 'com.practest.practest_app'),

    /*
    | A Google service account with Play Developer API access (androidpublisher
    | scope), used to verify and acknowledge purchase tokens. Provide EITHER an
    | absolute path to the JSON key file, OR the JSON inline (inline wins). Leave
    | both unset and the in-app store stays inert — GooglePlayVerifier::isConfigured()
    | is false, and the verify endpoint answers 503 rather than pretending to sell.
    */
    'service_account_path' => env('GOOGLE_PLAY_SERVICE_ACCOUNT_PATH'),
    'service_account_json' => env('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON'),
];
