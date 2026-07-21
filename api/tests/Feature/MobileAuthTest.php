<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MobileAuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(RolesAndPermissionsSeeder::class);
    }

    private function makeStudent(array $overrides = []): User
    {
        $user = User::factory()->create(array_merge([
            'email' => 'mobile-student@example.com',
            'password' => 'Password123',
            'email_verified_at' => now(),
        ], $overrides));
        $user->assignRole('student');

        return $user;
    }

    public function test_mobile_login_returns_token_and_user(): void
    {
        $this->makeStudent();

        $res = $this->postJson('/api/mobile/login', [
            'email' => 'mobile-student@example.com',
            'password' => 'Password123',
            'device_name' => 'Pixel 8',
        ]);

        $res->assertOk()
            ->assertJsonStructure(['token', 'user' => ['id', 'name', 'email', 'roles']])
            ->assertJsonPath('user.email', 'mobile-student@example.com');

        $this->assertDatabaseHas('personal_access_tokens', ['name' => 'Pixel 8']);
    }

    public function test_mobile_token_authenticates_protected_endpoints(): void
    {
        $this->makeStudent();

        $token = $this->postJson('/api/mobile/login', [
            'email' => 'mobile-student@example.com',
            'password' => 'Password123',
        ])->json('token');

        // Fresh request with ONLY the bearer token (no session cookie)
        $me = $this->withHeaders(['Authorization' => "Bearer {$token}"])
            ->getJson('/api/me');

        $me->assertOk()->assertJsonPath('user.email', 'mobile-student@example.com');
    }

    public function test_mobile_login_rejects_wrong_password(): void
    {
        $this->makeStudent();

        $this->postJson('/api/mobile/login', [
            'email' => 'mobile-student@example.com',
            'password' => 'WrongPassword1',
        ])->assertStatus(401);
    }

    public function test_mobile_login_rejects_unverified_email(): void
    {
        $this->makeStudent(['email_verified_at' => null]);

        $this->postJson('/api/mobile/login', [
            'email' => 'mobile-student@example.com',
            'password' => 'Password123',
        ])->assertStatus(403)->assertJsonPath('email_verified', false);
    }

    public function test_mobile_login_rejects_admin_accounts(): void
    {
        $admin = User::factory()->create([
            'email' => 'mobile-admin@example.com',
            'password' => 'Password123',
            'email_verified_at' => now(),
        ]);
        $admin->assignRole('admin');

        $this->postJson('/api/mobile/login', [
            'email' => 'mobile-admin@example.com',
            'password' => 'Password123',
        ])->assertStatus(403)->assertJsonPath('admin_web_only', true);
    }

    public function test_mobile_logout_revokes_the_token(): void
    {
        $this->makeStudent();

        $token = $this->postJson('/api/mobile/login', [
            'email' => 'mobile-student@example.com',
            'password' => 'Password123',
        ])->json('token');

        $this->withHeaders(['Authorization' => "Bearer {$token}"])
            ->postJson('/api/mobile/logout')
            ->assertOk();

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }
}
