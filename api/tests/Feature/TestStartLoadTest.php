<?php

namespace Tests\Feature;

use App\Models\Batch;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Question;
use App\Models\QuestionOption;
use App\Models\Test;
use App\Models\TestAnswer;
use App\Models\TestSection;
use App\Models\TestSectionQuestion;
use App\Models\TestSession;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * A scheduled mock is a synchronised spike: every candidate presses Start
 * inside the same couple of minutes. What decides whether that survives is not
 * how fast one request is on an idle box, but whether its cost grows with the
 * size of the paper.
 *
 * It used to: answer rows were created one INSERT at a time, so a 100-question
 * paper cost 112 queries per candidate (~224,000 for a 2,000-candidate mock),
 * and the whole paper was then re-queried to build the response. These tests
 * pin the fix in place — the expensive part is that the numbers must stay FLAT
 * as the paper grows.
 */
class TestStartLoadTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private Course $course;
    private Batch $batch;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);

        $this->admin = User::factory()->create();
        $this->course = Course::create([
            'title' => 'SSC CGL', 'slug' => 'ssc-cgl-load', 'exam_category' => 'SSC',
        ]);
        $this->batch = Batch::create(['course_id' => $this->course->id, 'name' => 'Batch A']);
    }

    /** A published paper with $questionCount questions across one section. */
    private function makePaper(int $questionCount): Test
    {
        $test = Test::create([
            'title' => "Mock {$questionCount}",
            'course_id' => $this->course->id, 'batch_id' => $this->batch->id,
            'type' => 'mock', 'duration_seconds' => 3600, 'total_marks' => $questionCount,
            'is_published' => true, 'created_by' => $this->admin->id,
        ]);

        $section = TestSection::create([
            'test_id' => $test->id, 'title' => 'General', 'sort_order' => 0,
        ]);

        for ($i = 0; $i < $questionCount; $i++) {
            $question = Question::create([
                'subject' => 'Quant', 'topic' => 'T', 'difficulty' => 'medium',
                'question_text' => "Q{$i}?", 'marks' => 1, 'negative_marks' => 0.25,
                'status' => Question::STATUS_APPROVED,
            ]);
            foreach (['a', 'b', 'c', 'd'] as $k => $label) {
                QuestionOption::create([
                    'question_id' => $question->id, 'label' => $label,
                    'option_text' => "opt {$label}", 'is_correct' => $k === 0, 'sort_order' => $k,
                ]);
            }
            TestSectionQuestion::create([
                'test_section_id' => $section->id, 'question_id' => $question->id, 'sort_order' => $i,
            ]);
        }

        return $test;
    }

    private function enrolledStudent(): User
    {
        $student = User::factory()->create();
        $student->assignRole('student');
        Enrollment::create([
            'user_id' => $student->id, 'course_id' => $this->course->id,
            'batch_id' => $this->batch->id, 'enrolled_at' => now(), 'is_active' => true,
        ]);

        return $student;
    }

    /**
     * Query count for one candidate starting $test, counting only the work the
     * start path itself does.
     *
     * Framework bookkeeping against `cache` and `sessions` is excluded on
     * purpose. Those tables are hit by the session driver and the rate limiter
     * (this deployment runs CACHE_STORE=database, so throttling is DB-backed),
     * their number varies with unrelated suite state, and none of it scales
     * with the length of the paper — which is the property under test. Counting
     * them made this pass alone and fail inside the full suite.
     */
    private function queriesToStart(Test $test): int
    {
        $student = $this->enrolledStudent();

        $count = 0;
        DB::listen(function ($query) use (&$count) {
            if (preg_match('/\b(cache|cache_locks|sessions)\b/i', $query->sql)) {
                return;
            }
            $count++;
        });

        $this->actingAs($student)
            ->postJson("/api/student/tests/{$test->id}/start")
            ->assertOk();

        return $count;
    }

    /**
     * THE test for this phase: starting a 20-question paper and a 120-question
     * paper must cost the SAME number of queries. If this fails, per-question
     * work has crept back into the start path and a full-size mock will cost
     * multiples of what a small one does, per candidate, all at once.
     */
    public function test_starting_a_test_costs_the_same_number_of_queries_regardless_of_paper_length(): void
    {
        $small = $this->queriesToStart($this->makePaper(20));
        $large = $this->queriesToStart($this->makePaper(120));

        $this->assertSame(
            $small,
            $large,
            "Start cost must not scale with paper length (20q used {$small} queries, 120q used {$large}). "
            . 'Something is doing per-question work again.'
        );
    }

    /**
     * An absolute ceiling as well as a flat one — "same but both enormous"
     * would still pass the test above.
     */
    public function test_starting_a_full_length_mock_stays_within_a_small_query_budget(): void
    {
        $queries = $this->queriesToStart($this->makePaper(100));

        $this->assertLessThanOrEqual(
            12,
            $queries,
            "A 100-question start took {$queries} domain queries; the budget is 12. It was 112 before batching."
        );
    }

    /** The optimisation must not change what the candidate actually gets. */
    public function test_every_answer_row_is_still_created_exactly_once(): void
    {
        $test = $this->makePaper(75);
        $student = $this->enrolledStudent();

        $this->actingAs($student)
            ->postJson("/api/student/tests/{$test->id}/start")
            ->assertOk();

        $session = TestSession::where('user_id', $student->id)->firstOrFail();
        $answers = TestAnswer::where('test_session_id', $session->id)->get();

        $this->assertCount(75, $answers);
        $this->assertSame(75, $answers->pluck('question_id')->unique()->count(), 'No duplicate answer rows.');

        // Batched inserts bypass the model's automatic timestamps, so they are
        // set by hand — a null created_at would break ordering and auditing.
        $this->assertNotNull($answers->first()->created_at);
        $this->assertNotNull($answers->first()->updated_at);

        // The pre-created rows must be blank and unvisited, or the palette
        // would report answered questions before the candidate touched them.
        $this->assertTrue($answers->every(fn ($a) => $a->selected_option_id === null));
        $this->assertTrue($answers->every(fn ($a) => ! $a->is_visited));
        $this->assertTrue($answers->every(fn ($a) => ! $a->is_marked_for_review));
    }

    /** The response still carries the whole paper after the reload was removed. */
    public function test_the_start_response_still_returns_every_question_and_its_options(): void
    {
        $test = $this->makePaper(30);
        $student = $this->enrolledStudent();

        $response = $this->actingAs($student)
            ->postJson("/api/student/tests/{$test->id}/start")
            ->assertOk();

        $questions = $response->json('sections.0.questions');
        $this->assertCount(30, $questions);
        $this->assertCount(4, $questions[0]['options']);
        // The answer key must never reach the candidate.
        $this->assertArrayNotHasKey('is_correct', $questions[0]['options'][0]);
    }

    public function test_starting_a_test_is_rate_limited_more_tightly_than_the_general_api(): void
    {
        $test = $this->makePaper(5);
        $student = $this->enrolledStudent();
        $this->actingAs($student);

        // The first call starts the session; the rest resume it. Either way they
        // all consume the limiter, which is the point — a stuck client retrying
        // must be stopped before it hammers the heaviest write path.
        for ($i = 0; $i < 10; $i++) {
            $this->postJson("/api/student/tests/{$test->id}/start")->assertOk();
        }

        $this->postJson("/api/student/tests/{$test->id}/start")->assertStatus(429);
    }
}
