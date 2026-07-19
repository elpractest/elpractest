<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Symfony\Component\HttpFoundation\Response;

/**
 * Validates Google reCAPTCHA v3 token server-side.
 *
 * Expects a 'recaptcha_token' field in the request.
 * Skipped in testing environment to avoid HTTP calls in tests.
 */
class VerifyRecaptcha
{
    public function handle(Request $request, Closure $next): Response
    {
        // Skip in testing
        if (app()->environment('testing')) {
            return $next($request);
        }

        // Skip if reCAPTCHA secret is not configured (local dev)
        $secret = config('services.recaptcha.secret_key');
        if (empty($secret)) {
            return $next($request);
        }

        $token = $request->input('recaptcha_token');

        if (empty($token)) {
            return response()->json([
                'message' => 'reCAPTCHA verification required.',
                'errors' => ['recaptcha_token' => ['reCAPTCHA token is missing.']],
            ], 422);
        }

        $response = Http::asForm()->post('https://www.google.com/recaptcha/api/siteverify', [
            'secret' => $secret,
            'response' => $token,
            'remoteip' => $request->ip(),
        ]);

        $result = $response->json();
        $minScore = (float) config('services.recaptcha.min_score', 0.5);

        if (! ($result['success'] ?? false) || ($result['score'] ?? 0) < $minScore) {
            return response()->json([
                'message' => 'reCAPTCHA verification failed. Please try again.',
                'errors' => ['recaptcha_token' => ['reCAPTCHA verification failed.']],
            ], 422);
        }

        return $next($request);
    }
}
