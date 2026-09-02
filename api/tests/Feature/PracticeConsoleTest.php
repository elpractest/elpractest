<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Entitlement;
use App\Models\Question;
use App\Models\QuestionOption;
use App\Models\Test;
use App\Models\TestSection;
use App\Models\TestSectionQuestion;
use App\Models\TestSeries;
use App\Models\User;
use App\Services\ItemAnalysisService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The custom practice console.
 *
 * Two properties matter beyond "it builds a paper": the pool is limited to what
 * the student actually bought, and the resulting attempts stay out of the
 * aggregate analytics.
 */
class PracticeConsoleTest extends TestCase
{
    use RefreshDatabase;

    private User $student;
    private User $outsider;
    private TestSeries $ownedSeries;
    private TestSeries $otherSeries;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);

        $this->student = User::factory()->create();
        $this->student->assignRole('student');

        $this->outsider = User::factory()->create();
        $this->outsider->assignRole('student');

        $this->ownedSeries = $this->series('Owned Series');
        $this->otherSeries = $this->series('Someone Elses Series');

        // 20 Reasoning questions the student owns, 20 Biology ones they do not.
        $this->testWithQuestions($this->ownedSeries, 'Reasoning', 'Syllogism', 'easy', 20);
        $this->testWithQuestions($this->otherSeries, 'Biology', 'Genetics', 'hard', 20);

        Entitlement::create([
            'user_id' => $this->student->id,
            'grantable_type' => TestSeries::class,
            'grantable_id' => $this->ownedSeries->id,
            'source' => Entitlement::SOURCE_MANUAL,
            'starts_at' => now()->subDay(),
            'is_active' => true,
        ]);
    }

    public function test_the_pool_is_limited_to_what_the_student_owns(): void
    {
        $options = $this->actingAs($this->student)
            ->getJson('/api/student/practice-tests/options')
            ->assertStatus(200);

        $subjects = collect($options->json('subjects'))->pluck('subject');

        $this->assertTrue($subjects->contains('Reasoning'));
        $this->assertFalse($subjects->contains('Biology'), 'unowned content must not appear in the pool');
        $this->assertSame(20, $options->json('total_available'));
    }

    public function test_a_student_who_owns_nothing_sees_an_empty_pool(): void
    {
        $options = $this->actingAs($this->outsider)
            ->getJson('/api/student/practice-tests/options')
            ->assertStatus(200);

        $this->assertSame(0, $options->json('total_available'));
    }

    public function test_a_free_test_puts_its_questions_in_everyones_pool(): void
    {
        $this->testWithQuestions($this->otherSeries, 'General Awareness', 'Polity', 'easy', 5, free: true);

        $options = $this->actingAs($this->outsider)
            ->getJson('/api/student/practice-tests/options')
            ->assertStatus(200);

        $this->assertSame(5, $options->json('total_available'));
    }

    public function test_a_paper_is_built_to_the_requested_length_and_clock(): void
    {
        $response = $this->actingAs($this->student)
            ->postJson('/api/student/practice-tests', [
                'subject' => 'Reasoning',
                'question_count' => 10,
                'duration_minutes' => 15,
            ])
            ->assertStatus(201);

        $test = Test::findOrFail($response->json('test.id'));

        $this->assertSame($this->student->id, $test->owner_id);
        $this->assertSame(900, $test->duration_seconds);
        $this->assertSame(10, TestSectionQuestion::whereIn(
            'test_section_id',
            TestSection::where('test_id', $test->id)->select('id')
        )->count());
    }

    public function test_asking_for_more_than_the_pool_holds_explains_the_shortfall(): void
    {
        $this->actingAs($this->student)
            ->postJson('/api/student/practice-tests', [
                'subject' => 'Reasoning',
                'question_count' => 50,
                'duration_minutes' => 60,
            ])
            ->assertStatus(422)
            ->assertJsonPath('available', 20);
    }

    public function test_a_filter_matching_nothing_owned_is_refused(): void
    {
        $this->actingAs($this->student)
            ->postJson('/api/student/practice-tests', [
                'subject' => 'Biology',
                'question_count' => 5,
                'duration_minutes' => 10,
            ])
            ->assertStatus(422)
            ->assertJsonPath('available', 0);
    }

    public function test_a_practice_paper_is_private_to_its_owner(): void
    {
        $test = $this->buildPaper();

        $this->actingAs($this->outsider)
            ->postJson("/api/student/tests/{$test->id}/start")
            ->assertStatus(403);

        $this->actingAs($this->student)
            ->postJson("/api/student/tests/{$test->id}/start")
            ->assertStatus(200);
    }

    public function test_practice_papers_never_appear_in_the_shared_test_listing(): void
    {
        $test = $this->buildPaper();

        $ids = collect(
            $this->actingAs($this->student)->getJson('/api/student/tests')->json('tests')
        )->pluck('id');

        $this->assertFalse($ids->contains($test->id), 'a private paper belongs in its own list, not the catalogue');
    }

    public function test_only_the_owner_can_delete_a_practice_paper(): void
    {
        $test = $this->buildPaper();

        $this->actingAs($this->outsider)
            ->deleteJson("/api/student/practice-tests/{$test->id}")
            ->assertStatus(404);

        $this->actingAs($this->student)
            ->deleteJson("/api/student/practice-tests/{$test->id}")
            ->assertStatus(200);
    }

    /**
     * The reason practice is excluded from item analysis: the candidate chose
     * the subject, the length and the clock, so these attempts would drag
     * difficulty_index toward whatever people drill and make discrimination
     * meaningless. Item statistics are what reveal a wrong answer key, so they
     * have to stay a clean signal.
     */
    public function test_practice_attempts_are_excluded_from_item_statistics(): void
    {
        $test = $this->buildPaper();

        $this->actingAs($this->student)->postJson("/api/student/tests/{$test->id}/start")->assertStatus(200);
        $session = \App\Models\TestSession::where('test_id', $test->id)->firstOrFail();
        $this->actingAs($this->student)->postJson("/api/student/tests/sessions/{$session->id}/submit")->assertStatus(200);

        $written = app(ItemAnalysisService::class)->recomputeAll();

        $this->assertSame(0, $written, 'no question should have gained statistics from a practice attempt');
        $this->assertSame(0, Question::whereNotNull('stats_computed_at')->count());
    }

    public function test_the_generator_is_rate_limited(): void
    {
        // The limiter is 6/min; the 7th call in the same minute is refused.
        for ($i = 0; $i < 6; $i++) {
            $this->actingAs($this->student)
                ->postJson('/api/student/practice-tests', [
                    'question_count' => 5,
                    'duration_minutes' => 5,
                ])
                ->assertStatus(201);
        }

        $this->actingAs($this->student)
            ->postJson('/api/student/practice-tests', [
                'question_count' => 5,
                'duration_minutes' => 5,
            ])
            ->assertStatus(429);
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private function buildPaper(int $count = 5): Test
    {
        $response = $this->actingAs($this->student)
            ->postJson('/api/student/practice-tests', [
                'subject' => 'Reasoning',
                'question_count' => $count,
                'duration_minutes' => 10,
            ])
            ->assertStatus(201);

        return Test::findOrFail($response->json('test.id'));
    }

    private function series(string $title): TestSeries
    {
        return TestSeries::create([
            'title' => $title,
            'slug' => \Illuminate\Support\Str::slug($title),
            'exam_category' => 'SSC',
            'is_published' => true,
            'created_by' => User::factory()->create()->id,
        ]);
    }

    private function testWithQuestions(
        TestSeries $series,
        string $subject,
        string $topic,
        string $difficulty,
        int $count,
        bool $free = false,
    ): Test {
        $admin = User::factory()->create();

        $test = Test::create([
            'title' => "{$subject} paper",
            'type' => 'mock',
            'duration_seconds' => 3600,
            'total_marks' => $count,
            'is_published' => true,
            'created_by' => $admin->id,
            'test_series_id' => $series->id,
            'is_free' => $free,
        ]);

        $section = TestSection::create(['test_id' => $test->id, 'title' => 'S1', 'sort_order' => 0]);

        for ($i = 0; $i < $count; $i++) {
            $question = Question::create([
                'subject' => $subject,
                'topic' => $topic,
                'difficulty' => $difficulty,
                'question_text' => "{$subject} question {$i}",
                'marks' => 1,
                'negative_marks' => 0.25,
                'is_active' => true,
                'status' => Question::STATUS_APPROVED,
                'created_by' => $admin->id,
            ]);

            QuestionOption::create([
                'question_id' => $question->id,
                'label' => 'a',
                'option_text' => 'Right',
                'is_correct' => true,
                'sort_order' => 0,
            ]);

            QuestionOption::create([
                'question_id' => $question->id,
                'label' => 'b',
                'option_text' => 'Wrong',
                'is_correct' => false,
                'sort_order' => 1,
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
