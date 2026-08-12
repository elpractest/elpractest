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
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
