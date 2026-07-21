<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

/**
 * Bearer-token auth for the mobile app (Capacitor shell).
 *
 * The web SPA keeps Sanctum's cookie mode; mobile clients get a personal
 * access token instead (cookies + CSRF don't fit a WebView shell cleanly).
 * All existing auth:sanctum endpoints accept these tokens unchanged.
 *
 * Mobile is the STUDENT app: admin/super-admin accounts (mandatory TOTP
 * 2FA) are directed to the web dashboard rather than re-implementing the
 * 2FA challenge over tokens.
 */
class MobileAuthController extends Controller
{
    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::where('email', $request->email)->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            return response()->json([
                'message' => 'The provided credentials are incorrect.',
            ], 401);
        }

        // Same gate as web login: email must be verified first.
        if (! $user->hasVerifiedEmail()) {
            return response()->json([
                'message' => 'Please verify your email address before logging in. Check your inbox for the verification link.',
                'email_verified' => false,
            ], 403);
        }

        // Admin accounts require TOTP 2FA — web dashboard only.
        if ($user->hasAnyRole(['super-admin', 'admin'])) {
            return response()->json([
                'message' => 'Admin accounts must sign in on the web dashboard.',
                'admin_web_only' => true,
            ], 403);
        }

        $deviceName = substr($request->input('device_name', 'mobile'), 0, 100);
        $token = $user->createToken($deviceName)->plainTextToken;

        return response()->json([
            'message' => 'Login successful.',
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'email_verified' => $user->hasVerifiedEmail(),
                'phone_verified' => $user->hasVerifiedPhone(),
                'roles' => $user->getRoleNames(),
                'avatar' => $user->avatar,
            ],
        ]);
    }

    /**
     * Revoke the token that authenticated this request.
     */
    public function logout(Request $request): JsonResponse
    {
        $token = $request->user()->currentAccessToken();

        // Only bearer-token sessions have a revocable token; the web SPA's
        // cookie session logs out via the existing /logout endpoint.
        if ($token && method_exists($token, 'delete')) {
            $token->delete();
        }

        return response()->json([
            'message' => 'Logged out successfully.',
        ]);
    }
}
