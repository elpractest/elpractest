<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RolesAndPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        // Reset cached roles and permissions
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        // ── Permissions ────────────────────────────────────────────

        // Student permissions
        Permission::create(['name' => 'view courses']);
        Permission::create(['name' => 'view enrolled courses']);
        Permission::create(['name' => 'request activation']);
        Permission::create(['name' => 'redeem code']);
        Permission::create(['name' => 'attempt test']);
        Permission::create(['name' => 'view own analytics']);
        Permission::create(['name' => 'view lessons']);

        // Admin permissions
        Permission::create(['name' => 'manage students']);
        Permission::create(['name' => 'manage courses']);
        Permission::create(['name' => 'manage modules']);
        Permission::create(['name' => 'manage lessons']);
        Permission::create(['name' => 'manage questions']);
        Permission::create(['name' => 'manage tests']);
        Permission::create(['name' => 'manage batches']);
        Permission::create(['name' => 'manage activation requests']);
        Permission::create(['name' => 'manage activation codes']);
        Permission::create(['name' => 'view student analytics']);
        Permission::create(['name' => 'view batch analytics']);
        Permission::create(['name' => 'manage contact messages']);

        // Super-Admin only permissions
        Permission::create(['name' => 'manage settings']);
        Permission::create(['name' => 'manage admins']);
        Permission::create(['name' => 'manage feature flags']);
        Permission::create(['name' => 'view platform analytics']);
        Permission::create(['name' => 'view audit logs']);

        // Re-clear cache after creating all permissions so they can be found by name
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        // ── Roles ──────────────────────────────────────────────────

        $student = Role::create(['name' => 'student']);
        $student->givePermissionTo([
            'view courses',
            'view enrolled courses',
            'request activation',
            'redeem code',
            'attempt test',
            'view own analytics',
            'view lessons',
        ]);

        $admin = Role::create(['name' => 'admin']);
        $admin->givePermissionTo([
            // Inherits student-level view permissions
            'view courses',
            'view enrolled courses',
            'view lessons',
            // Admin-specific
            'manage students',
            'manage courses',
            'manage modules',
            'manage lessons',
            'manage questions',
            'manage tests',
            'manage batches',
            'manage activation requests',
            'manage activation codes',
            'view student analytics',
            'view batch analytics',
            'manage contact messages',
        ]);

        // Super-Admin gets everything
        $superAdmin = Role::create(['name' => 'super-admin']);
        $superAdmin->givePermissionTo(Permission::all());
    }
}
