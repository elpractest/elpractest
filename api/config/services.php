<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    // ── Socialite Providers ────────────────────────────────────────

    'google' => [
        'client_id' => env('GOOGLE_CLIENT_ID'),
        'client_secret' => env('GOOGLE_CLIENT_SECRET'),
        'redirect' => env('GOOGLE_REDIRECT_URI', '/api/auth/google/callback'),
    ],

    'facebook' => [
        'client_id' => env('FACEBOOK_CLIENT_ID'),
        'client_secret' => env('FACEBOOK_CLIENT_SECRET'),
        'redirect' => env('FACEBOOK_REDIRECT_URI', '/api/auth/facebook/callback'),
    ],

    // ── MSG91 OTP ──────────────────────────────────────────────────

    'msg91' => [
        'auth_key' => env('MSG91_AUTH_KEY'),
        'template_id' => env('MSG91_TEMPLATE_ID'),
        'sender_id' => env('MSG91_SENDER_ID', 'PRACTEST'),
    ],

    // ── Razorpay (behind feature toggle) ───────────────────────────

    'razorpay' => [
        'key_id' => env('RAZORPAY_KEY_ID'),
        'key_secret' => env('RAZORPAY_KEY_SECRET'),
        'webhook_secret' => env('RAZORPAY_WEBHOOK_SECRET'),
    ],

    // ── Google reCAPTCHA v3 ────────────────────────────────────────

    'recaptcha' => [
        'secret_key' => env('RECAPTCHA_SECRET_KEY'),
        'site_key' => env('RECAPTCHA_SITE_KEY'),
        'min_score' => env('RECAPTCHA_MIN_SCORE', 0.5),
    ],

    // ── Analytics / Conversion Tracking ────────────────────────────

    'meta' => [
        'pixel_id' => env('META_PIXEL_ID'),
        'capi_access_token' => env('META_CAPI_ACCESS_TOKEN'),
    ],

    'ga4' => [
        'measurement_id' => env('GA4_MEASUREMENT_ID'),
        'api_secret' => env('GA4_API_SECRET'),
    ],

];
