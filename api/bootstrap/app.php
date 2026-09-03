<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->statefulApi();

        // Security headers on every API response (nosniff, frame-deny, CSP).
        $middleware->api(append: [
            \App\Http\Middleware\SecurityHeaders::class,
        ]);

        $middleware->alias([
            'role' => \Spatie\Permission\Middleware\RoleMiddleware::class,
            'permission' => \Spatie\Permission\Middleware\PermissionMiddleware::class,
            'role_or_permission' => \Spatie\Permission\Middleware\RoleOrPermissionMiddleware::class,
            '2fa.verified' => \App\Http\Middleware\Ensure2FAVerified::class,
            'recaptcha' => \App\Http\Middleware\VerifyRecaptcha::class,
        ]);
    })
    ->booting(function () {
        // ── Rate Limiters (specific numbers per the project spec) ──

        // Login: 5 attempts/min per IP+email combo
        RateLimiter::for('login', function (Request $request) {
            $key = $request->ip() . '|' . strtolower($request->input('email', ''));
            return Limit::perMinute(5)->by($key)->response(function () {
                return response()->json([
                    'message' => 'Too many login attempts. Please try again in a minute.',
                ], 429);
            });
        });

        // Register: 10/hour per IP (reCAPTCHA is primary defense; this is backstop)
        RateLimiter::for('register', function (Request $request) {
            return Limit::perHour(10)->by($request->ip())->response(function () {
                return response()->json([
                    'message' => 'Too many registration attempts. Please try again later.',
                ], 429);
            });
        });

        // OTP send: 3 per 10 minutes per phone number
        RateLimiter::for('otp-send', function (Request $request) {
            $phone = $request->input('phone', $request->ip());
            return Limit::perMinutes(10, 3)->by($phone)->response(function () {
                return response()->json([
                    'message' => 'Too many OTP requests. Please wait before trying again.',
                ], 429);
            });
        });

        // Email verification resend: 3/hour per email. Parity with
        // password-reset — without it the endpoint enables mail-bombing a
        // victim's inbox and timing-based user enumeration.
        RateLimiter::for('email-resend', function (Request $request) {
            $email = strtolower($request->input('email', $request->ip()));
            return Limit::perHour(3)->by($email)->response(function () {
                return response()->json([
                    'message' => 'Too many requests. Please try again later.',
                ], 429);
            });
        });

        // Password reset: 3/hour per email
        RateLimiter::for('password-reset', function (Request $request) {
            $email = strtolower($request->input('email', $request->ip()));
            return Limit::perHour(3)->by($email)->response(function () {
                return response()->json([
                    'message' => 'Too many password reset requests. Please try again later.',
                ], 429);
            });
        });

        // General API: 60 requests/min per user or IP
        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
        });

        // Starting a test: 10/min per student.
        //
        // Deliberately tighter than the general 60/min. This is the most
        // expensive student write path (a session plus one row per question),
        // and on a scheduled mock every candidate hits it inside the same
        // couple of minutes. A legitimate candidate calls it once — an
        // in-progress test resumes rather than starting a second session — so
        // 10 leaves plenty of room for a flaky connection and retries while
        // stopping one stuck client from hammering the spike.
        RateLimiter::for('test-start', function (Request $request) {
            return Limit::perMinute(10)->by($request->user()?->id ?: $request->ip())->response(function () {
                return response()->json([
                    'message' => 'Too many attempts to start a test. Please wait a moment and try again.',
                ], 429);
            });
        });

        // Practice-paper generation: 6/min per student. Each call writes a test,
        // a section and up to 100 pivot rows, and a student fiddling with the
        // filters can otherwise fire one per keystroke. Well clear of anyone
        // genuinely building a few papers in a sitting.
        RateLimiter::for('practice-build', function (Request $request) {
            return Limit::perMinute(6)->by($request->user()?->id ?: $request->ip())->response(function () {
                return response()->json([
                    'message' => 'You are building practice papers very quickly — please wait a moment.',
                ], 429);
            });
        });

        // Vajini chat: 20/min per student. Each request is an OpenAI call, so
        // this caps runaway cost from a hammered composer without hurting a
        // normal back-and-forth.
        RateLimiter::for('vajini', function (Request $request) {
            return Limit::perMinute(20)->by($request->user()?->id ?: $request->ip())->response(function () {
                return response()->json([
                    'message' => 'You are asking Vajini very quickly — please wait a moment.',
                ], 429);
            });
        });

        // Reader position sync: 40/min per student. The reader PATCHes on a 30s
        // timer, on tab-hide and on unmount, so a student with three materials
        // open across tabs is still nowhere near this. The cap exists because
        // this is the one student endpoint that writes on a timer rather than
        // on a tap — a stuck loop would otherwise write forever. A 429 here is
        // harmless: the reader treats a failed sync as "try again in 30s" and
        // never surfaces it, so reading is not interrupted.
        RateLimiter::for('reader-sync', function (Request $request) {
            return Limit::perMinute(40)->by($request->user()?->id ?: $request->ip());
        });
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
