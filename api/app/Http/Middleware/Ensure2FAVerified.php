<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Ensures admin/super-admin users have 2FA set up AND verified for the current session.
 *
 * Two checks:
 * 1. If user has role admin|super-admin AND google2fa_enabled is false → force them to
 *    the 2FA setup flow. "Mandatory 2FA" means you cannot skip setup.
 * 2. If 2FA is enabled but not yet verified this session → force them to the verify flow.
 */
class Ensure2FAVerified
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user || ! $user->hasAnyRole(['super-admin', 'admin'])) {
            return $next($request);
        }

        // Check 1: 2FA not set up at all → force setup
        if (! $user->google2fa_enabled) {
            return response()->json([
                'message' => 'Two-factor authentication setup is required for admin accounts.',
                '2fa_required' => true,
                '2fa_setup_needed' => true,
            ], 403);
        }

        // Check 2: 2FA enabled but not verified this session → force verify
        if ($request->hasSession() && ! $request->session()->get('2fa_verified')) {
            return response()->json([
                'message' => 'Two-factor authentication verification required.',
                '2fa_required' => true,
                '2fa_setup_needed' => false,
            ], 403);
        }

        return $next($request);
    }
}
