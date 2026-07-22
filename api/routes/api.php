<?php

use App\Http\Controllers\Admin\QuestionController;
use App\Http\Controllers\Admin\SettingsController;
use App\Http\Controllers\Admin\TestController;
use App\Http\Controllers\Admin\CourseCRUDController;
use App\Http\Controllers\Admin\EnrollmentController;
use App\Http\Controllers\Admin\ActivationRequestController;
use App\Http\Controllers\Admin\ActivationCodeController;
use App\Http\Controllers\Admin\BatchController;
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
Route::post('/email/resend', [AuthController::class, 'resendVerification']);
Route::get('/email/verify/{id}/{hash}', [AuthController::class, 'verifyEmail'])
    ->name('verification.verify');

// Password reset — rate limited (3/hr per email)
Route::post('/forgot-password', [PasswordResetController::class, 'forgotPassword'])
    ->middleware('throttle:password-reset');
Route::post('/reset-password', [PasswordResetController::class, 'resetPassword']);

// Social auth — Google + Facebook
Route::get('/auth/{provider}/redirect', [SocialAuthController::class, 'redirect']);
Route::get('/auth/{provider}/callback', [SocialAuthController::class, 'callback']);

// Mobile app (Capacitor) — bearer-token login; same throttle as web login
Route::post('/mobile/login', [\App\Http\Controllers\Auth\MobileAuthController::class, 'login'])
    ->middleware('throttle:login');

// Contact form — reCAPTCHA middleware
Route::post('/contact', [ContactController::class, 'store'])
    ->middleware('recaptcha');

// Public settings
Route::get('/settings/public', [\App\Http\Controllers\Admin\SettingsController::class, 'publicIndex']);
Route::get('/courses/public', [\App\Http\Controllers\PublicCourseController::class, 'index'])
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
        Route::apiResource('questions', QuestionController::class);
        Route::post('questions/import', [QuestionController::class, 'import']);
        Route::get('questions/import/{jobId}/status', [QuestionController::class, 'importStatus']);

        // Test management
        Route::apiResource('tests', TestController::class);
        Route::post('tests/{test}/publish', [TestController::class, 'publish']);
        Route::post('tests/{test}/unpublish', [TestController::class, 'unpublish']);

        // Course outlines
        Route::apiResource('courses', CourseCRUDController::class);
        Route::post('courses/{course}/banner', [CourseCRUDController::class, 'uploadBanner']);
        Route::post('courses/{course}/modules', [CourseCRUDController::class, 'storeModule']);
        Route::put('modules/{module}', [CourseCRUDController::class, 'updateModule']);
        Route::delete('modules/{module}', [CourseCRUDController::class, 'destroyModule']);
        Route::post('modules/{module}/lessons', [CourseCRUDController::class, 'storeLesson']);
        Route::put('lessons/{lesson}', [CourseCRUDController::class, 'updateLesson']);
        Route::delete('lessons/{lesson}', [CourseCRUDController::class, 'destroyLesson']);

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

        // Payments
        Route::get('payments', [\App\Http\Controllers\Admin\PaymentHistoryController::class, 'index']);

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

        // Test taking
        Route::get('tests', [TestTakingController::class, 'availableTests']);
        Route::post('tests/{test}/start', [TestTakingController::class, 'start']);
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

        // Activation
        Route::get('activation-requests', [StudentActivationController::class, 'index']);
        Route::post('activation-requests', [StudentActivationController::class, 'requestActivation']);
        Route::post('activation-codes/redeem', [StudentActivationController::class, 'redeemCode']);

        // Payments
        Route::post('checkout/create-order', [\App\Http\Controllers\Student\PaymentController::class, 'createOrder']);
        Route::post('checkout/verify', [\App\Http\Controllers\Student\PaymentController::class, 'verifyPayment']);
        Route::post('checkout/validate-coupon', [\App\Http\Controllers\Student\PaymentController::class, 'validateCoupon']);

    });
});
