<?php

use App\Http\Controllers\Admin\CohortAnalyticsController;
use App\Http\Controllers\Admin\QuestionController;
use App\Http\Controllers\Admin\SettingsController;
use App\Http\Controllers\Admin\TestController;
use App\Http\Controllers\Admin\CourseCRUDController;
use App\Http\Controllers\Admin\EnrollmentController;
use App\Http\Controllers\Admin\ActivationRequestController;
use App\Http\Controllers\Admin\ActivationCodeController;
use App\Http\Controllers\Admin\BatchController;
use App\Http\Controllers\Admin\BannerController;
use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\Admin\SuperAdminController;
use App\Http\Controllers\Admin\ResultController;
use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Auth\OtpController;
use App\Http\Controllers\Auth\PasswordResetController;
use App\Http\Controllers\Auth\SocialAuthController;
use App\Http\Controllers\Auth\TwoFactorController;
use App\Http\Controllers\ContactController;
use App\Http\Controllers\Student\TestTakingController;
use App\Http\Controllers\Student\LmsController;
use App\Http\Controllers\Student\StudentActivationController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Public routes (no auth required)
|--------------------------------------------------------------------------
*/

// Registration — reCAPTCHA middleware + rate limiting
Route::post('/register', [AuthController::class, 'register'])
    ->middleware(['recaptcha', 'throttle:register']);

// Login — rate limited per IP+email combo (5/min)
Route::post('/login', [AuthController::class, 'login'])
    ->middleware('throttle:login');

Route::get('/login', function () {
    return response()->json(['message' => 'Unauthenticated.'], 401);
})->name('login');

// Email verification
Route::post('/email/resend', [AuthController::class, 'resendVerification'])
    ->middleware('throttle:email-resend');
Route::get('/email/verify/{id}/{hash}', [AuthController::class, 'verifyEmail'])
    ->name('verification.verify');

// Password reset — rate limited (3/hr per email)
Route::post('/forgot-password', [PasswordResetController::class, 'forgotPassword'])
    ->middleware('throttle:password-reset');
Route::post('/reset-password', [PasswordResetController::class, 'resetPassword']);

// Social auth — Google + Facebook.
// The provider callback is a top-level browser navigation coming FROM the
// provider (accounts.google.com), so Sanctum's stateful-frontend detection
// never fires for it and no session is started. That meant Auth::login() in the
// callback wrote to a session that was never persisted — no auth cookie was set,
// and the SPA's first /api/me came back 401 (bouncing the user back to sign-in).
// Give the callback the full `web` group so StartSession runs and the login
// cookie is actually issued (shared across *.practest.live via SESSION_DOMAIN).
// The redirect stays stateless (Socialite ->stateless(); it needs no session).
Route::get('/auth/{provider}/redirect', [SocialAuthController::class, 'redirect']);
Route::get('/auth/{provider}/callback', [SocialAuthController::class, 'callback'])
    ->middleware('web');

// Mobile app (Capacitor) — bearer-token login; same throttle as web login
Route::post('/mobile/login', [\App\Http\Controllers\Auth\MobileAuthController::class, 'login'])
    ->middleware('throttle:login');

// Mobile native Google sign-in — verifies a Google ID token and issues a bearer
// token. Public (pre-auth), same throttle as login.
Route::post('/mobile/social/google', [\App\Http\Controllers\Auth\MobileSocialAuthController::class, 'google'])
    ->middleware('throttle:login');

// Contact form — reCAPTCHA middleware
Route::post('/contact', [ContactController::class, 'store'])
    ->middleware('recaptcha');

// Public settings
Route::get('/settings/public', [\App\Http\Controllers\Admin\SettingsController::class, 'publicIndex']);
Route::get('/courses/public', [\App\Http\Controllers\PublicCourseController::class, 'index'])
    ->middleware('throttle:60,1');

// Public Home banners — managed by super-admin, consumed by the student app,
// marketing site and mobile apps.
Route::get('/banners/public', [BannerController::class, 'publicIndex'])
    ->middleware('throttle:60,1');

// Razorpay webhook — must be outside auth and CSRF
Route::post('/webhooks/razorpay', [\App\Http\Controllers\Webhook\RazorpayWebhookController::class, 'handle']);

