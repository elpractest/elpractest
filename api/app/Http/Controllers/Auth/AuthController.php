<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;

class AuthController extends Controller
{
    /**
     * Register a new student account.
     */
    public function register(RegisterRequest $request): JsonResponse
    {
        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => $request->password, // hashed via cast
            'phone' => $request->phone,
        ]);

        $user->assignRole('student');

        // Fires email verification notification
        event(new Registered($user));

        return response()->json([
            'message' => 'Registration successful. Please check your email to verify your account.',
            'user' => $this->userResponse($user),
        ], 201);
    }

    /**
     * Log in with email + password.
     *
     * Gates:
     * - Rejects unverified email with clear message (per spec)
     * - Returns 2fa_required flag for admin/super-admin roles
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::where('email', $request->email)->first();

        if (! $user || ! Hash::check($request->password, $user->password)) {
            return response()->json([
                'message' => 'The provided credentials are incorrect.',
            ], 401);
        }

        // Gate: email must be verified before login is allowed
        if (! $user->hasVerifiedEmail()) {
            return response()->json([
                'message' => 'Please verify your email address before logging in. Check your inbox for the verification link.',
                'email_verified' => false,
            ], 403);
        }

        Auth::login($user);
        $request->session()->regenerate();

        // For admin/super-admin: check if 2FA is needed
        $needs2FA = $user->hasAnyRole(['super-admin', 'admin']);
        $needs2FASetup = $needs2FA && ! $user->google2fa_enabled;

        // LOCAL DEV ONLY — mirrors the guard in Ensure2FAVerified: when the local
        // 2FA bypass flag is on, report no 2FA so the SPA lands straight on the
        // console. Never fires outside APP_ENV=local. Revert with that middleware.
        if (app()->environment('local') && env('LOCAL_2FA_BYPASS', false)) {
            $needs2FA = false;
            $needs2FASetup = false;
        }

        return response()->json([
            'message' => 'Login successful.',
            'user' => $this->userResponse($user),
            '2fa_required' => $needs2FA,
            '2fa_setup_needed' => $needs2FASetup,
        ]);
    }

    /**
     * Log out the current user.
     */
    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json([
            'message' => 'Logged out successfully.',
        ]);
    }

    /**
     * Get the authenticated user's profile.
     */
    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'user' => $this->userResponse($request->user()),
        ]);
    }

    /**
     * Resend the email verification notification.
     */
    public function resendVerification(Request $request): JsonResponse
    {
        $request->validate(['email' => 'required|email']);

        $user = User::where('email', $request->email)->first();

        if (! $user) {
            // Don't reveal whether the email exists
            return response()->json([
                'message' => 'If an account exists with that email, a verification link has been sent.',
            ]);
        }

        if ($user->hasVerifiedEmail()) {
            return response()->json([
                'message' => 'Email is already verified.',
            ]);
        }

        $user->sendEmailVerificationNotification();

        return response()->json([
            'message' => 'Verification link sent. Please check your email.',
        ]);
    }

    /**
     * Verify email from the signed URL.
     */
    public function verifyEmail(Request $request, int $id, string $hash): JsonResponse
    {
        $user = User::findOrFail($id);

        if (! hash_equals(sha1($user->getEmailForVerification()), $hash)) {
            return response()->json(['message' => 'Invalid verification link.'], 403);
        }

        if ($user->hasVerifiedEmail()) {
            return response()->json(['message' => 'Email already verified.']);
        }

        $user->markEmailAsVerified();

        return response()->json(['message' => 'Email verified successfully. You can now log in.']);
    }

    /**
     * Format user response with role info.
     */
    private function userResponse(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'email_verified' => $user->hasVerifiedEmail(),
            'phone_verified' => $user->hasVerifiedPhone(),
            'roles' => $user->getRoleNames(),
            'avatar' => $user->avatar,
        ];
    }
}
