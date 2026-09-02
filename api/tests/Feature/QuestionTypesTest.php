<?php

namespace Tests\Feature;

use App\Imports\QuestionImport;
use App\Jobs\ComputeTestAnalytics;
use App\Models\Batch;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Passage;
use App\Models\Question;
use App\Models\QuestionOption;
use App\Models\Test;
use App\Models\TestSection;
use App\Models\TestSectionQuestion;
use App\Models\TestSession;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

/**
 * multi_select, numeric and passage-grouped questions — the SSC/Banking/RRB
 * formats a single_choice-only bank cannot faithfully mirror. See
 * TestAnswer::isCorrect()/isAttempted() for where the scoring dispatch lives;
 * ComputeTestAnalytics itself is untouched by any of this.
 */
class QuestionTypesTest extends TestCase
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

    private function makeTest(array $attrs = []): Test
    {
        return Test::create(array_merge([
            'title' => 'Mock', 'course_id' => $this->course->id, 'batch_id' => $this->batch->id,
            'type' => 'mock', 'duration_seconds' => 3600, 'total_marks' => 0,
            'is_published' => true, 'created_by' => $this->admin->id,
        ], $attrs));
    }

    private function addSection(Test $test, string $title, array $questions): TestSection
    {
        $section = TestSection::create([
            'test_id' => $test->id, 'title' => $title,
            'sort_order' => $test->sections()->count(),
        ]);

        foreach ($questions as $i => $q) {
            TestSectionQuestion::create([
                'test_section_id' => $section->id, 'question_id' => $q->id, 'sort_order' => $i,
            ]);
        }
        return $section;
    }

    private function startSessionFor(Test $test): TestSession
    {
        $this->actingAs($this->student);
        $this->postJson("/api/student/tests/{$test->id}/start")->assertOk();
        return TestSession::where('user_id', $this->student->id)->where('test_id', $test->id)->firstOrFail();
    }

    // ── multi_select ─────────────────────────────────────────────────────

    /** A statement-based "which of the above are correct" question, 3 correct of 4. */
    private function makeMultiSelectQuestion(): array
    {
        $q = Question::create([
            'subject' => 'Reasoning', 'topic' => 'Statements', 'difficulty' => 'medium',
            'question_text' => 'Which statements are true?', 'marks' => 2.0, 'negative_marks' => 0.5,
            'question_type' => Question::TYPE_MULTI_SELECT,
            'status' => Question::STATUS_APPROVED,
        ]);
        $options = [
            'a' => QuestionOption::create(['question_id' => $q->id, 'label' => 'a', 'option_text' => 'true 1', 'is_correct' => true, 'sort_order' => 0]),
            'b' => QuestionOption::create(['question_id' => $q->id, 'label' => 'b', 'option_text' => 'false', 'is_correct' => false, 'sort_order' => 1]),
            'c' => QuestionOption::create(['question_id' => $q->id, 'label' => 'c', 'option_text' => 'true 2', 'is_correct' => true, 'sort_order' => 2]),
            'd' => QuestionOption::create(['question_id' => $q->id, 'label' => 'd', 'option_text' => 'true 3', 'is_correct' => true, 'sort_order' => 3]),
        ];
        return [$q, $options];
    }

    public function test_multi_select_scores_correct_only_when_the_exact_set_is_selected(): void
    {
        [$q, $opts] = $this->makeMultiSelectQuestion();
        $test = $this->makeTest();
        $this->addSection($test, 'S1', [$q]);
        $session = $this->startSessionFor($test);

        $this->putJson("/api/student/tests/sessions/{$session->id}/answers/{$q->id}", [
            'selected_option_ids' => [$opts['a']->id, $opts['c']->id, $opts['d']->id],
        ])->assertOk();

        $this->postJson("/api/student/tests/sessions/{$session->id}/submit")->assertOk();
        (new ComputeTestAnalytics($session->fresh()))->handle();

        $analytic = $session->fresh()->analytic;
        $this->assertSame(1, $analytic->correct_count);
        $this->assertEquals(2.0, (float) $analytic->total_score);
    }

    public function test_multi_select_is_all_or_nothing_a_partial_correct_subset_scores_incorrect(): void
    {
        [$q, $opts] = $this->makeMultiSelectQuestion();
        $test = $this->makeTest();
        $this->addSection($test, 'S1', [$q]);
        $session = $this->startSessionFor($test);

        // Only 2 of the 3 correct options — a real candidate under-selecting.
        $this->putJson("/api/student/tests/sessions/{$session->id}/answers/{$q->id}", [
            'selected_option_ids' => [$opts['a']->id, $opts['c']->id],
        ])->assertOk();

        $this->postJson("/api/student/tests/sessions/{$session->id}/submit")->assertOk();
        (new ComputeTestAnalytics($session->fresh()))->handle();

        $analytic = $session->fresh()->analytic;
        $this->assertSame(0, $analytic->correct_count);
        $this->assertSame(1, $analytic->incorrect_count);
        $this->assertEquals(-0.5, (float) $analytic->total_score);
    }

    public function test_multi_select_selecting_a_wrong_extra_option_scores_incorrect(): void
    {
        [$q, $opts] = $this->makeMultiSelectQuestion();
        $test = $this->makeTest();
        $this->addSection($test, 'S1', [$q]);
        $session = $this->startSessionFor($test);

        // All 3 correct PLUS the wrong one.
        $this->putJson("/api/student/tests/sessions/{$session->id}/answers/{$q->id}", [
            'selected_option_ids' => [$opts['a']->id, $opts['b']->id, $opts['c']->id, $opts['d']->id],
        ])->assertOk();

        $this->postJson("/api/student/tests/sessions/{$session->id}/submit")->assertOk();
        (new ComputeTestAnalytics($session->fresh()))->handle();

        $this->assertSame(0, $session->fresh()->analytic->correct_count);
    }

    public function test_multi_select_rejects_an_option_id_belonging_to_another_question(): void
    {
        [$q, ] = $this->makeMultiSelectQuestion();
        [$other, $otherOpts] = $this->makeMultiSelectQuestion();
        $test = $this->makeTest();
        $this->addSection($test, 'S1', [$q, $other]);
        $session = $this->startSessionFor($test);

        $response = $this->putJson("/api/student/tests/sessions/{$session->id}/answers/{$q->id}", [
            'selected_option_ids' => [$otherOpts['a']->id],
        ]);

        $response->assertStatus(422);
    }

    // ── numeric ──────────────────────────────────────────────────────────

    private function makeNumericQuestion(float $answer = 42.5, float $tolerance = 0.5): Question
    {
        return Question::create([
            'subject' => 'Quant', 'topic' => 'Arithmetic', 'difficulty' => 'medium',
            'question_text' => 'Compute the value.', 'marks' => 2.0, 'negative_marks' => 0.5,
            'question_type' => Question::TYPE_NUMERIC,
            'numeric_answer' => $answer, 'numeric_tolerance' => $tolerance,
            'status' => Question::STATUS_APPROVED,
        ]);
    }

    public function test_numeric_answer_within_tolerance_scores_correct(): void
    {
        $q = $this->makeNumericQuestion(answer: 42.5, tolerance: 0.5);
        $test = $this->makeTest();
        $this->addSection($test, 'S1', [$q]);
        $session = $this->startSessionFor($test);

        $this->putJson("/api/student/tests/sessions/{$session->id}/answers/{$q->id}", [
            'numeric_response' => 42.9, // within 0.5 of 42.5
        ])->assertOk();

        $this->postJson("/api/student/tests/sessions/{$session->id}/submit")->assertOk();
        (new ComputeTestAnalytics($session->fresh()))->handle();

        $this->assertSame(1, $session->fresh()->analytic->correct_count);
    }

    public function test_numeric_answer_outside_tolerance_scores_incorrect(): void
    {
        $q = $this->makeNumericQuestion(answer: 42.5, tolerance: 0.5);
        $test = $this->makeTest();
        $this->addSection($test, 'S1', [$q]);
        $session = $this->startSessionFor($test);

        $this->putJson("/api/student/tests/sessions/{$session->id}/answers/{$q->id}", [
            'numeric_response' => 43.2, // 0.7 away, outside 0.5 tolerance
        ])->assertOk();

        $this->postJson("/api/student/tests/sessions/{$session->id}/submit")->assertOk();
        (new ComputeTestAnalytics($session->fresh()))->handle();

        $analytic = $session->fresh()->analytic;
        $this->assertSame(0, $analytic->correct_count);
        $this->assertSame(1, $analytic->incorrect_count);
    }

    public function test_numeric_answer_at_exact_tolerance_boundary_scores_correct(): void
    {
        $q = $this->makeNumericQuestion(answer: 100, tolerance: 2);
        $test = $this->makeTest();
        $this->addSection($test, 'S1', [$q]);
        $session = $this->startSessionFor($test);

        $this->putJson("/api/student/tests/sessions/{$session->id}/answers/{$q->id}", [
            'numeric_response' => 98, // exactly at the lower boundary
        ])->assertOk();

        $this->postJson("/api/student/tests/sessions/{$session->id}/submit")->assertOk();
        (new ComputeTestAnalytics($session->fresh()))->handle();

        $this->assertSame(1, $session->fresh()->analytic->correct_count);
    }

    public function test_numeric_unanswered_is_skipped_not_penalized(): void
    {
        $q = $this->makeNumericQuestion();
        $test = $this->makeTest();
        $this->addSection($test, 'S1', [$q]);
        $session = $this->startSessionFor($test);

        $this->postJson("/api/student/tests/sessions/{$session->id}/submit")->assertOk();
        (new ComputeTestAnalytics($session->fresh()))->handle();

        $analytic = $session->fresh()->analytic;
        $this->assertSame(0, $analytic->correct_count);
        $this->assertSame(0, $analytic->incorrect_count);
        $this->assertSame(1, $analytic->unanswered_count);
        $this->assertEquals(0.0, (float) $analytic->total_score);
    }

    // ── passages ─────────────────────────────────────────────────────────

    public function test_passage_linked_question_carries_the_passage_through_session_state_and_result(): void
    {
        $passage = Passage::create([
            'title' => 'Reading Comprehension 1',
            'body' => 'Once upon a time in an SSC exam hall...',
            'created_by' => $this->admin->id,
        ]);

        $q = Question::create([
            'subject' => 'English', 'topic' => 'Comprehension', 'difficulty' => 'medium',
            'question_text' => 'What is the passage about?', 'marks' => 1.0, 'negative_marks' => 0.25,
            'passage_id' => $passage->id,
            'status' => Question::STATUS_APPROVED,
        ]);
        QuestionOption::create(['question_id' => $q->id, 'label' => 'a', 'option_text' => 'right', 'is_correct' => true, 'sort_order' => 0]);
        QuestionOption::create(['question_id' => $q->id, 'label' => 'b', 'option_text' => 'wrong', 'is_correct' => false, 'sort_order' => 1]);

        $test = $this->makeTest();
        $this->addSection($test, 'S1', [$q]);
        $session = $this->startSessionFor($test);

        $stateResponse = $this->getJson("/api/student/tests/sessions/{$session->id}");
        $stateResponse->assertOk()
            ->assertJsonPath('sections.0.questions.0.passage.body', 'Once upon a time in an SSC exam hall...');

        $this->postJson("/api/student/tests/sessions/{$session->id}/submit")->assertOk();
        (new ComputeTestAnalytics($session->fresh()))->handle();

        $resultResponse = $this->getJson("/api/student/tests/sessions/{$session->id}/result");
        $resultResponse->assertOk()
            ->assertJsonPath('answers.0.passage.title', 'Reading Comprehension 1');
    }

    public function test_admin_cannot_delete_a_passage_that_still_has_questions_linked(): void
    {
        $passage = Passage::create(['body' => 'A passage.', 'created_by' => $this->admin->id]);
        Question::create([
            'subject' => 'English', 'topic' => 'Comprehension', 'difficulty' => 'easy',
            'question_text' => 'Q?', 'marks' => 1.0, 'negative_marks' => 0,
            'passage_id' => $passage->id,
        ]);

        $response = $this->actingAsAdmin()->deleteJson("/api/admin/passages/{$passage->id}");

        $response->assertStatus(422);
        $this->assertNotNull($passage->fresh());
    }

    // ── admin authoring validation ───────────────────────────────────────

    public function test_store_question_rejects_multi_select_with_zero_correct_options(): void
    {
        $response = $this->actingAsAdmin()->postJson('/api/admin/questions', [
            'subject' => 'Reasoning', 'topic' => 'Statements', 'difficulty' => 'medium',
            'question_text' => 'Which are true?', 'marks' => 2, 'negative_marks' => 0.5,
            'question_type' => Question::TYPE_MULTI_SELECT,
            'options' => [
                ['label' => 'a', 'option_text' => 'x', 'is_correct' => false],
                ['label' => 'b', 'option_text' => 'y', 'is_correct' => false],
            ],
        ]);

        $response->assertStatus(422)->assertJsonValidationErrors('options');
    }

    public function test_store_question_accepts_multi_select_with_several_correct_options(): void
    {
        $response = $this->actingAsAdmin()->postJson('/api/admin/questions', [
            'subject' => 'Reasoning', 'topic' => 'Statements', 'difficulty' => 'medium',
            'question_text' => 'Which are true?', 'marks' => 2, 'negative_marks' => 0.5,
            'question_type' => Question::TYPE_MULTI_SELECT,
            'options' => [
                ['label' => 'a', 'option_text' => 'x', 'is_correct' => true],
                ['label' => 'b', 'option_text' => 'y', 'is_correct' => false],
                ['label' => 'c', 'option_text' => 'z', 'is_correct' => true],
            ],
        ]);

        $response->assertStatus(201);
        $q = Question::where('question_text', 'Which are true?')->firstOrFail();
        $this->assertSame(2, $q->correctOptions()->count());
    }

    public function test_store_question_rejects_numeric_type_without_a_numeric_answer(): void
    {
        $response = $this->actingAsAdmin()->postJson('/api/admin/questions', [
            'subject' => 'Quant', 'topic' => 'Arithmetic', 'difficulty' => 'medium',
            'question_text' => 'Compute it.', 'marks' => 2, 'negative_marks' => 0.5,
            'question_type' => Question::TYPE_NUMERIC,
        ]);

        $response->assertStatus(422)->assertJsonValidationErrors('numeric_answer');
    }

    public function test_store_question_creates_a_numeric_question_with_no_options_at_all(): void
    {
        $response = $this->actingAsAdmin()->postJson('/api/admin/questions', [
            'subject' => 'Quant', 'topic' => 'Arithmetic', 'difficulty' => 'medium',
            'question_text' => 'Compute it.', 'marks' => 2, 'negative_marks' => 0.5,
            'question_type' => Question::TYPE_NUMERIC,
            'numeric_answer' => 3.14, 'numeric_tolerance' => 0.01,
        ]);

        $response->assertStatus(201);
        $q = Question::where('question_text', 'Compute it.')->firstOrFail();
        $this->assertSame(0, $q->options()->count());
        $this->assertEquals(3.14, (float) $q->numeric_answer);
    }

    // ── CSV import ───────────────────────────────────────────────────────

    public function test_csv_import_creates_a_multi_select_question_with_pipe_separated_correct_letters(): void
    {
        $csv = "subject,topic,difficulty,question_text,question_type,option_a,option_b,option_c,option_d,correct_option,marks,negative_marks\n"
            . "Reasoning,Statements,medium,\"Which are true?\",multi_select,\"S1\",\"S2\",\"S3\",\"S4\",\"a|c\",2.00,0.50\n";

        $file = UploadedFile::fake()->createWithContent('questions.csv', $csv);
        $import = new QuestionImport($this->admin->id);
        $import->import($file->getRealPath(), null, \Maatwebsite\Excel\Excel::CSV);

        $this->assertEmpty($import->getErrors());
        $this->assertEquals(1, $import->getImportedCount());

        $q = Question::where('subject', 'Reasoning')->firstOrFail();
        $this->assertSame(Question::TYPE_MULTI_SELECT, $q->question_type);
        $this->assertSame(2, $q->correctOptions()->count());
        $this->assertTrue($q->options()->where('label', 'a')->first()->is_correct);
        $this->assertTrue($q->options()->where('label', 'c')->first()->is_correct);
        $this->assertFalse($q->options()->where('label', 'b')->first()->is_correct);
    }

    public function test_csv_import_creates_a_numeric_question_with_no_option_columns_required(): void
    {
        $csv = "subject,topic,difficulty,question_text,question_type,numeric_answer,numeric_tolerance,marks,negative_marks\n"
            . "Quant,Arithmetic,medium,\"Compute it.\",numeric,42.5,0.5,2.00,0.50\n";

        $file = UploadedFile::fake()->createWithContent('questions.csv', $csv);
        $import = new QuestionImport($this->admin->id);
        $import->import($file->getRealPath(), null, \Maatwebsite\Excel\Excel::CSV);

        $this->assertEmpty($import->getErrors());
        $this->assertEquals(1, $import->getImportedCount());

        $q = Question::where('subject', 'Quant')->firstOrFail();
        $this->assertSame(Question::TYPE_NUMERIC, $q->question_type);
        $this->assertSame(0, $q->options()->count());
        $this->assertEquals(42.5, (float) $q->numeric_answer);
    }

    public function test_csv_import_still_defaults_to_single_choice_when_the_column_is_omitted(): void
    {
        // The exact legacy format, no question_type column at all.
        $csv = "subject,topic,difficulty,question_text,option_a,option_b,option_c,option_d,correct_option,marks,negative_marks\n"
            . "Math,Algebra,easy,\"Solve 2+2\",\"3\",\"4\",\"5\",\"6\",b,2.00,0.50\n";

        $file = UploadedFile::fake()->createWithContent('questions.csv', $csv);
        $import = new QuestionImport($this->admin->id);
        $import->import($file->getRealPath(), null, \Maatwebsite\Excel\Excel::CSV);

        $this->assertEmpty($import->getErrors());
        $q = Question::where('subject', 'Math')->firstOrFail();
        $this->assertSame(Question::TYPE_SINGLE_CHOICE, $q->question_type);
        $this->assertSame(4, $q->options()->count());
    }

    public function test_csv_import_reports_a_row_error_when_correct_option_names_no_provided_column(): void
    {
        $csv = "subject,topic,difficulty,question_text,option_a,option_b,correct_option,marks,negative_marks\n"
            . "Math,Algebra,easy,\"Solve 2+2\",\"3\",\"4\",z,2.00,0.50\n";

        $file = UploadedFile::fake()->createWithContent('questions.csv', $csv);
        $import = new QuestionImport($this->admin->id);
        $import->import($file->getRealPath(), null, \Maatwebsite\Excel\Excel::CSV);

        $this->assertEquals(0, $import->getImportedCount());
        $this->assertNotEmpty($import->getErrors());
    }
}
