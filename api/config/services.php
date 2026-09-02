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
        // The mobile app's native google_sign_in needs a WEB client id from the
        // SAME Firebase project as google-services.json, which can differ from
        // the web-login client above. Set GOOGLE_MOBILE_CLIENT_ID to it; the app
        // uses it as serverClientId and the backend verifies the token audience
        // against it. Falls back to client_id when unset.
        'mobile_client_id' => env('GOOGLE_MOBILE_CLIENT_ID'),
    ],

    'facebook' => [
        'client_id' => env('FACEBOOK_CLIENT_ID'),
        'client_secret' => env('FACEBOOK_CLIENT_SECRET'),
        'redirect' => env('FACEBOOK_REDIRECT_URI', '/api/auth/facebook/callback'),
    ],

    // ── Firebase Cloud Messaging (FCM v1.1 push) ───────────────────
    // Service-account credentials for FCM HTTP v1. Provide EITHER:
    //   FIREBASE_CREDENTIALS_JSON — the service-account JSON in one env var.
    //     Prefer BASE64 of the JSON: the raw JSON is multi-line (its private_key
    //     is full of newlines) and breaks single-line env fields (Coolify). The
    //     service accepts either base64 or raw. OR
    //   FIREBASE_CREDENTIALS — an absolute path to the JSON file on disk.
    // The raw JSON wins if both are set. NEVER commit the key. When neither is
    // set the fcm channel no-ops (mirrors GooglePlayController) so the code
    // deploys safely before the secret lands. See docs/FCM_V1.1_SCOPE.md.
    'fcm' => [
        'credentials_json' => env('FIREBASE_CREDENTIALS_JSON'), // raw service-account JSON
        'credentials' => env('FIREBASE_CREDENTIALS'),           // …or a path to it
        'project_id' => env('FIREBASE_PROJECT_ID'),
    ],

    // ── MSG91 OTP + WhatsApp ───────────────────────────────────────

    'msg91' => [
        'auth_key' => env('MSG91_AUTH_KEY'),
        'template_id' => env('MSG91_TEMPLATE_ID'),
        'sender_id' => env('MSG91_SENDER_ID', 'PRACTEST'),

        // WhatsApp Business, on the same MSG91 account as the OTP above.
        //
        // Template NAMES, not text: WhatsApp only permits pre-approved
        // templates for business-initiated messages, and the approved name
        // lives in the institute's own Meta account — so it is configured,
        // never hard-coded. A blank name skips that one message; a blank
        // integrated_number makes the whole channel inert, so this deploys
        // safely long before Meta approval comes through.
        //
        // Body variables each template must declare, in order:
        //   activation_approved : {course}
        //   result_ready        : {test}, {score}, {total}
        //   test_reminder       : {test}, {minutes}
        'whatsapp' => [
            'integrated_number' => env('MSG91_WHATSAPP_NUMBER'),
            'language' => env('MSG91_WHATSAPP_LANGUAGE', 'en'),
            'country_code' => env('MSG91_WHATSAPP_COUNTRY_CODE', '91'),
            'templates' => [
                'activation_approved' => env('MSG91_WA_TEMPLATE_ACTIVATION', ''),
                'result_ready' => env('MSG91_WA_TEMPLATE_RESULT', ''),
                'test_reminder' => env('MSG91_WA_TEMPLATE_REMINDER', ''),
            ],
        ],
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

    // ── OpenAI (Vajini AI study companion) ─────────────────────────
    // The key is never committed — set OPENAI_API_KEY in the server .env.
    // Absence of the key degrades Vajini gracefully (503), it does not break
    // any other route.

    'openai' => [
        'key' => env('OPENAI_API_KEY'),
        'base_url' => env('OPENAI_BASE_URL', 'https://api.openai.com/v1'),
        'chat_model' => env('OPENAI_CHAT_MODEL', 'gpt-4o-mini'),
        'embed_model' => env('OPENAI_EMBED_MODEL', 'text-embedding-3-small'),
        // Retrieval + generation knobs, tunable without a code change.
        'top_k' => (int) env('VAJINI_TOP_K', 5),
        'timeout' => (int) env('OPENAI_TIMEOUT', 30),
    ],

];
