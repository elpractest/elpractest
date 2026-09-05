<?php

namespace App\Services;

use App\Models\Question;
use App\Models\Test;
use App\Models\TestSection;
use App\Models\TestSectionQuestion;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * Builds a private practice paper to a student's own spec.
 *
 * It generates a real `Test` row rather than a parallel entity, so sections,
 * sessions, the palette, per-candidate shuffling, every question type, scoring
 * and the result screen all work with no changes at all. The only thing that
 * marks it out is `owner_id`, which makes it private and keeps it out of the
 * aggregate analytics.
 */
class PracticeTestBuilder
{
    public const MIN_QUESTIONS = 5;
    public const MAX_QUESTIONS = 100;
    public const MIN_MINUTES = 1;
    public const MAX_MINUTES = 180;

    public function __construct(
        private readonly EntitlementService $entitlements,
    ) {}

    /**
     * The questions this student is allowed to practise on.
     *
     * Scoped to what they have actually bought: every approved, active question
     * that appears in a test they may sit. A student who owns nothing gets the
     * free samples and nothing else, which is the intended shape — the bank is
     * the asset, and practice is a reason to keep a subscription rather than a
     * way to read it for nothing.
     */
    public function pool(User $user): \Illuminate\Database\Eloquent\Builder
    {
        $testIds = $this->entitlements->accessibleTestIds($user);
        $pools = $this->entitlements->accessiblePools($user);

        return Question::query()
            ->where('questions.is_active', true)
            ->where('questions.status', Question::STATUS_APPROVED)
            ->where(function ($outer) use ($testIds, $pools) {
                // Rail one, unchanged: every question in a paper they may sit.
                $outer->whereIn('questions.id', function ($q) use ($testIds) {
                    $q->select('tsq.question_id')
                      ->from('test_section_questions as tsq')
                      ->join('test_sections as ts', 'tsq.test_section_id', '=', 'ts.id')
                      ->whereIn('ts.test_id', $testIds);
                });

                // Rail two, additive: every question matching a pool they own.
                // A pool is a saved taxonomy filter, so this stays correct as
                // more of that exam is imported — there is no list to re-sync.
                foreach ($pools as $poolEntitlement) {
                    $facets = $poolEntitlement->facets();

                    // An unbounded pool would match the whole bank. Guarded at
                    // creation, and skipped here too rather than trusted.
                    if ($facets === []) {
                        continue;
                    }

                    $outer->orWhere(fn ($q) => $q->matchingFacets($facets));
                }
            });
    }

    /**
     * What the student can filter by, counted against their own pool.
     *
     * The console needs this to avoid offering a subject that would return zero
     * questions — an empty result after filling in a form reads as a broken
     * feature, not as "you don't own that subject yet".
     */
    public function facets(User $user): array
    {
        $subjects = (clone $this->pool($user))
            ->select('questions.subject', DB::raw('count(*) as total'))
            ->groupBy('questions.subject')
            ->orderBy('questions.subject')
            ->get()
            ->map(fn ($row) => ['subject' => $row->subject, 'total' => (int) $row->total]);

        $topics = (clone $this->pool($user))
            ->select('questions.subject', 'questions.topic', DB::raw('count(*) as total'))
            ->groupBy('questions.subject', 'questions.topic')
            ->orderBy('questions.topic')
            ->get()
            ->map(fn ($row) => [
                'subject' => $row->subject,
                'topic' => $row->topic,
                'total' => (int) $row->total,
            ]);

        $difficulties = (clone $this->pool($user))
            ->select('questions.difficulty', DB::raw('count(*) as total'))
            ->groupBy('questions.difficulty')
            ->get()
            ->mapWithKeys(fn ($row) => [$row->difficulty => (int) $row->total]);

        // Exams the student can actually drill, with the display name from
        // the registry so the console never shows a raw code.
        $exams = (clone $this->pool($user))
            ->select('questions.exam_code', 'questions.paper', DB::raw('count(*) as total'))
            ->whereNotNull('questions.exam_code')
            ->groupBy('questions.exam_code', 'questions.paper')
            ->orderBy('questions.exam_code')
            ->get()
            ->map(fn ($row) => [
                'exam_code' => $row->exam_code,
                'exam_name' => config("exams.registry.{$row->exam_code}.name", $row->exam_code),
                'paper' => $row->paper,
                'total' => (int) $row->total,
            ]);

        $sources = (clone $this->pool($user))
            ->select('questions.source', DB::raw('count(*) as total'))
            ->groupBy('questions.source')
            ->get()
            ->mapWithKeys(fn ($row) => [$row->source => (int) $row->total]);

        $years = (clone $this->pool($user))
            ->select('questions.year', DB::raw('count(*) as total'))
            ->whereNotNull('questions.year')
            ->groupBy('questions.year')
            ->orderByDesc('questions.year')
            ->get()
            ->map(fn ($row) => ['year' => (int) $row->year, 'total' => (int) $row->total]);

        return [
            'subjects' => $subjects->values()->all(),
            'topics' => $topics->values()->all(),
            'difficulty_counts' => $difficulties->all(),
            'exams' => $exams->values()->all(),
            'source_counts' => $sources->all(),
            'years' => $years->values()->all(),
            'total_available' => (clone $this->pool($user))->count(),
        ];
    }

