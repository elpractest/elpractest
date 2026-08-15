<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Services\SocialAuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

/**
 * Native social sign-in for the mobile app.
 *
 * The web flow (SocialAuthController) is a browser OAuth redirect that ends in a
 * cookie session — no use to a bearer-token app. Here the device does the Google
 * sign-in natively (google_sign_in) and sends us the resulting ID token; we
 * verify it server-side, resolve the user via the SAME link-or-create logic as
 * the web callback, and hand back a Sanctum bearer token exactly like
 * /mobile/login. No Firebase Auth, no second identity store.
 */
class MobileSocialAuthController extends Controller
{
    public function __construct(private SocialAuthService $social)
    {
    }

    public function google(Request $request): JsonResponse
    {
        $request->validate(['id_token' => ['required', 'string']]);

        // Verify the ID token with Google (dependency-free: Google validates the
        // signature + expiry and returns the claims). Local JWKS verification is
        // an option at higher volume; tokeninfo is fine here.
        $resp = Http::get('https://oauth2.googleapis.com/tokeninfo', [
            'id_token' => $request->input('id_token'),
        ]);

        if ($resp->failed()) {
            return response()->json(['message' => 'Invalid Google token.'], 401);
        }

        $claims = $resp->json();

        // The token MUST be minted for our OAuth client, or anyone's Google token
        // would log in. google_sign_in uses this same id as its serverClientId so
        // the audience matches. Prefer the mobile-specific client (the Firebase
        // project's web client); fall back to the web-login client.
        $expectedAud = config('services.google.mobile_client_id') ?: config('services.google.client_id');
        if (! $expectedAud || ($claims['aud'] ?? null) !== $expectedAud) {
            return response()->json(['message' => 'This token was not issued for Practest.'], 401);
        }

        if (! filter_var($claims['email_verified'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
            return response()->json(['message' => 'Your Google email is not verified.'], 401);
        }

        $sub = $claims['sub'] ?? null;
        $email = $claims['email'] ?? null;
        if (! $sub || ! $email) {
            return response()->json(['message' => 'Invalid Google token.'], 401);
        }

        $user = $this->social->findOrCreate(
            'google',
            $sub,
            $email,
            $claims['name'] ?? null,
            $claims['picture'] ?? null,
        );

        // Admins/super-admins use the web dashboard (mandatory TOTP 2FA), same as
        // /mobile/login.
        if ($user->hasAnyRole(['super-admin', 'admin'])) {
            return response()->json([
                'message' => 'Admin accounts must sign in on the web dashboard.',
                'admin_web_only' => true,
            ], 403);
        }

        $token = $user->createToken('Practest Android (Google)')->plainTextToken;

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
}
