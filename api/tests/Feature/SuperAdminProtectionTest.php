<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\SuperAdminSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Laravel\Socialite\Facades\Socialite;
use Mockery;
use Tests\TestCase;

class SuperAdminProtectionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        // Seed roles & permissions and the super-admin
        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);
        $this->seed(SuperAdminSeeder::class);
    }

    /**
     * Test 1: Register with role: "super-admin" in payload silently ignores it.
     */
    public function test_register_with_super_admin_role_in_payload_is_ignored(): void
    {
        $response = $this->postJson('/api/register', [
            'name' => 'Attempted Hacker',
            'email' => 'hacker@example.com',
            'password' => 'HackerPass123.',
            'password_confirmation' => 'HackerPass123.',
            'phone' => '9999999999',
            'role' => 'super-admin',
        ]);

        $response->assertStatus(201);
        
        $user = User::where('email', 'hacker@example.com')->first();
        $this->assertNotNull($user);
        $this->assertTrue($user->hasRole('student'));
        $this->assertFalse($user->hasRole('super-admin'));
    }

    /**
     * Test 2: Social login always gets student role.
     */
    public function test_social_login_always_assigns_student_role(): void
    {
        $socialUser = Mockery::mock('Laravel\Socialite\Two\User');
        $socialUser->shouldReceive('getId')->andReturn('123456');
        $socialUser->shouldReceive('getEmail')->andReturn('oauth-student@example.com');
        $socialUser->shouldReceive('getName')->andReturn('OAuth Student');
        $socialUser->shouldReceive('getNickname')->andReturn('oauthstudent');
        $socialUser->shouldReceive('getAvatar')->andReturn('http://example.com/avatar.jpg');

        $providerMock = Mockery::mock('Laravel\Socialite\Two\AbstractProvider');
        $providerMock->shouldReceive('stateless')->andReturnSelf();
        $providerMock->shouldReceive('user')->andReturn($socialUser);

        Socialite::shouldReceive('driver')->with('google')->andReturn($providerMock);

        $response = $this->withHeaders([
            'Referer' => 'http://localhost:3000',
        ])->withSession([])->get('/api/auth/google/callback');
        $response->assertRedirect(config('app.frontend_url') . '/dashboard');

        $user = User::where('email', 'oauth-student@example.com')->first();
        $this->assertNotNull($user);
        $this->assertTrue($user->hasRole('student'));
        $this->assertFalse($user->hasRole('super-admin'));
    }

    /**
     * Test 3: Directly attempt to assign super-admin to a second user is rejected.
     */
    public function test_assigning_super_admin_role_to_unauthorized_user_throws_exception(): void
    {
        $user = User::factory()->create([
            'email' => 'regular@example.com',
        ]);

        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('Only the designated super-admin email can be assigned the super-admin role.');
        
        $user->assignRole('super-admin');
    }

    /**
     * Test 4: Run SuperAdminSeeder twice leaves exactly one super-admin and password untouched.
     */
    public function test_super_admin_seeder_is_idempotent_and_does_not_overwrite_password(): void
    {
        $superAdmin = User::where('email', 'thevinstitution@gmail.com')->first();
        $originalHash = $superAdmin->password;

        // Run seeder again
        $this->seed(SuperAdminSeeder::class);

        $superAdminReloaded = User::where('email', 'thevinstitution@gmail.com')->first();
        $this->assertEquals($originalHash, $superAdminReloaded->password);

        $superAdminCount = User::role('super-admin')->count();
        $this->assertEquals(1, $superAdminCount);
    }

    /**
     * Test 5: Attempt to delete or suspend super-admin account returns 403.
     */
    public function test_super_admin_account_cannot_be_deleted_or_have_email_changed(): void
    {
        $superAdmin = User::where('email', 'thevinstitution@gmail.com')->first();

        // 1. Delete model directly
        try {
            $superAdmin->delete();
            $this->fail('Expected deletion to be blocked.');
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            $this->assertEquals(403, $e->getStatusCode());
            $this->assertEquals('The super-admin account cannot be deleted.', $e->getMessage());
        }

        // Verify account still exists
        $this->assertDatabaseHas('users', ['email' => 'thevinstitution@gmail.com']);

        // 2. Edit email directly
        try {
            $superAdmin->update(['email' => 'new-email@example.com']);
            $this->fail('Expected email update to be blocked.');
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            $this->assertEquals(403, $e->getStatusCode());
            $this->assertEquals('The super-admin email address cannot be changed.', $e->getMessage());
        }

        // Verify email untouched
        $superAdmin->refresh();
        $this->assertEquals('thevinstitution@gmail.com', $superAdmin->email);
    }

    /**
     * Test 6: Query all users with super-admin role always resolves to exactly one row.
     */
    public function test_query_super_admin_role_resolves_to_exactly_one_row(): void
    {
        $users = User::role('super-admin')->get();
        $this->assertCount(1, $users);
        $this->assertEquals('thevinstitution@gmail.com', $users->first()->email);
    }

    /**
     * Test 7: Attempting to remove the super-admin role from the designated account throws.
     */
    public function test_super_admin_role_cannot_be_removed_from_super_admin_account(): void
    {
        $superAdmin = User::where('email', 'thevinstitution@gmail.com')->first();

        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('The super-admin role cannot be removed from this account.');

        $superAdmin->removeRole('super-admin');
    }

    /**
     * Test 8: Attempting to sync roles without super-admin on the designated account throws.
     */
    public function test_sync_roles_without_super_admin_on_super_admin_account_throws(): void
    {
        $superAdmin = User::where('email', 'thevinstitution@gmail.com')->first();

        $this->expectException(\Exception::class);
        $this->expectExceptionMessage('The super-admin role cannot be removed from this account.');

        $superAdmin->syncRoles(['student']);
    }
}
