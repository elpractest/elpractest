<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Setting;
use App\Models\AuditLog;
use Database\Seeders\RolesAndPermissionsSeeder;
use Database\Seeders\SuperAdminSeeder;
use Database\Seeders\DefaultSettingsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class SuperAdminManagementTest extends TestCase
{
    use RefreshDatabase;

    protected User $superAdmin;

    protected function setUp(): void
    {
        parent::setUp();

        // Seed roles & permissions, settings, and the super-admin
        $this->seed(RolesAndPermissionsSeeder::class);
        $this->seed(SuperAdminSeeder::class);
        $this->seed(DefaultSettingsSeeder::class);

        // Fetch super-admin and mock session as verified for 2FA bypass in tests
        $this->superAdmin = User::where('email', 'thevinstitution@gmail.com')->first();
    }

    protected function actingAsSuperAdmin(): self
    {
        $this->superAdmin->update([
            'google2fa_enabled' => true,
            'google2fa_secret' => '5SOPMH6I26QGPM4U',
        ]);

        return $this->actingAs($this->superAdmin)
            ->withSession(['2fa_verified' => true]);
    }

    /**
     * Helper to authenticate a generic admin with bypassed 2FA.
     */
    protected function actingAsAdmin(): self
    {
        $admin = User::factory()->create(['email_verified_at' => now()]);
        $admin->assignRole('admin');
        
        $admin->update([
            'google2fa_enabled' => true,
            'google2fa_secret' => '5SOPMH6I26QGPM4U',
        ]);

        return $this->actingAs($admin)
            ->withSession(['2fa_verified' => true]);
    }

    /**
     * Test 1: Super-admin can onboard exactly one Admin account.
     */
    public function test_super_admin_can_create_admin(): void
    {
        // Assert no admin exists initially
        $this->assertEquals(0, User::role('admin')->count());

        $response = $this->actingAsSuperAdmin()->postJson('/api/super-admin/admins', [
            'name' => 'Coaching Admin',
            'email' => 'instituteadmin@example.com',
            'password' => 'SecurePass123.',
            'phone' => '9876543210',
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('message', 'Admin account created successfully.');

        // Assert user created with admin role and verified email
        $admin = User::where('email', 'instituteadmin@example.com')->first();
        $this->assertNotNull($admin);
        $this->assertTrue($admin->hasRole('admin'));
        $this->assertNotNull($admin->email_verified_at);

        // Assert audit log exists
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $this->superAdmin->id,
            'action' => 'admin.created',
            'auditable_type' => User::class,
            'auditable_id' => $admin->id,
        ]);
    }

    /**
     * Test 2: Super-admin cannot create a second admin user.
     */
    public function test_super_admin_cannot_create_second_admin(): void
    {
        // Create first admin
        $admin1 = User::factory()->create();
        $admin1->assignRole('admin');

        $this->assertEquals(1, User::role('admin')->count());

        // Attempt to create second admin
        $response = $this->actingAsSuperAdmin()->postJson('/api/super-admin/admins', [
            'name' => 'Second Admin',
            'email' => 'admin2@example.com',
            'password' => 'SecurePass123.',
        ]);

        $response->assertStatus(400);
        $response->assertJsonPath('message', 'An Admin account already exists for this deployment.');
        
        // Assert second user was not created with admin role
        $this->assertEquals(1, User::role('admin')->count());
    }

    /**
     * Test 3: Admin creation is not blocked by RoleAttached guard.
     */
    public function test_admin_creation_not_blocked_by_role_attached_guard(): void
    {
        // This test validates that the RoleAttached event listener in AppServiceProvider 
        // does not throw an exception when the admin role is attached.
        $user = User::factory()->create();
        
        // Should not throw any exception
        $user->assignRole('admin');
        $this->assertTrue($user->hasRole('admin'));
    }

    /**
     * Test 4: Super-admin can reset the Admin password.
     */
    public function test_super_admin_can_reset_admin_password(): void
    {
        $admin = User::factory()->create();
        $admin->assignRole('admin');

        $response = $this->actingAsSuperAdmin()->postJson("/api/super-admin/admins/{$admin->id}/reset-password", [
            'password' => 'NewSecurePassword123.',
        ]);

        $response->assertStatus(200);
        $response->assertJsonPath('message', 'Admin password has been reset successfully.');

        // Reload user and verify password hash matches
        $admin->refresh();
        $this->assertTrue(Hash::check('NewSecurePassword123.', $admin->password));

        // Assert audit log exists
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $this->superAdmin->id,
            'action' => 'admin.password_reset',
            'auditable_type' => User::class,
            'auditable_id' => $admin->id,
        ]);
    }

    /**
     * Test 5: Super-admin cannot reset password of a non-admin.
     */
    public function test_super_admin_cannot_reset_non_admin_password(): void
    {
        $student = User::factory()->create();
        $student->assignRole('student');

        $response = $this->actingAsSuperAdmin()->postJson("/api/super-admin/admins/{$student->id}/reset-password", [
            'password' => 'NewSecurePassword123.',
        ]);

        $response->assertStatus(400);
        $response->assertJsonPath('message', 'This password reset action is only allowed for Admin accounts.');

        // Password should not match
        $student->refresh();
        $this->assertFalse(Hash::check('NewSecurePassword123.', $student->password));
    }

    /**
     * Test 6: Super-admin can upload branding images.
     */
    public function test_super_admin_can_upload_branding_logo(): void
    {
        Storage::fake('public');

        $logoFile = UploadedFile::fake()->image('logo.png');

        $response = $this->actingAsSuperAdmin()->postJson('/api/super-admin/settings/upload', [
            'file' => $logoFile,
            'type' => 'logo',
        ]);

        $response->assertStatus(200);
        $response->assertJsonStructure(['message', 'url']);

        $setting = Setting::where('key', 'site_logo')->first();
        $this->assertNotNull($setting);
        $this->assertStringContainsString($logoFile->hashName(), $setting->value);

        // Assert file exists on public disk
        Storage::disk('public')->assertExists('branding/' . $logoFile->hashName());

        // Assert audit log exists
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $this->superAdmin->id,
            'action' => 'settings.branding_uploaded',
            'auditable_type' => Setting::class,
            'auditable_id' => $setting->id,
        ]);
    }

    /**
     * Test 7: Super-admin can bulk update settings.
     */
    public function test_super_admin_can_bulk_update_settings(): void
    {
        $response = $this->actingAsSuperAdmin()->putJson('/api/super-admin/settings', [
            'settings' => [
                'site_name' => 'Elite Academy',
                'primary_color' => '#FF5733',
                'payment_gateway_enabled' => 'true',
            ],
        ]);

        $response->assertStatus(200);

        // Assert database values updated
        $this->assertEquals('Elite Academy', Setting::where('key', 'site_name')->first()->value);
        $this->assertEquals('#FF5733', Setting::where('key', 'primary_color')->first()->value);
        $this->assertEquals('true', Setting::where('key', 'payment_gateway_enabled')->first()->value);

        // Assert audit logs created
        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $this->superAdmin->id,
            'action' => 'settings.updated',
        ]);
    }

    /**
     * Test 8: Non-super-admin is blocked with 403 Forbidden.
     */
    public function test_admin_cannot_access_super_admin_routes(): void
    {
        $response1 = $this->actingAsAdmin()->getJson('/api/super-admin/settings');
        $response1->assertStatus(403);

        $response2 = $this->actingAsAdmin()->putJson('/api/super-admin/settings', [
            'settings' => ['site_name' => 'Hacked site'],
        ]);
        $response2->assertStatus(403);

        $response3 = $this->actingAsAdmin()->postJson('/api/super-admin/admins', [
            'name' => 'New Admin',
            'email' => 'admin3@example.com',
            'password' => 'SecurePass123.',
        ]);
        $response3->assertStatus(403);

        $response4 = $this->actingAsAdmin()->getJson('/api/super-admin/audit-logs');
        $response4->assertStatus(403);
    }
}
