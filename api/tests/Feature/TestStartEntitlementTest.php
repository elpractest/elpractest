<?php

namespace Tests\Feature;

use App\Models\Batch;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Question;
use App\Models\QuestionOption;
use App\Models\Test;
use App\Models\TestSection;
use App\Models\TestSectionQuestion;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Entitlement on POST /api/student/tests/{test}/start.
 *
 * The endpoint used to check only the concurrent-session and attempt-cap rules,
 * so any authenticated student could start any test by guessing its id. The
 * enrollment filter existed only in the availableTests() *listing*. These tests
 * pin the action to the same rule the listing applies.
 */
class TestStartEntitlementTest extends TestCase
{
    use RefreshDatabase;

    private User $enrolled;
    private User $outsider;
    private Course $course;
    private Batch $batch;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);

        $this->enrolled = User::factory()->create();
        $this->enrolled->assignRole('student');

        $this->outsider = User::factory()->create();
        $this->outsider->assignRole('student');

        $this->course = Course::create([
            'title' => 'SSC CGL Master Class',
            'description' => 'Course description',
            'exam_category' => 'SSC',
        ]);

        $this->batch = Batch::create([
            'course_id' => $this->course->id,
            'name' => 'Batch A',
        ]);

        Enrollment::create([
            'user_id' => $this->enrolled->id,
            'course_id' => $this->course->id,
            'batch_id' => $this->batch->id,
            'enrolled_at' => now(),
            'is_active' => true,
        ]);
    }

    public function test_an_unenrolled_student_cannot_start_a_scoped_test(): void
    {
        $test = $this->makeTest(['course_id' => $this->course->id]);

        $this->actingAs($this->outsider)
            ->postJson("/api/student/tests/{$test->id}/start")
            ->assertStatus(403);

        $this->assertDatabaseCount('test_sessions', 0);
    }

    public function test_an_enrolled_student_can_start_a_scoped_test(): void
    {
        $test = $this->makeTest(['course_id' => $this->course->id]);

        $this->actingAs($this->enrolled)
            ->postJson("/api/student/tests/{$test->id}/start")
            ->assertStatus(200);

        $this->assertDatabaseCount('test_sessions', 1);
    }

    public function test_a_batch_scoped_test_is_reachable_via_the_batch_enrollment(): void
    {
        $test = $this->makeTest(['batch_id' => $this->batch->id]);

        $this->actingAs($this->enrolled)
            ->postJson("/api/student/tests/{$test->id}/start")
            ->assertStatus(200);

        $this->actingAs($this->outsider)
            ->postJson("/api/student/tests/{$test->id}/start")
            ->assertStatus(403);
    }

    public function test_an_unpublished_test_cannot_be_started_even_by_an_enrolled_student(): void
    {
        $test = $this->makeTest([
            'course_id' => $this->course->id,
            'is_published' => false,
        ]);

        $this->actingAs($this->enrolled)
            ->postJson("/api/student/tests/{$test->id}/start")
            ->assertStatus(403);
    }

    public function test_a_test_outside_its_availability_window_cannot_be_started(): void
    {
        $future = $this->makeTest([
            'course_id' => $this->course->id,
            'available_from' => now()->addDay(),
        ]);

        $expired = $this->makeTest([
            'course_id' => $this->course->id,
            'available_until' => now()->subDay(),
        ]);

        $this->actingAs($this->enrolled)
            ->postJson("/api/student/tests/{$future->id}/start")
            ->assertStatus(403);

        $this->actingAs($this->enrolled)
            ->postJson("/api/student/tests/{$expired->id}/start")
            ->assertStatus(403);
    }

    public function test_an_expired_enrollment_no_longer_grants_access(): void
    {
        Enrollment::where('user_id', $this->enrolled->id)
            ->update(['expires_at' => now()->subDay()]);

        $test = $this->makeTest(['course_id' => $this->course->id]);

        $this->actingAs($this->enrolled)
            ->postJson("/api/student/tests/{$test->id}/start")
            ->assertStatus(403);
    }

    /**
     * A test with neither course nor batch stays platform-wide — this is the
     * documented behaviour of availableTests() and the fix deliberately keeps
     * the action in step with the listing rather than changing the product rule.
     */
    public function test_an_unscoped_test_remains_startable_by_any_student(): void
    {
        $test = $this->makeTest([]);

        $this->actingAs($this->outsider)
            ->postJson("/api/student/tests/{$test->id}/start")
            ->assertStatus(200);
    }

    public function test_a_free_test_is_startable_without_owning_the_course(): void
    {
        $test = $this->makeTest([
            'course_id' => $this->course->id,
            'is_free' => true,
        ]);

        $this->actingAs($this->outsider)
            ->postJson("/api/student/tests/{$test->id}/start")
            ->assertStatus(200);
    }

    public function test_a_free_test_is_listed_to_a_student_with_no_enrollment(): void
    {
        $paid = $this->makeTest(['course_id' => $this->course->id]);
        $free = $this->makeTest(['course_id' => $this->course->id, 'is_free' => true]);

        $ids = collect(
            $this->actingAs($this->outsider)->getJson('/api/student/tests')->json('tests')
        )->pluck('id');

        $this->assertTrue($ids->contains($free->id), 'the free sample should be listed');
        $this->assertFalse($ids->contains($paid->id), 'the paid mock should not be');
    }

    /**
     * Free lifts entitlement, not the publish gate or the schedule -- an
     * unreleased free sample is still unreleased.
     */
    public function test_free_does_not_bypass_publication_or_the_window(): void
    {
        $draft = $this->makeTest(['is_free' => true, 'is_published' => false]);
        $early = $this->makeTest(['is_free' => true, 'available_from' => now()->addDay()]);

        $this->actingAs($this->outsider)
            ->postJson("/api/student/tests/{$draft->id}/start")
            ->assertStatus(403);

        $this->actingAs($this->outsider)
            ->postJson("/api/student/tests/{$early->id}/start")
            ->assertStatus(403);
    }

    /**
     * A candidate already sitting a paper must be able to resume it even after
     * the window closes — otherwise a mock that ends at 11:00 would strand
     * everyone still writing at 10:59.
     */
    public function test_an_in_progress_session_still_resumes_after_the_window_closes(): void
    {
        $test = $this->makeTest(['course_id' => $this->course->id]);

        $this->actingAs($this->enrolled)
            ->postJson("/api/student/tests/{$test->id}/start")
            ->assertStatus(200);

        $test->update(['available_until' => now()->subMinute()]);

        $this->actingAs($this->enrolled)
            ->postJson("/api/student/tests/{$test->id}/start")
            ->assertStatus(200);

        $this->assertDatabaseCount('test_sessions', 1);
    }

    /**
     * A published, in-window, enrolled test with one section and one question.
     */
    private function makeTest(array $overrides): Test
    {
        $admin = User::factory()->create();

        $test = Test::create(array_merge([
            'title' => 'Mock',
            'type' => 'mock',
            'duration_seconds' => 3600,
            'total_marks' => 2,
            'is_published' => true,
            'created_by' => $admin->id,
        ], $overrides));

        $section = TestSection::create([
            'test_id' => $test->id,
            'title' => 'Section 1',
            'sort_order' => 0,
        ]);

        $question = Question::create([
            'subject' => 'Reasoning',
            'topic' => 'Series',
            'difficulty' => 'easy',
            'question_text' => 'Next term?',
            'marks' => 2,
            'negative_marks' => 0.5,
            'is_active' => true,
            'created_by' => $admin->id,
        ]);

        QuestionOption::create([
            'question_id' => $question->id,
            'label' => 'a',
            'option_text' => '10',
            'is_correct' => true,
            'sort_order' => 0,
        ]);

        QuestionOption::create([
            'question_id' => $question->id,
            'label' => 'b',
            'option_text' => '12',
            'is_correct' => false,
            'sort_order' => 1,
        ]);

        TestSectionQuestion::create([
            'test_section_id' => $section->id,
            'question_id' => $question->id,
            'sort_order' => 0,
        ]);

        return $test->fresh();
    }
}
