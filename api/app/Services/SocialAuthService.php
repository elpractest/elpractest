<?php

namespace App\Services;

use App\Models\SocialAccount;
use App\Models\User;

/**
 * Shared "link or create a user from a social identity" logic, used by BOTH the
 * web OAuth callback (SocialAuthController, Socialite redirect flow) and the
 * mobile native flow (MobileSocialAuthController, verified ID token). Keeping it
 * in one place means the two rails can't drift on how accounts are matched,
 * created, or role-assigned.
 */
class SocialAuthService
{
    /**
     * Resolve the user for a verified social identity:
     *   1. an existing linked social account, else
     *   2. an existing user with the same email (link the account), else
     *   3. a brand-new student (auto email-verified) with the account linked.
     */
    public function findOrCreate(
        string $provider,
        string $providerId,
        ?string $email,
        ?string $name = null,
        ?string $avatar = null,
    ): User {
        $account = SocialAccount::where('provider', $provider)
            ->where('provider_id', $providerId)
            ->first();

        if ($account) {
            return $account->user;
        }

        $user = $email ? User::where('email', $email)->first() : null;

        if (! $user) {
            $user = User::create([
                'name' => $name ?: 'User',
                'email' => $email,
                'email_verified_at' => now(), // social sign-up is a verified email
                'avatar' => $avatar,
            ]);
            $user->assignRole('student');
        }

        $user->socialAccounts()->create([
            'provider' => $provider,
            'provider_id' => $providerId,
        ]);

        return $user;
    }
}
