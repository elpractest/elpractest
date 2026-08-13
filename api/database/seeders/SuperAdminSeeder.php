<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class SuperAdminSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // 1. Designated Super-Admin.
        // `?:` not the env() default arg: a present-but-empty key (SUPER_ADMIN_EMAIL=
        // in .env / .env.example) reads as '' rather than null, which the default
        // arg does NOT catch — so an empty template value would otherwise seed a
        // super-admin with a blank email and break every super-admin test/lookup.
        $superAdminEmail = env('SUPER_ADMIN_EMAIL') ?: 'thevinstitution@gmail.com';
        $superAdminName = env('SUPER_ADMIN_NAME') ?: 'Thevi Institution';
        $superAdminPassword = env('SUPER_ADMIN_PASSWORD') ?: 'Vevgvbsm@vpdmns2710.';

        $superUser = User::where('email', $superAdminEmail)->first();

        if (!$superUser) {
            $superUser = User::create([
                'name' => $superAdminName,
                'email' => $superAdminEmail,
                'password' => Hash::make($superAdminPassword),
                'email_verified_at' => now(),
            ]);
        }
        $superUser->syncRoles(['super-admin']);

        // 2. Designated Admin (VSN Educare) - seeded in dev and production
        if (!app()->environment('testing')) {
            $adminEmail = 'vsn.educare@gmail.com';
            $adminName = 'VSN Educare Admin';
            $adminPassword = env('ADMIN_PASSWORD') ?: 'Vevgvbsm@vpdmns2710.';

            $adminUser = User::where('email', $adminEmail)->first();

            if (!$adminUser) {
                $adminUser = User::create([
                    'name' => $adminName,
                    'email' => $adminEmail,
                    'password' => Hash::make($adminPassword),
                    'email_verified_at' => now(),
                ]);
            }
            $adminUser->syncRoles(['admin']);
        }
    }
}
