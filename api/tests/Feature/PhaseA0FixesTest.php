<?php

namespace Tests\Feature;

use App\Models\Batch;
use App\Models\Course;
use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;
use Laravel\Socialite\Facades\Socialite;
use Mockery;
use Tests\TestCase;

class PhaseA0FixesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);
    }

    // ── Fix #1: FRONTEND_URL config key ──────────────────────────

    public function test_frontend_url_config_key_exists_and_reads_env(): void
    {
        $value = config('app.frontend_url');
        $this->assertNotNull($value);
        $this->assertIsString($value);
        // Default fallback is http://localhost:3000
        $this->assertEquals('http://localhost:3000', $value);
    }

    // ── Fix #2: Password-reset email URL shape ──────────────────

    public function test_password_reset_email_contains_frontend_url(): void
    {
        Notification::fake();

        $user = User::factory()->create([
            'email' => 'resetme@example.com',
            'email_verified_at' => now(),
        ]);
        $user->assignRole('student');

        $this->postJson('/api/forgot-password', [
            'email' => 'resetme@example.com',
        ])->assertOk();

        Notification::assertSentTo($user, ResetPassword::class, function ($notification) use ($user) {
            $url = $notification->toMail($user)->actionUrl;
            $frontendUrl = config('app.frontend_url');

            // URL must point to the SPA, not the API
            $this->assertStringStartsWith($frontendUrl . '/reset-password?token=', $url);
            $this->assertStringContainsString('email=' . urlencode($user->email), $url);

            return true;
        });
    }

    // ── Fix #3: Email-verification link URL shape ────────────────

    public function test_email_verification_link_points_to_frontend(): void
    {
        Notification::fake();

        $response = $this->postJson('/api/register', [
            'name' => 'Verify Test',
            'email' => 'verifyme@example.com',
            'password' => 'Password1',
            'password_confirmation' => 'Password1',
        ]);

        $response->assertStatus(201);

        $user = User::where('email', 'verifyme@example.com')->first();

        Notification::assertSentTo($user, VerifyEmail::class, function ($notification) use ($user) {
            $url = $notification->toMail($user)->actionUrl;
            $frontendUrl = config('app.frontend_url');

            $expectedHash = sha1($user->getEmailForVerification());

            // URL must point to the SPA page, not the API
            $this->assertStringStartsWith($frontendUrl . '/verify-email?id=', $url);
            $this->assertStringContainsString("hash={$expectedHash}", $url);

            return true;
        });
    }

    // ── Fix #4: Social callback redirects ────────────────────────

    public function test_social_callback_success_redirects_to_frontend_dashboard(): void
    {
        $socialUser = Mockery::mock('Laravel\Socialite\Two\User');
        $socialUser->shouldReceive('getId')->andReturn('social-fix4-id');
        $socialUser->shouldReceive('getEmail')->andReturn('social-fix4@example.com');
        $socialUser->shouldReceive('getName')->andReturn('Social Fix4 User');
        $socialUser->shouldReceive('getNickname')->andReturn('socialfix4');
        $socialUser->shouldReceive('getAvatar')->andReturn('http://example.com/avatar.jpg');

        $providerMock = Mockery::mock('Laravel\Socialite\Two\AbstractProvider');
        $providerMock->shouldReceive('stateless')->andReturnSelf();
        $providerMock->shouldReceive('user')->andReturn($socialUser);

        Socialite::shouldReceive('driver')->with('google')->andReturn($providerMock);

        $response = $this->withHeaders([
            'Referer' => 'http://localhost:3000',
        ])->withSession([])->get('/api/auth/google/callback');

        $response->assertRedirect(config('app.frontend_url') . '/dashboard');
    }

    public function test_social_callback_failure_redirects_to_frontend_login_with_error(): void
    {
        $providerMock = Mockery::mock('Laravel\Socialite\Two\AbstractProvider');
        $providerMock->shouldReceive('stateless')->andReturnSelf();
        $providerMock->shouldReceive('user')->andThrow(new \Exception('OAuth failed'));

        Socialite::shouldReceive('driver')->with('google')->andReturn($providerMock);

        $response = $this->withHeaders([
            'Referer' => 'http://localhost:3000',
        ])->withSession([])->get('/api/auth/google/callback');

        $response->assertRedirect(config('app.frontend_url') . '/login?error=social_failed');
    }

    // ── Fix #5: Phone gate on activation requests ────────────────

    public function test_activation_request_rejected_when_phone_not_verified(): void
    {
        Storage::fake('local');

        $student = User::factory()->create(['phone_verified_at' => null]);
        $student->assignRole('student');

        $course = Course::create([
            'title' => 'Test Course',
            'slug' => 'test-course',
            'description' => 'Test',
            'mode' => 'live',
            'exam_category' => 'SSC',
        ]);

        $batch = Batch::create([
            'course_id' => $course->id,
            'name' => 'Test Batch',
            'max_students' => 10,
        ]);

        $file = UploadedFile::fake()->create('receipt.png', 500);

        $response = $this->actingAs($student)->postJson('/api/student/activation-requests', [
            'batch_id' => $batch->id,
            'payment_reference' => 'TXN-PHONE-GATE-TEST',
            'proof_document' => $file,
        ]);

        $response->assertStatus(403)
            ->assertJson([
                'message' => 'Please verify your phone number first.',
                'phone_verified' => false,
            ]);
    }

    public function test_activation_request_allowed_when_phone_verified(): void
    {
        Storage::fake('local');

        $student = User::factory()->create(['phone_verified_at' => now()]);
        $student->assignRole('student');

        $course = Course::create([
            'title' => 'Test Course 2',
            'slug' => 'test-course-2',
            'description' => 'Test',
            'mode' => 'live',
            'exam_category' => 'SSC',
        ]);

        $batch = Batch::create([
            'course_id' => $course->id,
            'name' => 'Test Batch 2',
            'max_students' => 10,
        ]);

        $file = UploadedFile::fake()->create('receipt.png', 500);

        $response = $this->actingAs($student)->postJson('/api/student/activation-requests', [
            'batch_id' => $batch->id,
            'payment_reference' => 'TXN-PHONE-OK-TEST',
            'proof_document' => $file,
        ]);

        $response->assertStatus(201);
    }
}
