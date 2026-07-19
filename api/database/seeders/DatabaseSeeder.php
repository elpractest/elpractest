<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Create roles and permissions first
        $this->call(RolesAndPermissionsSeeder::class);

        // Seed default white-label settings
        $this->call(DefaultSettingsSeeder::class);

        // Create designated super-admin account
        $this->call(SuperAdminSeeder::class);

        // Create test development data (dev only)
        if (app()->environment('local', 'testing')) {
            $this->call(DevTestDataSeeder::class);
        }
    }
}