    /**
     * How many questions match a spec — so the console can say "only 34
     * available" before the student commits to a 50-question paper.
     */
    public function countMatching(User $user, array $spec): int
    {
        return $this->filtered($user, $spec)->count();
    }

    /**
     * Build the paper. Returns null when the pool cannot fill it.
     *
     * @param array{subject?:?string, topics?:?array, difficulty?:?string, question_count:int, duration_minutes:int, title?:?string} $spec
     */
    public function build(User $user, array $spec): ?Test
    {
        $count = (int) $spec['question_count'];

        // inRandomOrder() rather than shuffling in PHP: the pool can be tens of
        // thousands of rows and only `count` of them are ever needed.
        $questions = $this->filtered($user, $spec)
            ->inRandomOrder()
            ->limit($count)
            ->get(['questions.id', 'questions.marks']);

        if ($questions->count() < $count) {
            return null;
        }

        return DB::transaction(function () use ($user, $spec, $questions) {
            $test = Test::create([
                'title' => $this->title($spec),
                'type' => 'practice',
                'owner_id' => $user->id,
                'created_by' => $user->id,
                'duration_seconds' => (int) $spec['duration_minutes'] * 60,
                'total_marks' => $questions->sum('marks'),
                'is_published' => true,
                'max_attempts' => null,
                // Not part of any catalogue: no course, no batch, no series.
                // accessibleTestIds() would otherwise treat an unscoped paper as
                // platform-wide, which is why it filters practice papers out by
                // owner_id rather than by scope.
                'course_id' => null,
                'batch_id' => null,
                'test_series_id' => null,
                // The draw was already random; shuffling options as well means a
                // retake of the same paper is not pure recall of position.
                'shuffle_options' => true,
                'instructions' => 'Practice paper — your result is private and does not affect rankings.',
            ]);

            $section = TestSection::create([
                'test_id' => $test->id,
                'title' => 'Practice',
                'sort_order' => 0,
                'duration_seconds' => null,
            ]);

            // No created_at/updated_at: test_section_questions is a bare pivot
            // with no timestamp columns.
            $rows = [];
            foreach ($questions as $index => $question) {
                $rows[] = [
                    'test_section_id' => $section->id,
                    'question_id' => $question->id,
                    'sort_order' => $index,
                ];
            }

            // One insert, matching the batching already used when a session
            // pre-creates its answer rows.
            foreach (array_chunk($rows, 500) as $chunk) {
                TestSectionQuestion::insert($chunk);
            }

            return $test->fresh();
        });
    }

    /**
     * @return \Illuminate\Database\Eloquent\Builder
     */
    private function filtered(User $user, array $spec)
    {
        $query = $this->pool($user);

        if (!empty($spec['subject'])) {
            $query->where('questions.subject', $spec['subject']);
        }

        if (!empty($spec['topics'])) {
            $query->whereIn('questions.topic', (array) $spec['topics']);
        }

        if (!empty($spec['difficulty'])) {
            $query->where('questions.difficulty', strtolower($spec['difficulty']));
        }

        // Taxonomy narrowing — "UGC NET Paper 1 previous-year only" is the
        // request the whole classification exists to serve.
        $query->matchingFacets([
            'exam_code' => $spec['exam_code'] ?? null,
            'paper' => $spec['paper'] ?? null,
            'source' => $spec['source'] ?? null,
            'year' => $spec['year'] ?? null,
        ]);

        return $query;
    }

    private function title(array $spec): string
    {
        if (!empty($spec['title'])) {
            return mb_substr($spec['title'], 0, 255);
        }

        $parts = array_filter([
            !empty($spec['exam_code'])
                ? config("exams.registry.{$spec['exam_code']}.name", $spec['exam_code'])
                : null,
            $spec['paper'] ?? null,
            $spec['subject'] ?? null,
            !empty($spec['difficulty']) ? ucfirst($spec['difficulty']) : null,
        ]);

        $label = $parts === [] ? 'Mixed' : implode(' · ', $parts);

        return "{$label} Practice · {$spec['question_count']}Q";
    }
}
