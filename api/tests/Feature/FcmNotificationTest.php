<?php

namespace Tests\Feature;

use App\Models\ActivationCode;
use App\Models\ActivationRequest;
use App\Models\Batch;
use App\Models\Course;
use App\Models\DeviceToken;
use App\Models\Enrollment;
use App\Models\User;
use App\Notifications\ActivationApproved;
use App\Notifications\ActivationRejected;
use App\Notifications\Channels\FcmChannel;
use App\Notifications\EnrolledInCourse;
use App\Notifications\NewMockPublished;
use App\Jobs\FanOutContentNotification;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/**
 * FCM v1.1 — step 2: notifications fire at their trigger points, the fan-out
 * targets the right audience, and the fcm channel is only added when the user
 * has a device token.
 */
class FcmNotificationTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $student;
    private Course $course;
    private Batch $batch;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);

        $this->admin = User::factory()->create(['google2fa_enabled' => true, 'google2fa_secret' => 'B39XKJ2938JJD982']);
        $this->admin->assignRole('admin');

        $this->student = User::factory()->create(['phone_verified_at' => now()]);
        $this->student->assignRole('student');

        $this->course = Course::create([
            'title' => 'SSC CGL 2026', 'slug' => 'ssc-cgl-2026',
            'description' => 'Tier-1', 'mode' => 'live', 'exam_category' => 'SSC',
        ]);
        $this->batch = Batch::create(['course_id' => $this->course->id, 'name' => 'Batch A', 'max_students' => 100]);
    }

    public function test_approving_an_activation_notifies_the_student(): void
    {
        Notification::fake();

        $req = ActivationRequest::create([
            'user_id' => $this->student->id, 'batch_id' => $this->batch->id,
            'payment_reference' => 'UTR123', 'proof_document_path' => 'proofs/x.jpg', 'status' => 'pending',
        ]);

        $this->actingAs($this->admin)
            ->postJson("/api/admin/activation-requests/{$req->id}/approve")
            ->assertOk();

        Notification::assertSentTo($this->student, ActivationApproved::class);
    }

    public function test_rejecting_an_activation_notifies_the_student(): void
    {
        Notification::fake();

        $req = ActivationRequest::create([
            'user_id' => $this->student->id, 'batch_id' => $this->batch->id,
            'payment_reference' => 'UTR123', 'proof_document_path' => 'proofs/x.jpg', 'status' => 'pending',
        ]);

        $this->actingAs($this->admin)
            ->postJson("/api/admin/activation-requests/{$req->id}/reject", ['reason' => 'Blurry proof'])
            ->assertOk();

        Notification::assertSentTo($this->student, ActivationRejected::class);
    }

    public function test_redeeming_a_code_notifies_the_student(): void
    {
        Notification::fake();

        ActivationCode::create([
            'code' => 'PRAC8821', 'course_id' => $this->course->id, 'batch_id' => $this->batch->id,
            'max_uses' => 1, 'times_used' => 0, 'expires_at' => now()->addDays(7), 'generated_by' => $this->admin->id,
        ]);

        $this->actingAs($this->student)
            ->postJson('/api/student/activation-codes/redeem', ['code' => 'PRAC8821'])
            ->assertOk();

        Notification::assertSentTo($this->student, EnrolledInCourse::class);
    }

    public function test_fanout_targets_only_active_enrollees_of_the_course(): void
    {
        Notification::fake();

        $enrolled = User::factory()->create();
        $enrolled->assignRole('student');
        Enrollment::create([
            'user_id' => $enrolled->id, 'course_id' => $this->course->id, 'batch_id' => $this->batch->id,
            'is_active' => true, 'enrolled_at' => now(),
        ]);

        $inactive = User::factory()->create();
        $inactive->assignRole('student');
        Enrollment::create([
            'user_id' => $inactive->id, 'course_id' => $this->course->id, 'batch_id' => $this->batch->id,
            'is_active' => false, 'enrolled_at' => now(),
        ]);

        (new FanOutContentNotification('test', 42, 'Mock #25', $this->course->id, null, null))->handle();

        Notification::assertSentTo($enrolled, NewMockPublished::class);
        Notification::assertNotSentTo($inactive, NewMockPublished::class);
    }

    public function test_via_adds_fcm_channel_only_when_a_device_token_exists(): void
    {
        $notification = new ActivationApproved('SSC CGL 2026', 'Batch A', $this->course->id);

        // No token yet → database only.
        $this->assertSame(['database'], $notification->via($this->student->fresh()));

        DeviceToken::create(['user_id' => $this->student->id, 'token' => 'dev-tok', 'platform' => 'android']);

        $channels = $notification->via($this->student->fresh());
        $this->assertContains('database', $channels);
        $this->assertContains(FcmChannel::class, $channels);
    }

    public function test_fcm_is_enabled_by_raw_json_env_var_or_a_file_path(): void
    {
        $svc = app(\App\Services\Fcm\FcmService::class);

        // Neither set → disabled (channel no-ops, safe to deploy).
        config()->set('services.fcm.credentials_json', null);
        config()->set('services.fcm.credentials', null);
        $this->assertFalse($svc->enabled());

        // Raw JSON pasted into the env var → enabled (the Coolify path).
        config()->set('services.fcm.credentials_json', json_encode([
            'client_email' => 'sa@practest-24732.iam.gserviceaccount.com',
            'private_key' => 'PRIVATE',
            'project_id' => 'practest-24732',
        ]));
        $this->assertTrue($svc->enabled());
    }
}
