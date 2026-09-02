<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Question;
use App\Models\QuestionOption;
use App\Models\Test;
use App\Models\TestAnalytic;
use App\Models\TestAnswer;
use App\Models\TestSession;
use App\Models\User;
use App\Services\ItemAnalysisService;
use App\Services\ScoreNormalizationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Item analysis (classical test theory) and cross-shift normalisation, driven
 * through real attempt rows rather than synthetic numbers.
 */
class ItemAnalysisTest extends TestCase
{
    use RefreshDatabase;

    private Course $course;
    private Test $test;
    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);

        $this->owner = User::factory()->create();
        $this->owner->assignRole('admin');

        $this->course = Course::create(['title' => 'SSC', 'slug' => 'ssc', 'exam_category' => 'SSC']);
        $this->test = Test::create([
            'title' => 'Mock 1', 'course_id' => $this->course->id, 'type' => 'mock',
            'duration_seconds' => 3600, 'total_marks' => 100, 'is_published' => true,
            'created_by' => $this->owner->id,
        ]);
    }

    private function makeQuestion(): Question
    {
        $q = Question::create([
            'subject' => 'Quant', 'topic' => 'Algebra', 'difficulty' => 'medium',
            'question_text' => 'Q?', 'marks' => 1, 'negative_marks' => 0.25,
            'status' => Question::STATUS_APPROVED,
        ]);
        foreach (['a', 'b', 'c', 'd'] as $i => $label) {
            QuestionOption::create([
                'question_id' => $q->id, 'label' => $label, 'option_text' => "opt {$label}",
                'is_correct' => $label === 'a', 'sort_order' => $i,
            ]);
        }
        return $q;
    }

    /**
     * One candidate: a submitted session scoring $totalScore out of 100, whose
     * answer to $question was $optionLabel (null = left blank).
     */
    private function candidate(Question $question, float $totalScore, ?string $optionLabel, ?Test $test = null): TestSession
    {
        $user = User::factory()->create();
        $user->assignRole('student');

        $session = TestSession::create([
            'user_id' => $user->id, 'test_id' => ($test ?? $this->test)->id,
            'started_at' => now()->subHour(), 'duration_seconds' => 3600, 'submitted_at' => now(),
        ]);

        TestAnalytic::create([
            'test_session_id' => $session->id,
            'total_score' => $totalScore, 'max_score' => 100,
            'correct_count' => 0, 'incorrect_count' => 0, 'unanswered_count' => 0,
            'accuracy_percentage' => $totalScore, 'total_time_seconds' => 1200,
            'subject_breakdown' => [], 'topic_breakdown' => [],
        ]);

        $optionId = $optionLabel === null ? null : QuestionOption::where('question_id', $question->id)
            ->where('label', $optionLabel)->value('id');

        TestAnswer::create([
            'test_session_id' => $session->id,
            'question_id' => $question->id,
            'selected_option_id' => $optionId,
            'is_visited' => true,
            'time_spent_seconds' => 45,
        ]);

        return $session;
    }

    // ── difficulty + discrimination ─────────────────────────────────────────

    public function test_difficulty_index_is_the_share_answering_correctly(): void
    {
        $q = $this->makeQuestion();
        foreach ([90, 80, 70, 60] as $score) {
            $this->candidate($q, $score, 'a');   // correct
        }
        foreach ([50, 40, 30, 20, 10, 5] as $score) {
            $this->candidate($q, $score, 'b');   // wrong
        }

        $analysis = app(ItemAnalysisService::class)->analyse($q->id);

        $this->assertSame(10, $analysis['sample_size']);
        $this->assertEqualsWithDelta(0.4, $analysis['difficulty_index'], 0.0001);
    }

    /** A blank counts as not-correct for difficulty, exactly as a scorecard does. */
    public function test_skipped_answers_count_as_incorrect_for_difficulty(): void
    {
        $q = $this->makeQuestion();
        $this->candidate($q, 90, 'a');
        $this->candidate($q, 50, null);

        $analysis = app(ItemAnalysisService::class)->analyse($q->id);

        $this->assertEqualsWithDelta(0.5, $analysis['difficulty_index'], 0.0001);
        $this->assertSame(1, $analysis['skipped_count']);
    }

    public function test_a_good_item_discriminates_positively(): void
    {
        $q = $this->makeQuestion();
        // Strong candidates get it right, weak ones do not: the definition of
        // an item that separates ability.
        foreach ([95, 90, 88, 85, 82] as $score) {
            $this->candidate($q, $score, 'a');
        }
        foreach ([40, 35, 30, 25, 20] as $score) {
            $this->candidate($q, $score, 'c');
        }

        $analysis = app(ItemAnalysisService::class)->analyse($q->id);

        $this->assertGreaterThan(0.4, $analysis['discrimination_index']);
        $this->assertNotContains('negative_discrimination', $analysis['flags']);
    }

    /**
     * The high-value signal. When the STRONG candidates get an item wrong and
     * the weak ones get it right, the item is almost always mis-keyed. It must
     * be flagged rather than left quietly mis-scoring every paper it is in.
     */
    public function test_a_miskeyed_item_discriminates_negatively_and_is_flagged(): void
    {
        $q = $this->makeQuestion();
        // 30 candidates so the sample clears MIN_STATS_SAMPLE and flags fire.
        for ($i = 0; $i < 15; $i++) {
            $this->candidate($q, 90 - $i, 'b');   // strong candidates -> "wrong"
        }
        for ($i = 0; $i < 15; $i++) {
            $this->candidate($q, 40 - $i, 'a');   // weak candidates -> "right"
        }

        $analysis = app(ItemAnalysisService::class)->analyse($q->id);

        $this->assertLessThan(0, $analysis['discrimination_index']);
        $this->assertContains('negative_discrimination', $analysis['flags']);
    }

    public function test_discrimination_is_null_when_every_candidate_answers_alike(): void
    {
        $q = $this->makeQuestion();
        foreach ([90, 70, 50, 30] as $score) {
            $this->candidate($q, $score, 'a');
        }

        $analysis = app(ItemAnalysisService::class)->analyse($q->id);

        // Everyone correct: the item separates nobody, so there is no
        // correlation to report. Reporting 0.0 would imply a measurement.
        $this->assertNull($analysis['discrimination_index']);
        $this->assertEqualsWithDelta(1.0, $analysis['difficulty_index'], 0.0001);
    }

    // ── distractor analysis ─────────────────────────────────────────────────

    public function test_distractor_analysis_counts_choices_and_flags_dead_options(): void
    {
        $q = $this->makeQuestion();
        $this->candidate($q, 90, 'a');
        $this->candidate($q, 80, 'a');
        $this->candidate($q, 40, 'b');
        $this->candidate($q, 30, 'c');
        // nobody picks 'd'

        $analysis = app(ItemAnalysisService::class)->analyse($q->id);
        $byLabel = collect($analysis['distractors'])->keyBy('label');

        $this->assertSame(2, $byLabel['a']['chosen_count']);
        $this->assertTrue($byLabel['a']['is_correct']);
        $this->assertSame(1, $byLabel['b']['chosen_count']);
        $this->assertSame(0, $byLabel['d']['chosen_count'], 'option d is dead weight');

        // Mean ability of the people who chose each option.
        $this->assertEqualsWithDelta(85.0, $byLabel['a']['mean_ability'], 0.01);
        $this->assertNull($byLabel['d']['mean_ability']);
    }

    public function test_small_samples_report_insufficient_data_rather_than_a_verdict(): void
    {
        $q = $this->makeQuestion();
        $this->candidate($q, 90, 'a');
        $this->candidate($q, 20, 'b');

        $analysis = app(ItemAnalysisService::class)->analyse($q->id);

        $this->assertSame(['insufficient_data'], $analysis['flags']);
    }

    public function test_a_never_attempted_question_returns_null(): void
    {
        $q = $this->makeQuestion();
        $this->assertNull(app(ItemAnalysisService::class)->analyse($q->id));
    }

    // ── caching ─────────────────────────────────────────────────────────────

    public function test_recompute_caches_indices_onto_the_question_row(): void
    {
        $q = $this->makeQuestion();
        foreach ([95, 90, 85] as $score) {
            $this->candidate($q, $score, 'a');
        }
        foreach ([30, 25, 20] as $score) {
            $this->candidate($q, $score, 'b');
        }

        $written = app(ItemAnalysisService::class)->recomputeAll();
        $this->assertSame(1, $written);

        $q->refresh();
        $this->assertEqualsWithDelta(0.5, $q->difficulty_index, 0.0001);
        $this->assertGreaterThan(0, $q->discrimination_index);
        $this->assertSame(6, $q->stats_sample_size);
        $this->assertNotNull($q->stats_computed_at);
    }

    public function test_item_analysis_endpoint_is_reachable_by_an_admin(): void
    {
        $admin = User::factory()->create([
            'google2fa_enabled' => true, 'google2fa_secret' => 'LUTWUXK6K5F5GDZ6',
        ]);
        $admin->assignRole('admin');

        $q = $this->makeQuestion();
        $this->candidate($q, 90, 'a');
        $this->candidate($q, 20, 'b');

        $this->actingAs($admin);
        session(['2fa_verified' => true]);

        $this->getJson("/api/admin/questions/{$q->id}/item-analysis")
            ->assertOk()
            ->assertJsonPath('analysis.question_id', $q->id)
            ->assertJsonStructure(['analysis' => ['difficulty_index', 'discrimination_index', 'distractors', 'flags']]);
    }

    // ── normalisation, end to end ───────────────────────────────────────────

    /**
     * Two sittings of one exam, one clearly harder. After normalisation the
     * candidate who topped the hard shift must not be behind a mid-table
     * candidate from the easy shift on raw marks alone.
     */
    public function test_normalisation_lifts_a_hard_shift_and_persists_the_result(): void
    {
        $q = $this->makeQuestion();

        $hardShift = Test::create([
            'title' => 'Shift 1', 'course_id' => $this->course->id, 'type' => 'mock',
            'duration_seconds' => 3600, 'total_marks' => 100, 'is_published' => true,
            'created_by' => $this->owner->id,
            'shift_group' => 'cgl-2026-t1', 'shift_label' => 'morning',
            'normalization_method' => ScoreNormalizationService::METHOD_EQUIPERCENTILE,
        ]);
        $easyShift = Test::create([
            'title' => 'Shift 2', 'course_id' => $this->course->id, 'type' => 'mock',
            'duration_seconds' => 3600, 'total_marks' => 100, 'is_published' => true,
            'created_by' => $this->owner->id,
            'shift_group' => 'cgl-2026-t1', 'shift_label' => 'afternoon',
            'normalization_method' => ScoreNormalizationService::METHOD_EQUIPERCENTILE,
        ]);

        $hardTopper = null;
        foreach ([30, 25, 20, 15, 10] as $score) {
            $s = $this->candidate($q, $score, 'a', $hardShift);
            $hardTopper ??= $s;
        }
        foreach ([80, 70, 60, 50, 40] as $score) {
            $this->candidate($q, $score, 'a', $easyShift);
        }

        $result = app(ScoreNormalizationService::class)->normalizeShiftGroup('cgl-2026-t1');

        $this->assertSame(2, $result['tests']);
        $this->assertSame(10, $result['sessions']);
        $this->assertSame(ScoreNormalizationService::METHOD_EQUIPERCENTILE, $result['method']);

        $normalised = (float) $hardTopper->fresh()->analytic->normalized_score;
        $this->assertGreaterThan(30, $normalised, 'topping the hard shift is worth more than its raw 30');

        // The raw score is never overwritten - normalisation is additive.
        $this->assertEquals(30.0, (float) $hardTopper->fresh()->analytic->total_score);
    }

    public function test_a_group_with_no_method_set_is_left_untouched(): void
    {
        $q = $this->makeQuestion();
        $plain = Test::create([
            'title' => 'Plain', 'course_id' => $this->course->id, 'type' => 'mock',
            'duration_seconds' => 3600, 'total_marks' => 100, 'is_published' => true,
            'created_by' => $this->owner->id,
            'shift_group' => 'no-normalisation',
        ]);
        $session = $this->candidate($q, 55, 'a', $plain);

        $result = app(ScoreNormalizationService::class)->normalizeShiftGroup('no-normalisation');

        $this->assertSame(ScoreNormalizationService::METHOD_NONE, $result['method']);
        $this->assertSame(0, $result['sessions']);
        $this->assertNull($session->fresh()->analytic->normalized_score);
    }
}
