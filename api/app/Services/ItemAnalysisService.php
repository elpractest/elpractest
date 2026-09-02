<?php

namespace App\Services;

use App\Models\Question;
use App\Models\TestAnswer;
use Illuminate\Support\Facades\DB;

/**
 * Classical test theory item analysis over real attempt data.
 *
 * Answers the question a question bank cannot answer about itself: is this item
 * actually any good? Three measures, all derived from raw `test_answers` joined
 * to submitted sessions, never from anything an author asserted:
 *
 *   difficulty index (p)   share of candidates who got it right. Not "how hard
 *                          the author thinks it is" - the label on the row is a
 *                          guess, this is a measurement. Useful band 0.30-0.85.
 *
 *   discrimination (r_pb)  point-biserial correlation between getting THIS item
 *                          right and overall performance. A good item is one the
 *                          strong candidates get right and the weak ones do not.
 *                          NEGATIVE r_pb is the loud one: the strong candidates
 *                          did WORSE on it, which in practice means a wrong
 *                          answer key or an ambiguous stem.
 *
 *   distractor analysis    per option: how many chose it, and how able those
 *                          choosers were. A distractor that attracts the TOP
 *                          candidates is a defective option; one that attracts
 *                          nobody is dead weight taking up a slot.
 *
 * Ability is measured as the session PERCENTAGE, not raw marks, so items used
 * across tests with different maxima stay comparable.
 */
class ItemAnalysisService
{
    /**
     * Point-biserial correlation between a binary item outcome and total score.
     *
     *   r_pb = ((M1 - M0) / SD) * sqrt(p * q)
     *
     * @param  float[]  $correctScores  ability scores of candidates who got it right
     * @param  float[]  $wrongScores    ability scores of candidates who got it wrong
     */
    public static function pointBiserial(array $correctScores, array $wrongScores): ?float
    {
        $n1 = count($correctScores);
        $n0 = count($wrongScores);
        $n = $n1 + $n0;

        // Undefined when nobody attempted, or when EVERYONE answered the same
        // way: an item no one gets wrong (or right) separates nobody, so there
        // is no correlation to report and 0.0 would be a lie.
        if ($n === 0 || $n1 === 0 || $n0 === 0) {
            return null;
        }

        $all = array_merge($correctScores, $wrongScores);
        $sd = ScoreNormalizationService::stdDev($all);
        if ($sd == 0.0) {
            return null;
        }

        $p = $n1 / $n;
        $q = 1 - $p;
        $r = ((ScoreNormalizationService::mean($correctScores) - ScoreNormalizationService::mean($wrongScores)) / $sd)
            * sqrt($p * $q);

        return round(max(-1.0, min(1.0, $r)), 4);
    }

    /**
     * Full analysis for one question, or null when it has never been attempted.
     *
     * @return array<string, mixed>|null
     */
    public function analyse(int $questionId): ?array
    {
        $rows = $this->attemptRows([$questionId]);
        if ($rows->isEmpty()) {
            return null;
        }

        return $this->summarise($questionId, $rows);
    }

    /**
     * Recompute and cache difficulty + discrimination for every question that has
     * attempt data. Returns how many rows were written.
     */
    public function recomputeAll(?int $onlyQuestionId = null): int
    {
        $ids = $onlyQuestionId
            ? [$onlyQuestionId]
            : DB::table('test_answers as ta')
                ->join('test_sessions as ts', 'ta.test_session_id', '=', 'ts.id')
                ->whereNotNull('ts.submitted_at')
                ->distinct()
                ->pluck('ta.question_id')
                ->all();

        if ($ids === []) {
            return 0;
        }

        $written = 0;
        foreach (array_chunk($ids, 200) as $chunk) {
            $rows = $this->attemptRows($chunk)->groupBy('question_id');
            foreach ($rows as $questionId => $questionRows) {
                $summary = $this->summarise((int) $questionId, $questionRows);

                Question::where('id', $questionId)->update([
                    'difficulty_index' => $summary['difficulty_index'],
                    'discrimination_index' => $summary['discrimination_index'],
                    'stats_sample_size' => $summary['sample_size'],
                    'stats_computed_at' => now(),
                ]);
                $written++;
            }
        }

        return $written;
    }

    /**
     * One row per answered-or-skipped question in a SUBMITTED session, carrying
     * the candidate ability score for that session. Carries every type's answer
     * column plus the question's own type/key — `summarise()` stays raw-SQL for
     * bulk performance rather than hydrating TestAnswer/Question models, but
     * still needs to judge correctness per type, not just single_choice.
     */
    private function attemptRows(array $questionIds)
    {
        return DB::table('test_answers as ta')
            ->join('test_sessions as ts', 'ta.test_session_id', '=', 'ts.id')
            ->join('test_analytics as an', 'an.test_session_id', '=', 'ts.id')
            ->whereIn('ta.question_id', $questionIds)
            ->whereNotNull('ts.submitted_at')
            ->select(
                'ta.question_id',
                'ta.selected_option_id',
                'ta.selected_option_ids',
                'ta.numeric_response',
                'an.max_score',
                'an.total_score'
            )
            ->get();
    }

