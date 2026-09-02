<?php

namespace Tests\Feature;

use App\Models\ActivationCode;
use App\Models\Assignment;
use App\Models\Batch;
use App\Models\Course;
use App\Models\CourseModule;
use App\Models\Enrollment;
use App\Models\Lesson;
use App\Models\Question;
use App\Models\QuestionOption;
use App\Models\Test;
use App\Models\TestSection;
use App\Models\TestSectionQuestion;
use App\Models\TestSeries;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The cash-fee rail: an admin generates an activation code, the student redeems
 * it, and everything opens up.
 *
 * This is the path institutes actually use — a student pays cash at the counter
 * and is handed a code — and it predates the product/entitlement rail entirely.
 * The existing ActivationFlowTest proves a code writes an Enrollment row; these
 * tests prove the student can then USE what it granted, which is what the move
 * to EntitlementService could plausibly have broken. Every read below now runs
 * through that service, so a regression here would be silent otherwise.
 */
class ActivationCodeStillGrantsAccessTest extends TestCase
{
    use RefreshDatabase;

    private User $student;
    private User $admin;
    private Course $course;
    private Batch $batch;
    private TestSeries $series;
    private Test $courseTest;
    private Test $seriesTest;
    private Lesson $lesson;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);

        $this->student = User::factory()->create();
        $this->student->assignRole('student');

        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');
        $this->admin->update(['google2fa_enabled' => true, 'google2fa_secret' => 'B39XKJ2938JJD982']);

        $this->course = Course::create([
            'title' => 'SSC CGL Master Class',
            'slug' => 'ssc-cgl-master-class',
            'description' => 'D',
            'exam_category' => 'SSC',
            'mode' => 'online',
            'is_published' => true,
        ]);

        $this->batch = Batch::create([
            'course_id' => $this->course->id,
            'name' => 'Morning Batch',
            'is_active' => true,
        ]);

        $module = CourseModule::create(['course_id' => $this->course->id, 'title' => 'Unit 1', 'sort_order' => 0]);
        $this->lesson = Lesson::create([
            'module_id' => $module->id,
            'title' => 'Percentages',
            'video_provider' => 'youtube',
            'video_id' => 'abc123',
            'duration_seconds' => 600,
            'sort_order' => 0,
        ]);

        $this->series = TestSeries::create([
            'title' => 'Tier I Series',
            'slug' => 'tier-i-series',
            'exam_category' => 'SSC',
            'is_published' => true,
            'created_by' => $this->admin->id,
        ]);

        $this->courseTest = $this->makeTest(['course_id' => $this->course->id]);
        $this->seriesTest = $this->makeTest(['test_series_id' => $this->series->id]);

        // The series reaches students through a batch assignment — the original
        // and, before the product rail, the only way.
        Assignment::create([
            'batch_id' => $this->batch->id,
            'assignable_type' => TestSeries::class,
            'assignable_id' => $this->series->id,
            'assigned_by' => $this->admin->id,
            'is_active' => true,
        ]);
    }

    public function test_before_redeeming_the_student_can_reach_nothing(): void
    {
        $this->actingAs($this->student)->getJson('/api/student/library')
            ->assertStatus(200)->assertJsonPath('total', 0);

        $this->actingAs($this->student)
            ->postJson("/api/student/tests/{$this->courseTest->id}/start")->assertStatus(403);

        $this->actingAs($this->student)
            ->getJson("/api/student/courses/{$this->course->id}/outline")->assertStatus(403);
    }

    public function test_redeeming_a_code_opens_the_course_its_lessons_and_its_tests(): void
    {
        $this->redeem($this->generateCode());

        // Course listing (rewired to EntitlementService).
        $courses = $this->actingAs($this->student)->getJson('/api/student/courses')->assertStatus(200)->json();
        $this->assertSame($this->course->id, collect($courses)->pluck('id')->first());

        // LMS outline + lesson playback.
        $this->actingAs($this->student)
            ->getJson("/api/student/courses/{$this->course->id}/outline")->assertStatus(200);
        $this->actingAs($this->student)
            ->getJson("/api/student/lessons/{$this->lesson->id}")->assertStatus(200);

        // Sitting the course's paper.
        $this->actingAs($this->student)
            ->postJson("/api/student/tests/{$this->courseTest->id}/start")->assertStatus(200);
    }

    public function test_a_series_assigned_to_the_batch_opens_too(): void
    {
        $this->redeem($this->generateCode());

        $list = $this->actingAs($this->student)->getJson('/api/student/test-series')->assertStatus(200);
        $this->assertSame(1, count($list->json('series') ?? $list->json('data') ?? $list->json()));

        $this->actingAs($this->student)
            ->getJson("/api/student/test-series/{$this->series->id}")->assertStatus(200);

        $this->actingAs($this->student)
            ->postJson("/api/student/tests/{$this->seriesTest->id}/start")->assertStatus(200);
    }

    public function test_the_library_shows_a_code_redemption_as_lifetime_access(): void
    {
        $this->redeem($this->generateCode());

        $library = $this->actingAs($this->student)->getJson('/api/student/library')->assertStatus(200);

        $this->assertSame(2, $library->json('total'), 'the course and the assigned series');
        $this->assertSame($this->course->id, $library->json('courses.0.id'));
        // Redemption writes expires_at = null, so the shelf must not invent a date.
        $this->assertNull($library->json('courses.0.expires_at'));
    }

    /**
     * The bug this pins: the library used to read entitlements only, so a
     * student whose access came from a dated enrolment was told "Lifetime
     * access" about something that stops working.
     */
    public function test_a_dated_enrolment_reports_its_real_expiry(): void
    {
        $this->redeem($this->generateCode());

        Enrollment::where('user_id', $this->student->id)
            ->update(['expires_at' => now()->addDays(45)]);

        $library = $this->actingAs($this->student)->getJson('/api/student/library')->assertStatus(200);

        $this->assertNotNull($library->json('courses.0.expires_at'));
        $this->assertEqualsWithDelta(
            45,
            now()->diffInDays($library->json('courses.0.expires_at')),
            1
        );
    }

    public function test_the_practice_console_draws_on_code_granted_content(): void
    {
        $this->redeem($this->generateCode());

        $options = $this->actingAs($this->student)
            ->getJson('/api/student/practice-tests/options')->assertStatus(200);

        // Both papers' questions are reachable, so a cash-fee student gets the
        // practice console too.
        $this->assertGreaterThan(0, $options->json('total_available'));
    }

    public function test_an_expired_enrolment_closes_access_again(): void
    {
        $this->redeem($this->generateCode());

        Enrollment::where('user_id', $this->student->id)
            ->update(['expires_at' => now()->subDay()]);

        $this->actingAs($this->student)
            ->postJson("/api/student/tests/{$this->courseTest->id}/start")->assertStatus(403);

        $this->actingAs($this->student)->getJson('/api/student/library')
            ->assertStatus(200)->assertJsonPath('total', 0);
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private function generateCode(): string
    {
        $response = $this->actingAs($this->admin)->withSession(['2fa_verified' => true])
            ->postJson('/api/admin/activation-codes', [
                'course_id' => $this->course->id,
                'batch_id' => $this->batch->id,
                'max_uses' => 1,
            ])->assertStatus(201);

        return $response->json('activation_code.code')
            ?? $response->json('code.code')
            ?? ActivationCode::latest('id')->firstOrFail()->code;
    }

    private function redeem(string $code): void
    {
        $this->actingAs($this->student)
            ->postJson('/api/student/activation-codes/redeem', ['code' => $code])
            ->assertStatus(200);
    }

    private function makeTest(array $overrides): Test
    {
        $test = Test::create(array_merge([
            'title' => 'Paper',
            'type' => 'mock',
            'duration_seconds' => 3600,
            'total_marks' => 2,
            'is_published' => true,
            'created_by' => $this->admin->id,
        ], $overrides));

        $section = TestSection::create(['test_id' => $test->id, 'title' => 'S1', 'sort_order' => 0]);

        for ($i = 0; $i < 3; $i++) {
            $question = Question::create([
                'subject' => 'Reasoning',
                'topic' => 'Series',
                'difficulty' => 'easy',
                'question_text' => "Q{$i} for test {$test->id}",
                'marks' => 1,
                'negative_marks' => 0.25,
                'is_active' => true,
                'status' => Question::STATUS_APPROVED,
                'created_by' => $this->admin->id,
            ]);

            QuestionOption::create([
                'question_id' => $question->id,
                'label' => 'a',
                'option_text' => 'Right',
                'is_correct' => true,
                'sort_order' => 0,
            ]);

            TestSectionQuestion::create([
                'test_section_id' => $section->id,
                'question_id' => $question->id,
                'sort_order' => $i,
            ]);
        }

        return $test->fresh();
    }
}
