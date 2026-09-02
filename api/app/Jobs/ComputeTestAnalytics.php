<?php

namespace App\Jobs;

use App\Models\TestAnalytic;
use App\Models\TestAnswer;
use App\Models\TestSession;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

/**
 * Server-authoritative scoring, recomputed from raw `test_answers` only.
 *
 * Marking rules, matching Indian govt CBT convention:
 *   - correct     -> +question.marks
 *   - wrong       -> -question.negative_marks (decimal: 0.25 and 0.33 are exact)
 *   - unattempted -> 0, NEVER a penalty
 *
 * On top of the raw total it produces the three things a govt-exam scorecard
 * needs and a plain total cannot express:
 *   - section_breakdown: per-section score / max / cut-off / cleared
 *   - merit_score:       total EXCLUDING qualifying-only sections (UPSC CSAT model)
 *   - is_qualified:      cleared EVERY sectional bar AND the overall bar
 *
 * Idempotent: it recomputes from scratch and upserts one analytics row, so
 * re-running it after an answer-key correction yields the corrected score.
 */
class ComputeTestAnalytics implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        private readonly TestSession $session
    ) {}

    public function handle(): void
    {
        $session = $this->session;

        $answers = TestAnswer::where('test_session_id', $session->id)
            ->with(['question.options'])
            ->get();

        // question_id -> section id, so every answer can be attributed to a section.
        $sections = $session->test->sections()->with('questions:id')->get();
        $sectionOf = [];
        foreach ($sections as $section) {
            foreach ($section->questions as $q) {
                $sectionOf[$q->id] = $section->id;
            }
        }

        $totalScore = 0.00;
        $maxScore = 0.00;
        $correctCount = 0;
        $incorrectCount = 0;
        $unansweredCount = 0;
        $totalTimeSeconds = 0;

        $subjectBreakdown = [];
        $topicBreakdown = [];
        $sectionTotals = [];

        $blank = [
            'correct' => 0, 'incorrect' => 0, 'unanswered' => 0,
            'score' => 0.00, 'max_score' => 0.00, 'time_spent' => 0,
        ];

        foreach ($answers as $answer) {
            $question = $answer->question;
            if (!$question) {
                continue;
            }

            $marks = (float) $question->marks;
            $negMarks = (float) $question->negative_marks;
            $timeSpent = (int) $answer->time_spent_seconds;

            $maxScore += $marks;
            $totalTimeSeconds += $timeSpent;

            $subject = $question->subject;
            $topic = $question->topic;
            $sectionId = $sectionOf[$question->id] ?? null;

            if (!isset($subjectBreakdown[$subject])) {
                $subjectBreakdown[$subject] = $blank;
            }
            if (!isset($topicBreakdown[$topic])) {
                $topicBreakdown[$topic] = $blank;
            }
            if ($sectionId !== null && !isset($sectionTotals[$sectionId])) {
                $sectionTotals[$sectionId] = $blank;
            }

            $subjectBreakdown[$subject]['max_score'] += $marks;
            $subjectBreakdown[$subject]['time_spent'] += $timeSpent;
            $topicBreakdown[$topic]['max_score'] += $marks;
            $topicBreakdown[$topic]['time_spent'] += $timeSpent;
            if ($sectionId !== null) {
                $sectionTotals[$sectionId]['max_score'] += $marks;
                $sectionTotals[$sectionId]['time_spent'] += $timeSpent;
            }

            if (!$answer->isAttempted()) {
                // Unattempted never attracts a penalty. This is the rule every
                // Indian govt exam shares, and the reason skipping is a strategy.
                $unansweredCount++;
                $subjectBreakdown[$subject]['unanswered']++;
                $topicBreakdown[$topic]['unanswered']++;
                if ($sectionId !== null) {
                    $sectionTotals[$sectionId]['unanswered']++;
                }
                continue;
            }

            if ($answer->isCorrect()) {
                $correctCount++;
                $totalScore += $marks;
                $subjectBreakdown[$subject]['correct']++;
                $subjectBreakdown[$subject]['score'] += $marks;
                $topicBreakdown[$topic]['correct']++;
                $topicBreakdown[$topic]['score'] += $marks;
                if ($sectionId !== null) {
                    $sectionTotals[$sectionId]['correct']++;
                    $sectionTotals[$sectionId]['score'] += $marks;
                }
            } else {
                $incorrectCount++;
                $totalScore -= $negMarks;
                $subjectBreakdown[$subject]['incorrect']++;
                $subjectBreakdown[$subject]['score'] -= $negMarks;
                $topicBreakdown[$topic]['incorrect']++;
                $topicBreakdown[$topic]['score'] -= $negMarks;
                if ($sectionId !== null) {
                    $sectionTotals[$sectionId]['incorrect']++;
                    $sectionTotals[$sectionId]['score'] -= $negMarks;
                }
            }
        }

        [$sectionBreakdown, $meritScore, $allSectionsCleared] =
            $this->resolveSections($sections, $sectionTotals);

        // The overall bar is applied to the MERIT score, so a qualifying paper
        // cannot lift a candidate over a line it is not meant to count toward.
        $overallCutoff = $session->test->overallCutoffMarks();
        $overallCleared = $overallCutoff === null || round($meritScore, 2) >= $overallCutoff;

        $hasAnyCutoff = $overallCutoff !== null
            || $sections->contains(fn ($s) => $s->cutoff_marks !== null || $s->cutoff_percentage !== null);

        $attempted = $correctCount + $incorrectCount;
        $accuracyPercentage = $attempted > 0
            ? round(($correctCount / $attempted) * 100, 2)
            : 0.00;

        TestAnalytic::updateOrCreate(
            ['test_session_id' => $session->id],
            [
                'total_score' => round($totalScore, 2),
                'max_score' => round($maxScore, 2),
                'merit_score' => round($meritScore, 2),
                'correct_count' => $correctCount,
                'incorrect_count' => $incorrectCount,
                'unanswered_count' => $unansweredCount,
                'accuracy_percentage' => $accuracyPercentage,
                'total_time_seconds' => $totalTimeSeconds,
                'subject_breakdown' => $subjectBreakdown,
                'topic_breakdown' => $topicBreakdown,
                'section_breakdown' => $sectionBreakdown,
                // Null when the paper defines no bar at all, so the UI can tell
                // "no cut-off on this test" apart from "missed the cut-off".
                'is_qualified' => $hasAnyCutoff ? ($allSectionsCleared && $overallCleared) : null,
            ]
        );

        $session->loadMissing(['user', 'test']);
        if ($session->user && $session->test) {
            $session->user->notify(new \App\Notifications\ResultReady(
                $session->id,
                $session->test->title,
                round($totalScore, 2),
                round($maxScore, 2),
            ));
        }
    }

    /**
     * Turn raw per-section totals into the scorecard shape, and derive the merit
     * score (qualifying sections excluded) plus whether every bar was cleared.
     *
     * @return array{0: array<int, array<string, mixed>>, 1: float, 2: bool}
     */
    private function resolveSections($sections, array $sectionTotals): array
    {
        $breakdown = [];
        $merit = 0.00;
        $allCleared = true;

        foreach ($sections as $section) {
            $t = $sectionTotals[$section->id] ?? [
                'correct' => 0, 'incorrect' => 0, 'unanswered' => 0,
                'score' => 0.00, 'max_score' => 0.00, 'time_spent' => 0,
            ];

            $score = round((float) $t['score'], 2);
            $max = round((float) $t['max_score'], 2);
            $cutoff = $section->cutoffMarksFor($max);
            $cleared = $cutoff === null || $score >= $cutoff;

            if (!$cleared) {
                $allCleared = false;
            }
            if (!$section->is_qualifying) {
                $merit += $score;
            }

            $breakdown[] = [
                'section_id' => $section->id,
                'title' => $section->title,
                'sort_order' => $section->sort_order,
                'is_qualifying' => (bool) $section->is_qualifying,
                'score' => $score,
                'max_score' => $max,
                'cutoff_marks' => $cutoff,
                'cleared' => $cleared,
                'correct' => $t['correct'],
                'incorrect' => $t['incorrect'],
                'unanswered' => $t['unanswered'],
                'time_spent' => $t['time_spent'],
            ];
        }

        return [$breakdown, $merit, $allCleared];
    }
}