    /**
     * @param  \Illuminate\Support\Collection  $rows  attempt rows for ONE question
     * @return array<string, mixed>
     */
    private function summarise(int $questionId, $rows): array
    {
        $question = DB::table('questions')
            ->where('id', $questionId)
            ->first(['question_type', 'numeric_answer', 'numeric_tolerance']);
        $type = $question->question_type ?? Question::TYPE_SINGLE_CHOICE;

        // Correct option ids for this question, scoped to the question so a
        // foreign option id can never be counted as correct. Empty for numeric
        // (it has no question_options rows), which is the correct answer.
        $correctIds = DB::table('question_options')
            ->where('question_id', $questionId)
            ->where('is_correct', true)
            ->pluck('id')
            ->map(fn ($i) => (int) $i)
            ->all();

        $ability = function ($r): float {
            $max = (float) $r->max_score;
            return $max > 0 ? ((float) $r->total_score / $max) * 100 : 0.0;
        };

        $correctScores = [];
        $wrongScores = [];
        $skipped = 0;
        $optionCounts = [];
        $optionScores = [];

        foreach ($rows as $r) {
            // Distractor breakdown is only meaningful for choice-based types —
            // multi_select still selects real option ids, numeric selects none.
            $selectedForDistractors = $type === Question::TYPE_MULTI_SELECT
                ? array_map('intval', json_decode($r->selected_option_ids ?? '[]', true) ?: [])
                : ($r->selected_option_id === null ? [] : [(int) $r->selected_option_id]);

            $attempted = match ($type) {
                Question::TYPE_MULTI_SELECT => $selectedForDistractors !== [],
                Question::TYPE_NUMERIC => $r->numeric_response !== null,
                default => $r->selected_option_id !== null,
            };

            if (!$attempted) {
                $skipped++;
                // A skip is still evidence about the item: it counts as "not
                // correct" for difficulty, which is what a real scorecard does.
                $wrongScores[] = $ability($r);
                continue;
            }

            foreach ($selectedForDistractors as $optId) {
                $optionCounts[$optId] = ($optionCounts[$optId] ?? 0) + 1;
                $optionScores[$optId][] = $ability($r);
            }

            $correct = match ($type) {
                Question::TYPE_MULTI_SELECT => TestAnswer::multiSelectMatches($selectedForDistractors, $correctIds),
                Question::TYPE_NUMERIC => TestAnswer::numericMatches($r->numeric_response, $question->numeric_answer, $question->numeric_tolerance),
                default => in_array($selectedForDistractors[0] ?? null, $correctIds, true),
            };

            if ($correct) {
                $correctScores[] = $ability($r);
            } else {
                $wrongScores[] = $ability($r);
            }
        }

        $presented = count($correctScores) + count($wrongScores);
        $difficulty = $presented > 0 ? round(count($correctScores) / $presented, 4) : null;

        $options = DB::table('question_options')
            ->where('question_id', $questionId)
            ->orderBy('sort_order')
            ->get(['id', 'label', 'option_text', 'is_correct']);

        $distractors = $options->map(function ($o) use ($optionCounts, $optionScores, $presented) {
            $id = (int) $o->id;
            $chosen = $optionCounts[$id] ?? 0;
            $scores = $optionScores[$id] ?? [];

            return [
                'option_id' => $id,
                'label' => $o->label,
                'is_correct' => (bool) $o->is_correct,
                'chosen_count' => $chosen,
                'chosen_share' => $presented > 0 ? round($chosen / $presented, 4) : 0.0,
                'mean_ability' => $scores === [] ? null : round(ScoreNormalizationService::mean($scores), 2),
            ];
        })->all();

        return [
            'question_id' => $questionId,
            'sample_size' => $presented,
            'skipped_count' => $skipped,
            'difficulty_index' => $difficulty,
            'discrimination_index' => self::pointBiserial($correctScores, $wrongScores),
            'distractors' => $distractors,
            'flags' => $this->flags($presented, $difficulty, self::pointBiserial($correctScores, $wrongScores), $distractors),
        ];
    }

    /**
     * Human-actionable warnings. Deliberately conservative: below the minimum
     * sample nothing else is reported, because acting on six attempts is worse
     * than acting on nothing.
     */
    private function flags(int $sample, ?float $difficulty, ?float $discrimination, array $distractors): array
    {
        if ($sample < Question::MIN_STATS_SAMPLE) {
            return ['insufficient_data'];
        }

        $flags = [];
        if ($discrimination !== null && $discrimination < 0) {
            $flags[] = 'negative_discrimination';
        } elseif ($discrimination !== null && $discrimination < 0.15) {
            $flags[] = 'weak_discrimination';
        }
        if ($difficulty !== null && $difficulty > 0.95) {
            $flags[] = 'too_easy';
        }
        if ($difficulty !== null && $difficulty < 0.15) {
            $flags[] = 'too_hard';
        }

        foreach ($distractors as $d) {
            if (!$d['is_correct'] && $d['chosen_count'] === 0) {
                $flags[] = 'dead_distractor';
                break;
            }
        }

        return $flags;
    }
}
