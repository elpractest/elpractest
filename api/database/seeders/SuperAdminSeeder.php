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
        $email = env('SUPER_ADMIN_EMAIL', 'thevinstitution@gmail.com');
        $name = env('SUPER_ADMIN_NAME', 'Thevi Institution');
        $password = env('SUPER_ADMIN_PASSWORD', 'Vevgvbsm@vpdmns2710.');

        // Check if user already exists by email
        $user = User::where('email', $email)->first();

        if (!$user) {
            $user = User::create([
                'name' => $name,
                'email' => $email,
                'password' => Hash::make($password),
                'email_verified_at' => now(),
            ]);
            
            $user->assignRole('super-admin');
        }
    }
}