/*
|--------------------------------------------------------------------------
| Authenticated routes (Sanctum session auth)
|--------------------------------------------------------------------------
*/

Route::middleware('auth:sanctum')->group(function () {

    // Auth management
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::post('/mobile/logout', [\App\Http\Controllers\Auth\MobileAuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    // Phone OTP — rate limited (3/10min per phone)
    Route::post('/otp/send', [OtpController::class, 'send'])
        ->middleware('throttle:otp-send');
    Route::post('/otp/verify', [OtpController::class, 'verify']);

    // 2FA management (available to all authenticated users, but enforced for admin/super-admin)
    Route::post('/2fa/setup', [TwoFactorController::class, 'setup']);
    Route::post('/2fa/enable', [TwoFactorController::class, 'enable']);
    Route::post('/2fa/verify', [TwoFactorController::class, 'verify']);

    /*
    |----------------------------------------------------------------------
    | Admin routes (admin + super-admin, with mandatory 2FA)
    |----------------------------------------------------------------------
    */

    Route::middleware(['role:admin|super-admin', '2fa.verified'])->prefix('admin')->group(function () {

        // Question bank
        // NOTE: the static `questions/import*` and `questions/import-template`
        // paths are declared BEFORE the apiResource so `questions/{question}`
        // cannot swallow them.
        Route::post('questions/import', [QuestionController::class, 'import']);
        Route::get('questions/import/{jobId}/status', [QuestionController::class, 'importStatus']);
        Route::get('questions/import-template', [QuestionController::class, 'downloadTemplate']);
        Route::apiResource('questions', QuestionController::class);

        // Review workflow + item analysis (difficulty, discrimination, distractors)
        Route::post('questions/{question}/review', [QuestionController::class, 'review']);
        Route::get('questions/{question}/item-analysis', [QuestionController::class, 'itemAnalysis']);

        // Shared comprehension passages (English RC sets etc) that questions link to
        Route::apiResource('passages', \App\Http\Controllers\Admin\PassageController::class);

        // Test management
        Route::apiResource('tests', TestController::class);
        Route::post('tests/{test}/publish', [TestController::class, 'publish']);
        Route::post('tests/{test}/unpublish', [TestController::class, 'unpublish']);

        // Cohort analytics (owner view) - read-only derivations, no new tables
        Route::get('batches/{batch}/analytics', [CohortAnalyticsController::class, 'batchAnalytics']);
        Route::get('batches/{batch}/students-progress', [CohortAnalyticsController::class, 'studentsProgress']);
        Route::get('tests/{test}/leaderboard', [CohortAnalyticsController::class, 'testLeaderboard']);
        Route::get('test-series/{series}/leaderboard', [CohortAnalyticsController::class, 'seriesLeaderboard']);
        Route::get('courses/{course}/video-analytics', [CohortAnalyticsController::class, 'videoEngagement']);

        // Course outlines
        Route::apiResource('courses', CourseCRUDController::class);
        Route::post('courses/{course}/banner', [CourseCRUDController::class, 'uploadBanner']);
        Route::post('courses/{course}/modules', [CourseCRUDController::class, 'storeModule']);
        Route::put('modules/{module}', [CourseCRUDController::class, 'updateModule']);
        Route::delete('modules/{module}', [CourseCRUDController::class, 'destroyModule']);
        Route::post('modules/{module}/lessons', [CourseCRUDController::class, 'storeLesson']);
        Route::put('lessons/{lesson}', [CourseCRUDController::class, 'updateLesson']);
        Route::delete('lessons/{lesson}', [CourseCRUDController::class, 'destroyLesson']);

        // Study materials — the PDFs the student reader opens. Uploads land on
        // the PRIVATE disk (config/studymaterials.php); nothing here ever hands
        // out a file URL. Update is a POST rather than a PUT because PHP does
        // not populate $_FILES for a PUT body, so a multipart edit has to come
        // in as a POST (or as POST + _method=PUT, which is the same request).
        Route::get('courses/{course}/study-materials', [\App\Http\Controllers\Admin\StudyMaterialController::class, 'index']);
        Route::post('courses/{course}/study-materials', [\App\Http\Controllers\Admin\StudyMaterialController::class, 'store']);
        Route::post('study-materials/{material}', [\App\Http\Controllers\Admin\StudyMaterialController::class, 'update']);
        Route::delete('study-materials/{material}', [\App\Http\Controllers\Admin\StudyMaterialController::class, 'destroy']);

        // Manual enrollments
        Route::get('enrollments', [EnrollmentController::class, 'index']);
        Route::post('enrollments', [EnrollmentController::class, 'store']);
        Route::post('enrollments/{enrollment}/toggle', [EnrollmentController::class, 'toggleStatus']);
        Route::delete('enrollments/{enrollment}', [EnrollmentController::class, 'destroy']);

        // Users & student search
        Route::get('users', [UserController::class, 'index']);

        // Batch management
        Route::get('courses/{course}/batches', [BatchController::class, 'index']);
        Route::post('courses/{course}/batches', [BatchController::class, 'store']);
        Route::put('batches/{batch}', [BatchController::class, 'update']);
        Route::delete('batches/{batch}', [BatchController::class, 'destroy']); // Soft-deactivation

        // Test Results
        Route::get('results', [ResultController::class, 'index']);
        Route::get('results/{session}', [ResultController::class, 'show']);

        // Activation requests & codes
        Route::get('activation-requests', [ActivationRequestController::class, 'index']);
        Route::get('activation-requests/{activationRequest}/proof', [ActivationRequestController::class, 'showProof']);
        Route::post('activation-requests/{activationRequest}/approve', [ActivationRequestController::class, 'approve']);
        Route::post('activation-requests/{activationRequest}/reject', [ActivationRequestController::class, 'reject']);
        Route::get('activation-codes', [ActivationCodeController::class, 'index']);
        Route::post('activation-codes', [ActivationCodeController::class, 'store']);

        // Test Series & Builders
        Route::apiResource('test-series', \App\Http\Controllers\Admin\TestSeriesController::class);
        Route::post('test-series/{series}/publish', [\App\Http\Controllers\Admin\TestSeriesController::class, 'publish']);
        Route::post('test-series/{series}/unpublish', [\App\Http\Controllers\Admin\TestSeriesController::class, 'unpublish']);
        Route::put('test-series/{series}/tests', [\App\Http\Controllers\Admin\TestSeriesController::class, 'syncTests']);

        // Assignments
        Route::post('assignments', [\App\Http\Controllers\Admin\AssignmentController::class, 'store']);
        Route::get('batches/{batch}/assignments', [\App\Http\Controllers\Admin\AssignmentController::class, 'batchAssignments']);
        Route::delete('assignments/{assignment}', [\App\Http\Controllers\Admin\AssignmentController::class, 'destroy']);

        // Store products — courses, test series and bundles put on sale
        Route::apiResource('products', \App\Http\Controllers\Admin\ProductController::class);
        Route::post('products/{product}/publish', [\App\Http\Controllers\Admin\ProductController::class, 'publish']);
        Route::post('products/{product}/unpublish', [\App\Http\Controllers\Admin\ProductController::class, 'unpublish']);

        // Payments
        Route::get('payments', [\App\Http\Controllers\Admin\PaymentHistoryController::class, 'index']);
        Route::post('payments/{payment}/refund', [\App\Http\Controllers\Admin\PaymentHistoryController::class, 'refund']);

    });

    /*
    |----------------------------------------------------------------------
    | Super-Admin only routes (with mandatory 2FA)
    |----------------------------------------------------------------------
    */

    Route::middleware(['role:super-admin', '2fa.verified'])->prefix('super-admin')->group(function () {

        // White-label settings management
        Route::get('/settings', [SettingsController::class, 'index']);
        Route::put('/settings', [SettingsController::class, 'update']);
        Route::post('/settings/upload', [SuperAdminController::class, 'uploadBrandingImage']);

        // Home promo banners (marketing content — super-admin owned)
        Route::get('/banners', [BannerController::class, 'index']);
        Route::post('/banners', [BannerController::class, 'store']);
        Route::post('/banners/reorder', [BannerController::class, 'reorder']);
        Route::post('/banners/{banner}/image', [BannerController::class, 'uploadImage']);
        Route::put('/banners/{banner}', [BannerController::class, 'update']);
        Route::delete('/banners/{banner}', [BannerController::class, 'destroy']);

        // Admin Account & Support Management
        Route::get('/admins', [SuperAdminController::class, 'getAdmins']);
        Route::post('/admins', [SuperAdminController::class, 'createAdmin']);
        Route::post('/admins/{user}/reset-password', [SuperAdminController::class, 'resetAdminPassword']);

        // Audit Logs
        Route::get('/audit-logs', [SuperAdminController::class, 'getAuditLogs']);

    });

    /*
    |----------------------------------------------------------------------
    | Student routes
    |----------------------------------------------------------------------
    */

    Route::middleware('role:student')->prefix('student')->group(function () {

        // Everything the Home tab draws, in one round trip. Additive: the app
        // treats a 404 here as "this API has not been deployed yet" and falls
        // back to the older endpoints, so the two can ship independently.
        Route::get('home-summary', [\App\Http\Controllers\Student\StudentHomeController::class, 'summary']);

        // FCM v1.1 — device push tokens (registered by the Flutter app on
        // login / token-refresh, removed on logout). See docs/FCM_V1.1_SCOPE.md.
        Route::post('device-tokens', [\App\Http\Controllers\Student\DeviceTokenController::class, 'store']);
        Route::delete('device-tokens', [\App\Http\Controllers\Student\DeviceTokenController::class, 'destroy']);

        // FCM v1.1 — in-app notifications feed (Laravel `database` channel).
        Route::get('notifications', [\App\Http\Controllers\Student\NotificationController::class, 'index']);
        Route::get('notifications/unread-count', [\App\Http\Controllers\Student\NotificationController::class, 'unreadCount']);
        Route::post('notifications/read-all', [\App\Http\Controllers\Student\NotificationController::class, 'markAllRead']);
        Route::post('notifications/{id}/read', [\App\Http\Controllers\Student\NotificationController::class, 'markRead']);

        // Vajini — AI study companion (RAG over course content). Throttled to
        // protect the OpenAI key/cost; degrades to 503 when unconfigured.
        Route::post('vajini/chat', [\App\Http\Controllers\Student\VajiniController::class, 'chat'])
            ->middleware('throttle:vajini');

        // Test taking
        Route::get('tests', [TestTakingController::class, 'availableTests']);
        // Read-only — duration, marks, marking scheme and the instructions
        // text, gated the same as start() but never creates a session. The
        // instructions screen calls this before the candidate presses Start.
        Route::get('tests/{test}/preview', [TestTakingController::class, 'preview']);
        // Tighter than the global 60/min — see the 'test-start' limiter.
        Route::post('tests/{test}/start', [TestTakingController::class, 'start'])
            ->middleware('throttle:test-start');
        Route::get('tests/sessions/{session}', [TestTakingController::class, 'resume']);
        Route::put('tests/sessions/{session}/answers/{question}', [TestTakingController::class, 'saveAnswer']);
        Route::put('tests/sessions/{session}/answers/{question}/review', [TestTakingController::class, 'toggleReview']);
        Route::put('tests/sessions/{session}/answers/{question}/visit', [TestTakingController::class, 'markVisited']);
        Route::post('tests/sessions/{session}/advance-section', [TestTakingController::class, 'advanceSection']);
        Route::post('tests/sessions/{session}/submit', [TestTakingController::class, 'submit']);
        Route::get('tests/sessions/{session}/result', [TestTakingController::class, 'result']);
        Route::get('tests/sessions/{session}/palette', [TestTakingController::class, 'palette']);

        // Test results history
        Route::get('results', [TestTakingController::class, 'resultsHistory']);

        // Test Series & Study Path
        Route::get('test-series', [\App\Http\Controllers\Student\StudentTestSeriesController::class, 'index']);
        Route::get('test-series/{series}', [\App\Http\Controllers\Student\StudentTestSeriesController::class, 'show']);
        Route::get('test-series/{series}/leaderboard', [\App\Http\Controllers\Student\StudentTestSeriesController::class, 'leaderboard']);

        // LMS Viewer
        Route::get('courses', [LmsController::class, 'myCourses']);
        Route::get('purchasable-courses', [LmsController::class, 'purchasableCourses']);
        Route::get('courses/{course}/outline', [LmsController::class, 'courseOutline']);
        Route::get('lessons/{lesson}', [LmsController::class, 'lessonDetails']);
        Route::post('lessons/{lesson}/progress', [LmsController::class, 'updateProgress']);

        // Study materials + the ebook reader.
        //
        // `show` returns the material, the student's reading position and their
        // annotations in one call — the reader cannot draw without all three.
        // `file` streams the PDF itself and re-checks the entitlement on every
        // request; there is no public URL for these files anywhere.
        Route::get('study-materials', [\App\Http\Controllers\Student\StudyMaterialController::class, 'index']);
        Route::get('courses/{course}/study-materials', [\App\Http\Controllers\Student\StudyMaterialController::class, 'forCourse']);
        Route::get('study-materials/{material}', [\App\Http\Controllers\Student\StudyMaterialController::class, 'show']);
        Route::get('study-materials/{material}/file', [\App\Http\Controllers\Student\StudyMaterialController::class, 'file']);

        // Reader write-side — position, bookmarks, highlights and notes. Called
        // on a 30s timer from an open reader, so it is throttled apart from the
        // read endpoints a page load depends on.
        Route::middleware('throttle:reader-sync')->group(function () {
            Route::patch('study-materials/{material}/progress', [\App\Http\Controllers\Student\ReaderController::class, 'sync']);
        });
        Route::get('study-materials/{material}/annotations', [\App\Http\Controllers\Student\ReaderController::class, 'annotations']);
        Route::post('study-materials/{material}/annotations', [\App\Http\Controllers\Student\ReaderController::class, 'storeAnnotation']);
        Route::put('annotations/{annotation}', [\App\Http\Controllers\Student\ReaderController::class, 'updateAnnotation']);
        Route::delete('annotations/{annotation}', [\App\Http\Controllers\Student\ReaderController::class, 'destroyAnnotation']);

        // Activation
        Route::get('activation-requests', [StudentActivationController::class, 'index']);
        Route::post('activation-requests', [StudentActivationController::class, 'requestActivation']);
        Route::post('activation-codes/redeem', [StudentActivationController::class, 'redeemCode']);

        // Store — products (course, test series, bundle) and the student's library
        Route::get('store', [\App\Http\Controllers\Student\StoreController::class, 'index']);
        Route::get('library', [\App\Http\Controllers\Student\StoreController::class, 'library']);

        // Custom practice console — the student builds their own paper from the
        // question pool their purchases give them access to. Generation is
        // throttled: each call writes a test, a section and up to 100 pivot rows.
        Route::get('practice-tests/options', [\App\Http\Controllers\Student\PracticeTestController::class, 'options']);
        Route::post('practice-tests/preview', [\App\Http\Controllers\Student\PracticeTestController::class, 'preview']);
        Route::get('practice-tests', [\App\Http\Controllers\Student\PracticeTestController::class, 'index']);
        Route::post('practice-tests', [\App\Http\Controllers\Student\PracticeTestController::class, 'store'])
            ->middleware('throttle:practice-build');
        Route::delete('practice-tests/{test}', [\App\Http\Controllers\Student\PracticeTestController::class, 'destroy']);

        // Checkout — product rail (course / series / bundle). Sits beside the
        // batch rail below rather than replacing it; both produce a Payment that
        // the same service confirms, invoices and refunds.
        Route::post('checkout/product/create-order', [\App\Http\Controllers\Student\ProductCheckoutController::class, 'createOrder']);
        Route::post('checkout/product/validate-coupon', [\App\Http\Controllers\Student\ProductCheckoutController::class, 'validateCoupon']);

        // Payments — Razorpay rail (web / non-Play builds).
        Route::post('checkout/create-order', [\App\Http\Controllers\Student\PaymentController::class, 'createOrder']);
        Route::post('checkout/verify', [\App\Http\Controllers\Student\PaymentController::class, 'verifyPayment']);
        Route::post('checkout/validate-coupon', [\App\Http\Controllers\Student\PaymentController::class, 'validateCoupon']);

        // Receipts / tax invoices for the student's own payments.
        Route::get('invoices', [\App\Http\Controllers\Student\InvoiceController::class, 'index']);
        Route::get('invoices/{invoice}', [\App\Http\Controllers\Student\InvoiceController::class, 'show']);

        // Payments — Google Play Billing rail (the Android in-app store). Server
        // validates the purchase token before granting; inert (503) until a
        // service account is configured. See config/googleplay.php.
        Route::post('checkout/google-play/verify', [\App\Http\Controllers\Student\GooglePlayController::class, 'verify']);

    });
});
