<?php

namespace Tests\Feature;

use App\Models\Enrollment;
use App\Models\Question;
use App\Models\QuestionOption;
use App\Models\Test;
use App\Models\TestSection;
use App\Models\TestSectionQuestion;
use App\Models\TestSession;
use App\Models\TestAnswer;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class TestTakingFlowTest extends TestCase
{
    use RefreshDatabase;

    private User $student;
    private Test $test;
    private TestSection $section1;
    private TestSection $section2;
    private Question $q1;
    private Question $q2;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);

        $this->student = User::factory()->create();
        $this->student->assignRole('student');

        // Create Course and Batch
        $course = \App\Models\Course::create([
            'title' => 'SSC CGL Master Class',
            'description' => 'Course description',
            'exam_category' => 'SSC',
        ]);

        $batch = \App\Models\Batch::create([
            'course_id' => $course->id,
            'name' => 'Batch A',
        ]);

        // Enroll Student
        Enrollment::create([
            'user_id' => $this->student->id,
            'course_id' => $course->id,
            'batch_id' => $batch->id,
            'enrolled_at' => now(),
            'is_active' => true,
        ]);

        // Create Sectional Test
        $this->test = Test::create([
            'title' => 'SBI PO Mock',
            'course_id' => $course->id,
            'batch_id' => $batch->id,
            'type' => 'mock',
            'duration_seconds' => 120, // 2 minutes total
            'total_marks' => 3.00,
            'is_published' => true,
            'max_attempts' => 1,
            'created_by' => $this->student->id,
        ]);

        $this->section1 = TestSection::create([
            'test_id' => $this->test->id,
            'title' => 'English Language',
            'sort_order' => 0,
            'duration_seconds' => 60, // 1 min section limit
        ]);

        $this->section2 = TestSection::create([
            'test_id' => $this->test->id,
            'title' => 'Quantitative Aptitude',
            'sort_order' => 1,
            'duration_seconds' => 60, // 1 min section limit
        ]);

        // Create Questions
        $this->q1 = Question::create([
            'subject' => 'English',
            'topic' => 'Grammar',
            'difficulty' => 'easy',
            'question_text' => 'Fill in the blank.',
            'marks' => 1.00,
        ]);

        QuestionOption::create([
            'question_id' => $this->q1->id,
            'label' => 'a',
            'option_text' => 'Option text',
            'is_correct' => true,
        ]);

        TestSectionQuestion::create([
            'test_section_id' => $this->section1->id,
            'question_id' => $this->q1->id,
            'sort_order' => 0,
        ]);

        $this->q2 = Question::create([
            'subject' => 'Math',
            'topic' => 'Algebra',
            'difficulty' => 'medium',
            'question_text' => 'Solve for x.',
            'marks' => 2.00,
        ]);

        QuestionOption::create([
            'question_id' => $this->q2->id,
            'label' => 'a',
            'option_text' => 'Option text',
            'is_correct' => true,
        ]);

        TestSectionQuestion::create([
            'test_section_id' => $this->section2->id,
            'question_id' => $this->q2->id,
            'sort_order' => 0,
        ]);
    }

    public function test_starting_test_precreates_answers_and_excludes_is_correct_flags(): void
    {
        $response = $this->actingAs($this->student)
            ->postJson("/api/student/tests/{$this->test->id}/start");

        $response->assertStatus(200)
            ->assertJsonPath('session.current_section_index', 0);

        // Verify pre-created answers exist
        $session = TestSession::latest()->first();
        $this->assertEquals(2, $session->answers()->count());

        // Verify is_correct is NOT returned in start response for cheating prevention
        $response->assertJsonMissing(['is_correct' => true]);
        $response->assertJsonMissing(['is_correct' => false]);
    }

    public function test_concurrent_sessions_return_existing_session_resume_behavior(): void
    {
        // Start first session
        $this->actingAs($this->student)
            ->postJson("/api/student/tests/{$this->test->id}/start");

        $session1 = TestSession::latest()->first();

        // Start second session for same test should return session1 details
        $response = $this->actingAs($this->student)
            ->postJson("/api/student/tests/{$this->test->id}/start");

        $response->assertStatus(200)
            ->assertJsonPath('session.id', $session1->id);

        $this->assertEquals(1, TestSession::count());
    }

    public function test_student_cannot_exceed_max_attempts(): void
    {
        // Complete one attempt
        $session = TestSession::create([
            'user_id' => $this->student->id,
            'test_id' => $this->test->id,
            'started_at' => now(),
            'duration_seconds' => 120,
            'submitted_at' => now(),
        ]);

        // Attempting to start again should fail since max_attempts = 1
        $response = $this->actingAs($this->student)
            ->postJson("/api/student/tests/{$this->test->id}/start");

        $response->assertStatus(403);
    }

    public function test_sectional_locking_prevents_answering_questions_from_other_sections(): void
    {
        $response = $this->actingAs($this->student)
            ->postJson("/api/student/tests/{$this->test->id}/start");

        $session = TestSession::latest()->first();

        $option = $this->q2->options()->first();

        // Try to answer q2 (which is in section 2) while current_section_index is 0
        $saveResponse = $this->actingAs($this->student)
            ->putJson("/api/student/tests/sessions/{$session->id}/answers/{$this->q2->id}", [
                'selected_option_id' => $option->id,
            ]);

        $saveResponse->assertStatus(403)
            ->assertJsonPath('message', 'You cannot save answers for a different section in sectional timing mode.');
    }

    public function test_expiry_enforcement_on_write_rejects_answers(): void
    {
        $response = $this->actingAs($this->student)
            ->postJson("/api/student/tests/{$this->test->id}/start");

        $session = TestSession::latest()->first();
        $option = $this->q1->options()->first();

        // Travel 65 seconds into the future (section 1 duration is 60s)
        Carbon::setTestNow(now()->addSeconds(65));

        $saveResponse = $this->actingAs($this->student)
            ->putJson("/api/student/tests/sessions/{$session->id}/answers/{$this->q1->id}", [
                'selected_option_id' => $option->id,
            ]);

        // Since section 1 duration expired, the reconcile method auto-advanced it.
        // Therefore, trying to write to Q1 (section 1) is now blocked.
        $saveResponse->assertStatus(403);

        Carbon::setTestNow(); // reset
    }

    public function test_exact_time_boundary_rejects_writes(): void
    {
        $response = $this->actingAs($this->student)
            ->postJson("/api/student/tests/{$this->test->id}/start");

        $session = TestSession::latest()->first();
        $option = $this->q1->options()->first();

        // Travel exactly to expiry (60 seconds)
        Carbon::setTestNow($session->started_at->copy()->addSeconds(60));

        $saveResponse = $this->actingAs($this->student)
            ->putJson("/api/student/tests/sessions/{$session->id}/answers/{$this->q1->id}", [
                'selected_option_id' => $option->id,
            ]);

        $saveResponse->assertStatus(403);

        Carbon::setTestNow();
    }

    public function test_self_healing_advances_multiple_elapsed_sections_correctly(): void
    {
        $response = $this->actingAs($this->student)
            ->postJson("/api/student/tests/{$this->test->id}/start");

        $session = TestSession::latest()->first();

        // English (60s) + Quant (60s) = 120s total.
        // Travel 130 seconds into future.
        Carbon::setTestNow(now()->addSeconds(130));

        // Call palette or any session-touching route.
        $paletteResponse = $this->actingAs($this->student)
            ->getJson("/api/student/tests/sessions/{$session->id}/palette");

        $session->refresh();

        // The session should be auto-submitted because global time and all sections expired
        $this->assertNotNull($session->submitted_at);
        $this->assertTrue($session->is_auto_submitted);

        Carbon::setTestNow();
    }

    public function test_palette_status_all_five_states(): void
    {
        $this->actingAs($this->student)
            ->postJson("/api/student/tests/{$this->test->id}/start");

        $session = TestSession::latest()->first();

        // Let's create 5 questions in a non-sectional test so we can manipulate answers easily
        $nonSectionTest = Test::create([
            'title' => 'Palette Test',
            'type' => 'practice',
            'total_marks' => 5.00,
            'is_published' => true,
            'created_by' => $this->student->id,
        ]);
        $section = TestSection::create([
            'test_id' => $nonSectionTest->id,
            'title' => 'Main',
            'sort_order' => 0,
        ]);

        $qs = [];
        for ($i = 0; $i < 5; $i++) {
            $q = Question::create(['subject' => 'Math', 'topic' => 'Topic', 'difficulty' => 'easy', 'question_text' => "Q{$i}", 'marks' => 1.00]);
            QuestionOption::create(['question_id' => $q->id, 'label' => 'a', 'option_text' => 'Option text', 'is_correct' => true]);
            TestSectionQuestion::create(['test_section_id' => $section->id, 'question_id' => $q->id, 'sort_order' => $i]);
            $qs[] = $q;
        }

        $session = TestSession::create([
            'user_id' => $this->student->id,
            'test_id' => $nonSectionTest->id,
            'started_at' => now(),
            'duration_seconds' => 120,
        ]);

        // State 1: not_visited (default initialized)
        TestAnswer::create([
            'test_session_id' => $session->id,
            'question_id' => $qs[0]->id,
            'is_visited' => false,
            'is_marked_for_review' => false,
        ]);

        // State 2: not_answered (visited but no option)
        TestAnswer::create([
            'test_session_id' => $session->id,
            'question_id' => $qs[1]->id,
            'is_visited' => true,
            'is_marked_for_review' => false,
            'selected_option_id' => null,
        ]);

        // State 3: answered (visited and option selected)
        TestAnswer::create([
            'test_session_id' => $session->id,
            'question_id' => $qs[2]->id,
            'is_visited' => true,
            'is_marked_for_review' => false,
            'selected_option_id' => $qs[2]->options()->first()->id,
        ]);

        // State 4: marked_for_review (visited, marked, no option)
        TestAnswer::create([
            'test_session_id' => $session->id,
            'question_id' => $qs[3]->id,
            'is_visited' => true,
            'is_marked_for_review' => true,
            'selected_option_id' => null,
        ]);

        // State 5: answered_and_marked (visited, marked, and option selected)
        TestAnswer::create([
            'test_session_id' => $session->id,
            'question_id' => $qs[4]->id,
            'is_visited' => true,
            'is_marked_for_review' => true,
            'selected_option_id' => $qs[4]->options()->first()->id,
        ]);

        $response = $this->actingAs($this->student)
            ->getJson("/api/student/tests/sessions/{$session->id}/palette");

        $response->assertStatus(200);
        $palette = collect($response->json('palette'));

        $this->assertEquals('not_visited', $palette->where('question_id', $qs[0]->id)->first()['status']);
        $this->assertEquals('not_answered', $palette->where('question_id', $qs[1]->id)->first()['status']);
        $this->assertEquals('answered', $palette->where('question_id', $qs[2]->id)->first()['status']);
        $this->assertEquals('marked_for_review', $palette->where('question_id', $qs[3]->id)->first()['status']);
        $this->assertEquals('answered_and_marked', $palette->where('question_id', $qs[4]->id)->first()['status']);
    }

    public function test_submit_dispatches_analytics_job(): void
    {
        \Illuminate\Support\Facades\Queue::fake();

        $session = TestSession::create([
            'user_id' => $this->student->id,
            'test_id' => $this->test->id,
            'started_at' => now(),
            'duration_seconds' => 120,
        ]);

        $response = $this->actingAs($this->student)
            ->postJson("/api/student/tests/sessions/{$session->id}/submit");

        $response->assertStatus(200);

        \Illuminate\Support\Facades\Queue::assertPushed(\App\Jobs\ComputeTestAnalytics::class);
    }

    public function test_cannot_save_after_manual_submit(): void
    {
        $session = TestSession::create([
            'user_id' => $this->student->id,
            'test_id' => $this->test->id,
            'started_at' => now(),
            'duration_seconds' => 120,
            'submitted_at' => now(),
        ]);

        TestAnswer::create([
            'test_session_id' => $session->id,
            'question_id' => $this->q1->id,
            'is_visited' => false,
        ]);

        $option = $this->q1->options()->first();

        $response = $this->actingAs($this->student)
            ->putJson("/api/student/tests/sessions/{$session->id}/answers/{$this->q1->id}", [
                'selected_option_id' => $option->id,
            ]);

        $response->assertStatus(409);
    }

    public function test_non_sectional_test_answers_freely(): void
    {
        // Test with sections but no sectional timing (duration_seconds is null)
        $nonSectionalTest = Test::create([
            'title' => 'SSC CGL Practice',
            'type' => 'practice',
            'total_marks' => 3.00,
            'is_published' => true,
            'created_by' => $this->student->id,
        ]);

        $s1 = TestSection::create(['test_id' => $nonSectionalTest->id, 'title' => 'Sec 1', 'sort_order' => 0, 'duration_seconds' => null]);
        $s2 = TestSection::create(['test_id' => $nonSectionalTest->id, 'title' => 'Sec 2', 'sort_order' => 1, 'duration_seconds' => null]);

        TestSectionQuestion::create(['test_section_id' => $s1->id, 'question_id' => $this->q1->id, 'sort_order' => 0]);
        TestSectionQuestion::create(['test_section_id' => $s2->id, 'question_id' => $this->q2->id, 'sort_order' => 0]);

        $session = TestSession::create([
            'user_id' => $this->student->id,
            'test_id' => $nonSectionalTest->id,
            'started_at' => now(),
            'duration_seconds' => 120,
            'current_section_index' => 0,
        ]);

        TestAnswer::create(['test_session_id' => $session->id, 'question_id' => $this->q1->id, 'is_visited' => false]);
        TestAnswer::create(['test_session_id' => $session->id, 'question_id' => $this->q2->id, 'is_visited' => false]);

        $option = $this->q2->options()->first();

        // Answer Q2 (section 2) while current_section_index is 0. Should be accepted because there's no sectional timing.
        $response = $this->actingAs($this->student)
            ->putJson("/api/student/tests/sessions/{$session->id}/answers/{$this->q2->id}", [
                'selected_option_id' => $option->id,
            ]);

        $response->assertStatus(200);
    }

    public function test_auto_submit_command_closes_expired_sessions(): void
    {
        $session = TestSession::create([
            'user_id' => $this->student->id,
            'test_id' => $this->test->id,
            'started_at' => now()->subMinutes(10), // expired long ago
            'duration_seconds' => 120,
        ]);

        $this->artisan('test:auto-submit')
            ->assertExitCode(0);

        $session->refresh();
        $this->assertNotNull($session->submitted_at);
        $this->assertTrue($session->is_auto_submitted);
    }
}
