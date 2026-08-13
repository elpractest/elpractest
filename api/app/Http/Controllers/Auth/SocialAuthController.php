<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\SocialAccount;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Laravel\Socialite\Facades\Socialite;

class SocialAuthController extends Controller
{
    /**
     * Supported OAuth providers.
     */
    private const PROVIDERS = ['google', 'facebook'];

    /**
     * Redirect to the OAuth provider.
     */
    public function redirect(string $provider): JsonResponse|\Illuminate\Http\RedirectResponse
    {
        if (! in_array($provider, self::PROVIDERS)) {
            return response()->json(['message' => 'Unsupported provider.'], 422);
        }

        return Socialite::driver($provider)->stateless()->redirect();
    }

    /**
     * Handle the OAuth callback.
     *
     * Creates or links the social account, then logs in.
     * If the user registers via social login, they get auto-verified email.
     * Redirects to the SPA (not JSON) because this is a full-page browser navigation.
     */
    public function callback(Request $request, string $provider): JsonResponse|\Illuminate\Http\RedirectResponse
    {
        if (! in_array($provider, self::PROVIDERS)) {
            return response()->json(['message' => 'Unsupported provider.'], 422);
        }

        try {
            $socialUser = Socialite::driver($provider)->stateless()->user();
        } catch (\Exception $e) {
            return redirect(config('app.frontend_url') . '/login?error=social_failed');
        }

        // Check if this social account is already linked
        $socialAccount = SocialAccount::where('provider', $provider)
            ->where('provider_id', $socialUser->getId())
            ->first();

        if ($socialAccount) {
            // Existing social account — log in
            $user = $socialAccount->user;
        } else {
            // Check if a user with this email already exists
            $user = User::where('email', $socialUser->getEmail())->first();

            if (! $user) {
                // Create new user (social signup = auto-verified email)
                $user = User::create([
                    'name' => $socialUser->getName() ?? $socialUser->getNickname() ?? 'User',
                    'email' => $socialUser->getEmail(),
                    'email_verified_at' => now(),
                    'avatar' => $socialUser->getAvatar(),
                ]);

                $user->assignRole('student');
            }

            // Link social account to user
            $user->socialAccounts()->create([
                'provider' => $provider,
                'provider_id' => $socialUser->getId(),
            ]);
        }

        Auth::login($user);
        // Regenerate only when a session is actually bound to the request. The
        // OAuth callback lands on a stateful browser request in production (session
        // present → regenerated as before), but the same route with no session
        // store must not fatal on ->session().
        if ($request->hasSession()) {
            $request->session()->regenerate();
        }

        return redirect(config('app.frontend_url') . '/dashboard');
    }
}
