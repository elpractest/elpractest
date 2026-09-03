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
use App\Models\TestSession;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GET /api/student/tests/{test}/preview — what a candidate sees before the
 * clock starts. Pins three things: it uses the SAME entitlement gate as
 * start() (no separate, easier-to-forget rule), it never creates a session
 * just by being called, and it reports the instructions text that has
 * existed on the schema since Test shipped but was never sent to a student
 * anywhere until this endpoint.
 */
class TestPreviewTest extends TestCase
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
            'description' => 'desc',
            'exam_category' => 'SSC',
        ]);

        $this->batch = Batch::create(['course_id' => $this->course->id, 'name' => 'Batch A']);

        Enrollment::create([
            'user_id' => $this->enrolled->id,
            'course_id' => $this->course->id,
            'batch_id' => $this->batch->id,
            'enrolled_at' => now(),
            'is_active' => true,
        ]);
    }

    private function makeQuestion(array $overrides = []): Question
    {
        $admin = User::factory()->create();

        $q = Question::create(array_merge([
            'subject' => 'Reasoning',
            'topic' => 'Series',
            'difficulty' => 'easy',
            'question_text' => 'Next term?',
            'marks' => 2,
            'negative_marks' => 0.5,
            'is_active' => true,
            'created_by' => $admin->id,
            'status' => Question::STATUS_APPROVED,
        ], $overrides));

        QuestionOption::create(['question_id' => $q->id, 'label' => 'a', 'option_text' => '10', 'is_correct' => true, 'sort_order' => 0]);
        QuestionOption::create(['question_id' => $q->id, 'label' => 'b', 'option_text' => '11', 'is_correct' => false, 'sort_order' => 1]);

        return $q;
    }

    public function test_an_unenrolled_student_cannot_preview_a_scoped_test(): void
    {
        $test = Test::create([
            'title' => 'Mock', 'type' => 'mock', 'course_id' => $this->course->id,
            'duration_seconds' => 3600, 'total_marks' => 2, 'is_published' => true,
            'created_by' => $this->enrolled->id, 'instructions' => 'Read carefully.',
        ]);

        $this->actingAs($this->outsider)
            ->getJson("/api/student/tests/{$test->id}/preview")
            ->assertStatus(403);
    }

    public function test_previewing_never_creates_a_session(): void
    {
        $test = Test::create([
            'title' => 'Mock', 'type' => 'mock', 'course_id' => $this->course->id,
            'duration_seconds' => 3600, 'total_marks' => 2, 'is_published' => true,
            'created_by' => $this->enrolled->id,
        ]);

        $this->actingAs($this->enrolled)
            ->getJson("/api/student/tests/{$test->id}/preview")
            ->assertOk();

        $this->assertDatabaseCount('test_sessions', 0);
        $this->assertDatabaseCount('test_answers', 0);
    }

    public function test_reports_the_instructions_text_and_duration(): void
    {
        $test = Test::create([
            'title' => 'SSC CGL Tier 1 Mock 3', 'type' => 'mock', 'course_id' => $this->course->id,
            'duration_seconds' => 3600, 'total_marks' => 4, 'is_published' => true,
            'created_by' => $this->enrolled->id,
            'instructions' => "Each question carries 2 marks.\nWrong answers attract 0.5 negative marking.",
        ]);
        $section = TestSection::create(['test_id' => $test->id, 'title' => 'Section 1', 'sort_order' => 0]);
        $q = $this->makeQuestion();
        TestSectionQuestion::create(['test_section_id' => $section->id, 'question_id' => $q->id, 'sort_order' => 0]);

        $response = $this->actingAs($this->enrolled)
            ->getJson("/api/student/tests/{$test->id}/preview")
            ->assertOk();

        $response->assertJsonPath('test.title', 'SSC CGL Tier 1 Mock 3')
            ->assertJsonPath('test.duration_seconds', 3600)
            ->assertJsonPath('test.question_count', 1)
            ->assertJsonPath('test.instructions', "Each question carries 2 marks.\nWrong answers attract 0.5 negative marking.")
            ->assertJsonPath('test.has_negative_marking', true)
            ->assertJsonPath('test.negative_marking_uniform', true)
            ->assertJsonPath('resumable_session_id', null);
    }

    public function test_flags_negative_marking_as_not_uniform_when_it_varies_by_section(): void
    {
        $test = Test::create([
            'title' => 'Mixed Paper', 'type' => 'mock', 'course_id' => $this->course->id,
            'duration_seconds' => 3600, 'total_marks' => 4, 'is_published' => true,
            'created_by' => $this->enrolled->id,
        ]);
        $section = TestSection::create(['test_id' => $test->id, 'title' => 'Section 1', 'sort_order' => 0]);

        $q1 = $this->makeQuestion(['negative_marks' => 0.5]);
        $q2 = $this->makeQuestion(['negative_marks' => 0]);
        TestSectionQuestion::create(['test_section_id' => $section->id, 'question_id' => $q1->id, 'sort_order' => 0]);
        TestSectionQuestion::create(['test_section_id' => $section->id, 'question_id' => $q2->id, 'sort_order' => 1]);

        $response = $this->actingAs($this->enrolled)
            ->getJson("/api/student/tests/{$test->id}/preview")
            ->assertOk();

        $response->assertJsonPath('test.has_negative_marking', true)
            ->assertJsonPath('test.negative_marking_uniform', false)
            ->assertJsonPath('test.uniform_negative_marks', null);
    }

    public function test_reports_a_resumable_session_when_one_is_already_in_progress(): void
    {
        $test = Test::create([
            'title' => 'Mock', 'type' => 'mock', 'course_id' => $this->course->id,
            'duration_seconds' => 3600, 'total_marks' => 2, 'is_published' => true,
            'created_by' => $this->enrolled->id,
        ]);

        $session = TestSession::create([
            'user_id' => $this->enrolled->id,
            'test_id' => $test->id,
            'started_at' => now(),
            'duration_seconds' => $test->duration_seconds,
            'current_section_index' => 0,
            'section_started_at' => now(),
        ]);

        $response = $this->actingAs($this->enrolled)
            ->getJson("/api/student/tests/{$test->id}/preview")
            ->assertOk();

        $response->assertJsonPath('resumable_session_id', $session->id);
    }

    public function test_reports_section_structure_for_a_sectional_paper(): void
    {
        $test = Test::create([
            'title' => 'Sectional Mock', 'type' => 'mock', 'course_id' => $this->course->id,
            'duration_seconds' => 3600, 'total_marks' => 4, 'is_published' => true,
            'created_by' => $this->enrolled->id,
        ]);
        $s1 = TestSection::create(['test_id' => $test->id, 'title' => 'English', 'sort_order' => 0, 'duration_seconds' => 1200]);
        $s2 = TestSection::create(['test_id' => $test->id, 'title' => 'Quant', 'sort_order' => 1, 'duration_seconds' => 2400, 'is_qualifying' => true, 'cutoff_marks' => 10]);

        $q1 = $this->makeQuestion();
        $q2 = $this->makeQuestion();
        TestSectionQuestion::create(['test_section_id' => $s1->id, 'question_id' => $q1->id, 'sort_order' => 0]);
        TestSectionQuestion::create(['test_section_id' => $s2->id, 'question_id' => $q2->id, 'sort_order' => 0]);

        $response = $this->actingAs($this->enrolled)
            ->getJson("/api/student/tests/{$test->id}/preview")
            ->assertOk();

        $sections = $response->json('test.sections');
        $this->assertCount(2, $sections);
        $this->assertSame('English', $sections[0]['title']);
        $this->assertSame(1, $sections[0]['question_count']);
        $this->assertTrue($sections[1]['is_qualifying']);
        $this->assertEquals(10, $sections[1]['cutoff_marks']);
    }
}
