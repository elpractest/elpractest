<?php

namespace Tests\Feature;

use App\Jobs\FanOutTestReminder;
use App\Models\Batch;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Test;
use App\Models\User;
use App\Notifications\ActivationApproved;
use App\Notifications\Channels\WhatsAppChannel;
use App\Notifications\NewMockPublished;
use App\Notifications\ResultReady;
use App\Notifications\TestStartingSoon;
use App\Services\WhatsApp\WhatsAppService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

/**
 * Phase 4 — WhatsApp as the channel that actually gets read in India, beside
 * the in-app feed and (inert-until-configured) FCM push.
 */
class WhatsAppNotificationTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);

        config([
            'services.msg91.auth_key' => 'test-key',
            'services.msg91.whatsapp.integrated_number' => '919000000000',
            'services.msg91.whatsapp.templates.activation_approved' => 'tpl_activation',
            'services.msg91.whatsapp.templates.result_ready' => 'tpl_result',
            'services.msg91.whatsapp.templates.test_reminder' => 'tpl_reminder',
        ]);
    }

    private function studentWithVerifiedPhone(string $phone = '9812345678'): User
    {
        $user = User::factory()->create([
            'phone' => $phone,
            'phone_verified_at' => now(),
        ]);
        $user->assignRole('student');

        return $user;
    }

    // ── Channel selection ────────────────────────────────────────────────

    public function test_a_verified_student_gets_whatsapp_for_an_opted_in_notification(): void
    {
        $user = $this->studentWithVerifiedPhone();
        $channels = (new ResultReady(1, 'SSC Mock 1', 45, 100))->via($user);

        $this->assertContains(WhatsAppChannel::class, $channels);
        $this->assertContains('database', $channels, 'The in-app feed must still get it.');
    }

    /**
     * WhatsApp is opt-in per notification, not automatic: every template needs
     * Meta approval, each send costs money, and a student WhatsApped about
     * everything blocks the number — after which the messages that DO matter
     * never arrive either.
     */
    public function test_a_notification_that_does_not_opt_in_never_reaches_whatsapp(): void
    {
        $user = $this->studentWithVerifiedPhone();
        $channels = (new NewMockPublished(1, 'Some mock', null))->via($user);

        $this->assertNotContains(WhatsAppChannel::class, $channels);
        $this->assertContains('database', $channels);
    }

    /** An unverified number may belong to a stranger — never message it. */
    public function test_an_unverified_phone_is_never_messaged(): void
    {
        $user = User::factory()->create(['phone' => '9812345678', 'phone_verified_at' => null]);
        $user->assignRole('student');

        $this->assertNull($user->routeNotificationForWhatsApp());
        $this->assertNotContains(
            WhatsAppChannel::class,
            (new ResultReady(1, 'SSC Mock 1', 45, 100))->via($user)
        );
    }

    public function test_a_student_with_no_phone_at_all_is_skipped(): void
    {
        $user = User::factory()->create(['phone' => null, 'phone_verified_at' => now()]);
        $user->assignRole('student');

        $this->assertNull($user->routeNotificationForWhatsApp());
    }

    // ── Message shape ────────────────────────────────────────────────────

    public function test_each_opted_in_notification_names_its_template_and_variables(): void
    {
        $user = $this->studentWithVerifiedPhone();

        $result = (new ResultReady(7, 'SSC CGL Mock 3', 45.5, 100))->toWhatsApp($user);
        $this->assertSame('tpl_result', $result['template']);
        $this->assertSame(['SSC CGL Mock 3', '45.5', '100'], $result['variables']);

        $activation = (new ActivationApproved('SSC CGL 2026', 'Batch A', 3))->toWhatsApp($user);
        $this->assertSame('tpl_activation', $activation['template']);
        $this->assertSame(['SSC CGL 2026'], $activation['variables']);

        $reminder = (new TestStartingSoon(2, 'Full Mock 5', 60))->toWhatsApp($user);
        $this->assertSame('tpl_reminder', $reminder['template']);
        $this->assertSame(['Full Mock 5', '60'], $reminder['variables']);
    }

    // ── The service itself ───────────────────────────────────────────────

    public function test_it_sends_an_approved_template_with_positional_body_variables(): void
    {
        Http::fake(['*' => Http::response(['type' => 'success'], 200)]);

        $sent = app(WhatsAppService::class)->sendTemplate('9812345678', 'tpl_result', ['Mock 1', '45', '100']);

        $this->assertTrue($sent);
        Http::assertSent(function ($request) {
            $body = $request->data();
            $template = $body['payload']['template'];
            $components = $template['to_and_components'][0]['components'];

            return str_contains($request->url(), 'whatsapp-outbound-message')
                && $template['name'] === 'tpl_result'
                // A bare 10-digit Indian mobile must get its country code.
                && $template['to_and_components'][0]['to'] === ['919812345678']
                && $components['body_1']['value'] === 'Mock 1'
                && $components['body_2']['value'] === '45'
                && $components['body_3']['value'] === '100';
        });
    }

    /** Deploys safely long before Meta approves anything. */
    public function test_it_is_inert_and_makes_no_call_when_unconfigured(): void
    {
        config(['services.msg91.whatsapp.integrated_number' => null]);
        Http::fake();

        $this->assertFalse(app(WhatsAppService::class)->isConfigured());
        $this->assertFalse(app(WhatsAppService::class)->sendTemplate('9812345678', 'tpl_result', []));

        Http::assertNothingSent();
    }

    /** A template still awaiting approval is skipped, not sent blank. */
    public function test_a_blank_template_name_sends_nothing(): void
    {
        Http::fake();

        $this->assertFalse(app(WhatsAppService::class)->sendTemplate('9812345678', '', ['x']));

        Http::assertNothingSent();
    }

    public function test_an_implausible_number_is_dropped_rather_than_messaged(): void
    {
        Http::fake();

        $this->assertFalse(app(WhatsAppService::class)->sendTemplate('123', 'tpl_result', []));

        Http::assertNothingSent();
    }

    /** A messaging failure must never take down the job that triggered it. */
    public function test_a_gateway_failure_is_swallowed_and_reported_as_false(): void
    {
        Http::fake(['*' => Http::response('gateway exploded', 500)]);

        $this->assertFalse(app(WhatsAppService::class)->sendTemplate('9812345678', 'tpl_result', []));
    }

    // ── The scheduled reminder ───────────────────────────────────────────

    private function scheduledTest(?\DateTimeInterface $opensAt): Test
    {
        $course = Course::create([
            'title' => 'SSC CGL', 'slug' => 'ssc-' . uniqid(), 'exam_category' => 'SSC',
        ]);
        $batch = Batch::create(['course_id' => $course->id, 'name' => 'Batch A']);

        $student = $this->studentWithVerifiedPhone();
        Enrollment::create([
            'user_id' => $student->id, 'course_id' => $course->id, 'batch_id' => $batch->id,
            'enrolled_at' => now(), 'is_active' => true,
        ]);

        return Test::create([
            'title' => 'Full Mock 5', 'course_id' => $course->id, 'batch_id' => $batch->id,
            'type' => 'mock', 'duration_seconds' => 3600, 'total_marks' => 100,
            'is_published' => true, 'available_from' => $opensAt,
            'created_by' => User::factory()->create()->id,
        ]);
    }

    public function test_it_reminds_about_a_mock_opening_within_the_window(): void
    {
        Bus::fake();
        $test = $this->scheduledTest(now()->addMinutes(55));

        $this->artisan('tests:remind-upcoming')->assertSuccessful();

        Bus::assertDispatched(FanOutTestReminder::class);
        $this->assertNotNull($test->fresh()->reminder_sent_at);
    }

    public function test_it_ignores_a_mock_that_is_still_days_away(): void
    {
        Bus::fake();
        $test = $this->scheduledTest(now()->addDays(3));

        $this->artisan('tests:remind-upcoming')->assertSuccessful();

        Bus::assertNotDispatched(FanOutTestReminder::class);
        $this->assertNull($test->fresh()->reminder_sent_at);
    }

    /**
     * The scheduler runs this every five minutes, so without the claim the same
     * cohort would be WhatsApped repeatedly for the whole reminder window.
     */
    public function test_a_cohort_is_never_reminded_twice(): void
    {
        Bus::fake();
        $this->scheduledTest(now()->addMinutes(55));

        $this->artisan('tests:remind-upcoming')->assertSuccessful();
        $this->artisan('tests:remind-upcoming')->assertSuccessful();
        $this->artisan('tests:remind-upcoming')->assertSuccessful();

        Bus::assertDispatchedTimes(FanOutTestReminder::class, 1);
    }

    public function test_an_unpublished_mock_is_never_announced(): void
    {
        Bus::fake();
        $test = $this->scheduledTest(now()->addMinutes(55));
        $test->update(['is_published' => false]);

        $this->artisan('tests:remind-upcoming')->assertSuccessful();

        Bus::assertNotDispatched(FanOutTestReminder::class);
    }

    public function test_the_fan_out_notifies_every_active_enrollee(): void
    {
        Notification::fake();
        $test = $this->scheduledTest(now()->addMinutes(55));

        (new FanOutTestReminder($test->id, $test->title, $test->course_id, $test->batch_id, 55))->handle();

        Notification::assertSentTimes(TestStartingSoon::class, 1);
    }
}
