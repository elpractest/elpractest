<?php

namespace Tests\Feature;

use App\Models\SocialAccount;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Step 4 — native Google sign-in for the mobile app (POST /mobile/social/google).
 * Google's tokeninfo endpoint is faked so no network is hit.
 */
class MobileGoogleAuthTest extends TestCase
{
    use RefreshDatabase;

    private const AUD = 'practest-web-client.apps.googleusercontent.com';

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);
        config()->set('services.google.client_id', self::AUD);
    }

    private function fakeTokenInfo(array $overrides = []): void
    {
        Http::fake([
            'oauth2.googleapis.com/tokeninfo*' => Http::response(array_merge([
                'aud' => self::AUD,
                'sub' => 'google-sub-123',
                'email' => 'newgoogle@gmail.com',
                'email_verified' => 'true',
                'name' => 'Goo Gle',
                'picture' => 'https://example.com/a.png',
            ], $overrides), 200),
        ]);
    }

    public function test_new_google_user_is_created_as_student_and_gets_a_token(): void
    {
        $this->fakeTokenInfo();

        $res = $this->postJson('/api/mobile/social/google', ['id_token' => 'x'])
            ->assertOk()
            ->assertJsonStructure(['token', 'user' => ['id', 'email', 'roles']]);

        $this->assertNotEmpty($res->json('token'));
        $user = User::where('email', 'newgoogle@gmail.com')->first();
        $this->assertNotNull($user);
        $this->assertTrue($user->hasRole('student'));
        $this->assertDatabaseHas('social_accounts', [
            'user_id' => $user->id, 'provider' => 'google', 'provider_id' => 'google-sub-123',
        ]);
    }

    public function test_existing_email_is_linked_not_duplicated(): void
    {
        $existing = User::factory()->create(['email' => 'newgoogle@gmail.com']);
        $existing->assignRole('student');
        $this->fakeTokenInfo();

        $this->postJson('/api/mobile/social/google', ['id_token' => 'x'])->assertOk();

        $this->assertSame(1, User::where('email', 'newgoogle@gmail.com')->count());
        $this->assertDatabaseHas('social_accounts', [
            'user_id' => $existing->id, 'provider' => 'google',
        ]);
    }

    public function test_token_for_a_different_audience_is_rejected(): void
    {
        $this->fakeTokenInfo(['aud' => 'someone-elses-client.apps.googleusercontent.com']);

        $this->postJson('/api/mobile/social/google', ['id_token' => 'x'])
            ->assertStatus(401);
    }

    public function test_unverified_google_email_is_rejected(): void
    {
        $this->fakeTokenInfo(['email_verified' => 'false']);

        $this->postJson('/api/mobile/social/google', ['id_token' => 'x'])
            ->assertStatus(401);
    }

    public function test_admin_is_directed_to_the_web_dashboard(): void
    {
        $admin = User::factory()->create(['email' => 'newgoogle@gmail.com']);
        $admin->assignRole('admin');
        $this->fakeTokenInfo();

        $this->postJson('/api/mobile/social/google', ['id_token' => 'x'])
            ->assertStatus(403)
            ->assertJsonPath('admin_web_only', true);
    }

    public function test_public_settings_expose_the_google_client_id(): void
    {
        $this->getJson('/api/settings/public')
            ->assertOk()
            ->assertJsonPath('settings.google_client_id', self::AUD);
    }

    public function test_mobile_client_id_overrides_the_web_login_client(): void
    {
        // Web login uses one client; mobile (Firebase project) uses another.
        config()->set('services.google.client_id', 'web-login.apps.googleusercontent.com');
        config()->set('services.google.mobile_client_id', self::AUD);

        // The app is handed the MOBILE client id, not the web-login one.
        $this->getJson('/api/settings/public')
            ->assertJsonPath('settings.google_client_id', self::AUD);

        // A token minted for the mobile client is accepted even though it differs
        // from the web-login GOOGLE_CLIENT_ID. (Rejection of a wrong audience is
        // covered by test_token_for_a_different_audience_is_rejected.)
        $this->fakeTokenInfo(['aud' => self::AUD]);
        $this->postJson('/api/mobile/social/google', ['id_token' => 'x'])->assertOk();
    }
}
