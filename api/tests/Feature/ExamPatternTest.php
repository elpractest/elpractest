<?php

namespace Tests\Feature;

use App\Jobs\ComputeTestAnalytics;
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
 * Indian govt-exam pattern fidelity: answer integrity, sectional cut-offs,
 * qualifying papers, merit ranking and per-candidate paper shuffling.
 */
class ExamPatternTest extends TestCase
{
    use RefreshDatabase;

    private User $student;
    private User $admin;
    private Course $course;
    private Batch $batch;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);

        $this->student = User::factory()->create();
        $this->student->assignRole('student');

        $this->admin = User::factory()->create([
            'google2fa_enabled' => true,
            'google2fa_secret' => 'LUTWUXK6K5F5GDZ6',
        ]);
        $this->admin->assignRole('admin');

        $this->course = Course::create([
            'title' => 'SSC CGL', 'slug' => 'ssc-cgl', 'exam_category' => 'SSC',
        ]);
        $this->batch = Batch::create(['course_id' => $this->course->id, 'name' => 'Batch A']);

        Enrollment::create([
            'user_id' => $this->student->id,
            'course_id' => $this->course->id,
            'batch_id' => $this->batch->id,
            'enrolled_at' => now(),
            'is_active' => true,
        ]);
    }

    private function actingAsAdmin(): self
    {
        $this->actingAs($this->admin);
        session(['2fa_verified' => true]);
        return $this;
    }

    /** A 1-mark question with 0.25 negative marking and one correct option. */
    private function makeQuestion(string $subject = 'Quant', float $marks = 1.0, float $neg = 0.25): Question
    {
        $q = Question::create([
            'subject' => $subject, 'topic' => 'T', 'difficulty' => 'medium',
            'question_text' => 'Q?', 'marks' => $marks, 'negative_marks' => $neg,
            'status' => Question::STATUS_APPROVED,
        ]);
        QuestionOption::create(['question_id' => $q->id, 'label' => 'a', 'option_text' => 'right', 'is_correct' => true, 'sort_order' => 0]);
        QuestionOption::create(['question_id' => $q->id, 'label' => 'b', 'option_text' => 'wrong', 'is_correct' => false, 'sort_order' => 1]);
        return $q;
    }

    private function makeTest(array $attrs = []): Test
    {
        return Test::create(array_merge([
            'title' => 'Mock', 'course_id' => $this->course->id, 'batch_id' => $this->batch->id,
            'type' => 'mock', 'duration_seconds' => 3600, 'total_marks' => 0,
            'is_published' => true, 'created_by' => $this->admin->id,
        ], $attrs));
    }

    private function addSection(Test $test, string $title, array $questions, array $attrs = []): TestSection
    {
        $section = TestSection::create(array_merge([
            'test_id' => $test->id, 'title' => $title,
            'sort_order' => $test->sections()->count(),
        ], $attrs));

        foreach ($questions as $i => $q) {
            TestSectionQuestion::create([
                'test_section_id' => $section->id, 'question_id' => $q->id, 'sort_order' => $i,
            ]);
        }
        return $section;
    }

    // ── Answer integrity ────────────────────────────────────────────────────

    /**
     * REGRESSION: option ids are globally unique, so an unscoped
     * `selected_option_id` let a candidate answer question A with question B's
     * correct option and score for it. This was reproducible end to end.
     */
    public function test_option_id_from_another_question_is_rejected(): void
    {
        $q1 = $this->makeQuestion();
        $q2 = $this->makeQuestion();
        $test = $this->makeTest();
        $this->addSection($test, 'S1', [$q1, $q2]);

        $foreignCorrect = QuestionOption::where('question_id', $q2->id)->where('is_correct', true)->first();

        $this->actingAs($this->student);
        $this->postJson("/api/student/tests/{$test->id}/start")->assertOk();
        $session = TestSession::where('user_id', $this->student->id)->firstOrFail();

        $this->putJson(
            "/api/student/tests/sessions/{$session->id}/answers/{$q1->id}",
            ['selected_option_id' => $foreignCorrect->id]
        )->assertStatus(422)->assertJsonValidationErrors('selected_option_id');

        $this->postJson("/api/student/tests/sessions/{$session->id}/submit")->assertOk();
        (new ComputeTestAnalytics($session->fresh()))->handle();

        $this->assertSame(0, $session->fresh()->analytic->correct_count);
        $this->assertEquals(0.0, (float) $session->fresh()->analytic->total_score);
    }

    /** Second lock: even a directly-written foreign option id does not score. */
    public function test_scoring_ignores_a_foreign_option_written_directly(): void
    {
        $q1 = $this->makeQuestion();
        $q2 = $this->makeQuestion();
        $test = $this->makeTest();
        $this->addSection($test, 'S1', [$q1, $q2]);

        $this->actingAs($this->student);
        $this->postJson("/api/student/tests/{$test->id}/start")->assertOk();
        $session = TestSession::where('user_id', $this->student->id)->firstOrFail();

        // Bypass the endpoint entirely and plant the foreign id in storage.
        $foreign = QuestionOption::where('question_id', $q2->id)->where('is_correct', true)->first();
        \App\Models\TestAnswer::where('test_session_id', $session->id)
            ->where('question_id', $q1->id)
            ->update(['selected_option_id' => $foreign->id]);

        (new ComputeTestAnalytics($session))->handle();

        $analytic = $session->fresh()->analytic;
        $this->assertSame(0, $analytic->correct_count, 'A foreign option must never score as correct');
        $this->assertSame(1, $analytic->incorrect_count);
        $this->assertEquals(-0.25, (float) $analytic->total_score, 'and it must attract the negative mark');
    }

    // ── Authoring validation ────────────────────────────────────────────────

    public function test_question_with_no_correct_option_is_rejected(): void
    {
        $this->actingAsAdmin()->postJson('/api/admin/questions', $this->questionPayload([false, false, false, false]))
            ->assertStatus(422)->assertJsonValidationErrors('options');
    }

    public function test_question_with_two_correct_options_is_rejected(): void
    {
        $this->actingAsAdmin()->postJson('/api/admin/questions', $this->questionPayload([true, true, false, false]))
            ->assertStatus(422)->assertJsonValidationErrors('options');
    }

    public function test_question_with_exactly_one_correct_option_is_accepted(): void
    {
        $this->actingAsAdmin()->postJson('/api/admin/questions', $this->questionPayload([true, false, false, false]))
            ->assertStatus(201);
    }

    private function questionPayload(array $correctFlags): array
    {
        $labels = ['a', 'b', 'c', 'd'];
        return [
            'subject' => 'Quant', 'topic' => 'Algebra', 'difficulty' => 'easy',
            'question_text' => 'Solve x', 'marks' => 1, 'negative_marks' => 0.25,
            'options' => array_map(fn ($i) => [
                'label' => $labels[$i], 'option_text' => "opt {$labels[$i]}", 'is_correct' => $correctFlags[$i],
            ], array_keys($labels)),
        ];
    }

    // ── Review gate ─────────────────────────────────────────────────────────

    public function test_test_cannot_be_published_with_unapproved_questions(): void
    {
        $approved = $this->makeQuestion();
        $draft = $this->makeQuestion();
        $draft->update(['status' => Question::STATUS_DRAFT]);

        $test = $this->makeTest(['is_published' => false]);
        $this->addSection($test, 'S1', [$approved, $draft]);

        $this->actingAsAdmin()
            ->postJson("/api/admin/tests/{$test->id}/publish")
            ->assertStatus(422)
            ->assertJsonPath('unapproved_questions.0.question_id', $draft->id);

        $this->assertFalse($test->fresh()->is_published);
    }

    public function test_test_publishes_once_every_question_is_approved(): void
    {
        $q = $this->makeQuestion();
        $q->update(['status' => Question::STATUS_PENDING]);

        $test = $this->makeTest(['is_published' => false]);
        $this->addSection($test, 'S1', [$q]);

        $this->actingAsAdmin()
            ->postJson("/api/admin/questions/{$q->id}/review", ['status' => 'approved'])
            ->assertOk();

        $this->actingAsAdmin()->postJson("/api/admin/tests/{$test->id}/publish")->assertOk();
        $this->assertTrue($test->fresh()->is_published);
    }

    // ── Sectional cut-offs, qualifying papers, merit score ──────────────────

    /**
     * Two sections, each 2 marks, each needing 2 to clear. The candidate aces
     * section 1 and fails section 2, so the paper is NOT cleared even though the
     * total would comfortably pass an overall-only bar.
     */
    public function test_failing_one_sectional_cutoff_fails_the_whole_paper(): void
    {
        $s1q = [$this->makeQuestion('English'), $this->makeQuestion('English')];
        $s2q = [$this->makeQuestion('Quant'), $this->makeQuestion('Quant')];

        $test = $this->makeTest(['total_marks' => 4]);
        $this->addSection($test, 'English', $s1q, ['cutoff_marks' => 2]);
        $this->addSection($test, 'Quant', $s2q, ['cutoff_marks' => 2]);

        $session = $this->sitTest($test, [
            $s1q[0]->id => 'correct', $s1q[1]->id => 'correct',
            $s2q[0]->id => 'wrong', $s2q[1]->id => 'skip',
        ]);

        $a = $session->fresh()->analytic;
        $this->assertEquals(1.75, (float) $a->total_score, '2 correct, one wrong at -0.25');
        $this->assertFalse($a->is_qualified, 'Quant section was not cleared');

        $sections = collect($a->section_breakdown);
        $this->assertTrue($sections->firstWhere('title', 'English')['cleared']);
        $this->assertFalse($sections->firstWhere('title', 'Quant')['cleared']);
    }

    /** A qualifying section must be cleared but its marks stay out of merit. */
    public function test_qualifying_section_is_excluded_from_merit_score(): void
    {
        $meritQ = [$this->makeQuestion('GS'), $this->makeQuestion('GS')];
        $qualQ = [$this->makeQuestion('CSAT'), $this->makeQuestion('CSAT')];

        $test = $this->makeTest(['total_marks' => 4]);
        $this->addSection($test, 'General Studies', $meritQ);
        $this->addSection($test, 'CSAT', $qualQ, ['cutoff_marks' => 1, 'is_qualifying' => true]);

        $session = $this->sitTest($test, [
            $meritQ[0]->id => 'correct', $meritQ[1]->id => 'skip',
            $qualQ[0]->id => 'correct', $qualQ[1]->id => 'correct',
        ]);

        $a = $session->fresh()->analytic;
        $this->assertEquals(3.0, (float) $a->total_score, 'raw total counts all three correct');
        $this->assertEquals(1.0, (float) $a->merit_score, 'merit counts only the non-qualifying section');
        $this->assertTrue($a->is_qualified, 'CSAT bar of 1 was cleared');
    }

    /** The overall bar is applied to merit, so a qualifying paper cannot carry a candidate. */
    public function test_overall_cutoff_is_applied_to_merit_not_raw_total(): void
    {
        $meritQ = [$this->makeQuestion('GS')];
        $qualQ = [$this->makeQuestion('CSAT'), $this->makeQuestion('CSAT')];

        $test = $this->makeTest(['total_marks' => 3, 'cutoff_marks' => 2]);
        $this->addSection($test, 'General Studies', $meritQ);
        $this->addSection($test, 'CSAT', $qualQ, ['is_qualifying' => true]);

        // Raw total 3 clears a bar of 2; merit is only 1, so it must not.
        $session = $this->sitTest($test, [
            $meritQ[0]->id => 'correct',
            $qualQ[0]->id => 'correct', $qualQ[1]->id => 'correct',
        ]);

        $a = $session->fresh()->analytic;
        $this->assertEquals(3.0, (float) $a->total_score);
        $this->assertEquals(1.0, (float) $a->merit_score);
        $this->assertFalse($a->is_qualified, 'merit 1 is below the overall bar of 2');
    }

    public function test_paper_with_no_cutoff_reports_null_rather_than_failed(): void
    {
        $q = [$this->makeQuestion()];
        $test = $this->makeTest(['total_marks' => 1]);
        $this->addSection($test, 'S1', $q);

        $session = $this->sitTest($test, [$q[0]->id => 'skip']);

        $this->assertNull(
            $session->fresh()->analytic->is_qualified,
            'no bar defined means "not applicable", never "failed"'
        );
    }

    // ── Per-candidate paper ─────────────────────────────────────────────────

    public function test_shuffled_test_persists_the_candidate_paper_order(): void
    {
        $questions = collect(range(1, 8))->map(fn () => $this->makeQuestion())->all();
        $test = $this->makeTest(['shuffle_questions' => true, 'shuffle_options' => true]);
        $section = $this->addSection($test, 'S1', $questions);

        $this->actingAs($this->student);
        $start = $this->postJson("/api/student/tests/{$test->id}/start")->assertOk();
        $session = TestSession::where('user_id', $this->student->id)->firstOrFail();

        $stored = $session->question_order[(string) $section->id];
        $this->assertCount(8, $stored);
        $this->assertEqualsCanonicalizing(collect($questions)->pluck('id')->all(), $stored);

        // The served paper matches the stored order...
        $served = collect($start->json('sections.0.questions'))->pluck('id')->all();
        $this->assertSame($stored, $served);

        // ...and a resume serves that same order, not a fresh shuffle.
        $resumed = $this->getJson("/api/student/tests/sessions/{$session->id}")->assertOk();
        $this->assertSame($stored, collect($resumed->json('sections.0.questions'))->pluck('id')->all());
    }

    public function test_unshuffled_test_keeps_author_order(): void
    {
        $questions = collect(range(1, 5))->map(fn () => $this->makeQuestion())->all();
        $test = $this->makeTest();
        $this->addSection($test, 'S1', $questions);

        $this->actingAs($this->student);
        $start = $this->postJson("/api/student/tests/{$test->id}/start")->assertOk();

        $this->assertSame(
            collect($questions)->pluck('id')->all(),
            collect($start->json('sections.0.questions'))->pluck('id')->all()
        );
        $this->assertNull(TestSession::where('user_id', $this->student->id)->first()->question_order);
    }

    public function test_option_order_is_shuffled_but_complete(): void
    {
        $q = $this->makeQuestion();
        $test = $this->makeTest(['shuffle_options' => true]);
        $this->addSection($test, 'S1', [$q]);

        $this->actingAs($this->student);
        $start = $this->postJson("/api/student/tests/{$test->id}/start")->assertOk();

        $servedOptionIds = collect($start->json('sections.0.questions.0.options'))->pluck('id')->all();
        $this->assertEqualsCanonicalizing(
            QuestionOption::where('question_id', $q->id)->pluck('id')->all(),
            $servedOptionIds
        );

        // Correctness is still never leaked, shuffled or not.
        foreach ($start->json('sections.0.questions.0.options') as $option) {
            $this->assertArrayNotHasKey('is_correct', $option);
        }
    }

    // ── Merit ranking ───────────────────────────────────────────────────────

    /**
     * Equal marks must not stay tied on the published list: fewer wrong answers
     * wins, then less time. Percentile still treats them as tied, because that
     * is what a percentile measures.
     */
    public function test_merit_rank_breaks_ties_on_accuracy_then_time(): void
    {
        $test = $this->makeTest(['total_marks' => 10]);
        $q = $this->makeQuestion();
        $this->addSection($test, 'S1', [$q]);

        // Same score; A made fewer mistakes, B was faster but sloppier.
        $a = $this->seedResult($test, ['total_score' => 8, 'incorrect_count' => 1, 'total_time_seconds' => 600]);
        $b = $this->seedResult($test, ['total_score' => 8, 'incorrect_count' => 4, 'total_time_seconds' => 300]);
        $c = $this->seedResult($test, ['total_score' => 9, 'incorrect_count' => 0, 'total_time_seconds' => 900]);

        $rankOf = fn ($session) => $this->actingAs($session->user)
            ->getJson("/api/student/tests/sessions/{$session->id}/result")->json();

        $this->assertSame(1, $rankOf($c)['merit_rank']);
        $this->assertSame(2, $rankOf($a)['merit_rank'], 'fewer wrong answers wins the tie');
        $this->assertSame(3, $rankOf($b)['merit_rank']);

        // Standard competition ranking is unchanged: the two 8s still share rank 2.
        $this->assertSame(2, $rankOf($a)['rank']);
        $this->assertSame(2, $rankOf($b)['rank']);
    }

    // ── The exam pattern is settable THROUGH THE API ────────────────────────

    /**
     * Regression: the migration, the model and the scoring all understood
     * cut-offs and qualifying sections, but TestController never wrote them, so
     * they were only reachable by touching the model directly. Everything an
     * admin can configure has to survive a round trip through the API.
     */
    public function test_exam_pattern_persists_through_the_create_endpoint(): void
    {
        $q1 = $this->makeQuestion('English');
        $q2 = $this->makeQuestion('CSAT');

        $response = $this->actingAsAdmin()->postJson('/api/admin/tests', [
            'title' => 'SSC CGL Tier I',
            'course_id' => $this->course->id,
            'type' => 'mock',
            'duration_seconds' => 3600,
            'cutoff_marks' => 1.5,
            'shuffle_questions' => true,
            'shuffle_options' => true,
            'shift_group' => 'cgl-2026',
            'shift_label' => 'morning',
            'normalization_method' => 'equipercentile',
            'sections' => [
                [
                    'title' => 'English',
                    'duration_seconds' => 1800,
                    'cutoff_marks' => 0.5,
                    'question_ids' => [$q1->id],
                ],
                [
                    'title' => 'CSAT',
                    'duration_seconds' => 1800,
                    'cutoff_marks' => 0.25,
                    'is_qualifying' => true,
                    'question_ids' => [$q2->id],
                ],
            ],
        ]);

        $response->assertStatus(201);
        $test = Test::latest('id')->firstOrFail();

        $this->assertEquals(1.5, (float) $test->cutoff_marks);
        $this->assertTrue($test->shuffle_questions);
        $this->assertTrue($test->shuffle_options);
        $this->assertSame('cgl-2026', $test->shift_group);
        $this->assertSame('equipercentile', $test->normalization_method);

        $sections = $test->sections()->orderBy('sort_order')->get();
        $this->assertEquals(0.5, (float) $sections[0]->cutoff_marks);
        $this->assertFalse($sections[0]->is_qualifying);
        $this->assertEquals(0.25, (float) $sections[1]->cutoff_marks);
        $this->assertTrue($sections[1]->is_qualifying, 'the qualifying flag must survive the round trip');
    }

    public function test_exam_pattern_can_be_edited_through_the_update_endpoint(): void
    {
        $q = $this->makeQuestion();
        $test = $this->makeTest(['cutoff_marks' => 5, 'shuffle_questions' => false]);
        $this->addSection($test, 'S1', [$q]);

        $this->actingAsAdmin()->putJson("/api/admin/tests/{$test->id}", [
            'title' => $test->title,
            'type' => 'mock',
            'duration_seconds' => 3600,
            'cutoff_marks' => 2.25,
            'shuffle_questions' => true,
            'sections' => [
                ['title' => 'S1', 'cutoff_marks' => 1, 'is_qualifying' => true, 'question_ids' => [$q->id]],
            ],
        ])->assertOk();

        $test->refresh();
        $this->assertEquals(2.25, (float) $test->cutoff_marks);
        $this->assertTrue($test->shuffle_questions);

        $section = $test->sections()->firstOrFail();
        $this->assertEquals(1.0, (float) $section->cutoff_marks);
        $this->assertTrue($section->is_qualifying);
    }

    public function test_an_out_of_range_cutoff_percentage_is_rejected(): void
    {
        $q = $this->makeQuestion();

        $this->actingAsAdmin()->postJson('/api/admin/tests', [
            'title' => 'Bad', 'course_id' => $this->course->id, 'type' => 'mock',
            'duration_seconds' => 3600, 'cutoff_percentage' => 140,
            'sections' => [['title' => 'S1', 'question_ids' => [$q->id]]],
        ])->assertStatus(422)->assertJsonValidationErrors('cutoff_percentage');
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    /**
     * Sit a test as the student and score it.
     * $plan maps question id to 'correct' | 'wrong' | 'skip'.
     */
    private function sitTest(Test $test, array $plan): TestSession
    {
        $this->actingAs($this->student);
        $this->postJson("/api/student/tests/{$test->id}/start")->assertOk();
        $session = TestSession::where('user_id', $this->student->id)
            ->where('test_id', $test->id)->firstOrFail();

        foreach ($plan as $questionId => $intent) {
            if ($intent === 'skip') {
                continue;
            }
            $option = QuestionOption::where('question_id', $questionId)
                ->where('is_correct', $intent === 'correct')
                ->firstOrFail();

            $this->putJson(
                "/api/student/tests/sessions/{$session->id}/answers/{$questionId}",
                ['selected_option_id' => $option->id]
            )->assertOk();
        }

        $this->postJson("/api/student/tests/sessions/{$session->id}/submit")->assertOk();
        (new ComputeTestAnalytics($session->fresh()))->handle();

        return $session->fresh();
    }

    /** A submitted session with pre-baked analytics, for ranking tests. */
    private function seedResult(Test $test, array $analytic): TestSession
    {
        $user = User::factory()->create();
        $user->assignRole('student');
        Enrollment::create([
            'user_id' => $user->id, 'course_id' => $this->course->id,
            'batch_id' => $this->batch->id, 'enrolled_at' => now(), 'is_active' => true,
        ]);

        $session = TestSession::create([
            'user_id' => $user->id, 'test_id' => $test->id,
            'started_at' => now()->subHour(), 'duration_seconds' => 3600, 'submitted_at' => now(),
        ]);

        \App\Models\TestAnalytic::create(array_merge([
            'test_session_id' => $session->id,
            'max_score' => 10, 'correct_count' => 8, 'unanswered_count' => 0,
            'accuracy_percentage' => 80, 'subject_breakdown' => [], 'topic_breakdown' => [],
        ], $analytic));

        return $session->fresh();
    }
}
