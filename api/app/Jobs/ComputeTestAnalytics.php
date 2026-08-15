<?php

namespace App\Jobs;

use App\Models\TestAnswer;
use App\Models\TestAnalytic;
use App\Models\TestSession;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ComputeTestAnalytics implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        private readonly TestSession $session
    ) {}

    public function handle(): void
    {
        $session = $this->session;

        // Load all answers with questions and options
        $answers = TestAnswer::where('test_session_id', $session->id)
            ->with(['question.options'])
            ->get();

        $totalScore = 0.00;
        $maxScore = 0.00;
        $correctCount = 0;
        $incorrectCount = 0;
        $unansweredCount = 0;
        $totalTimeSeconds = 0;

        $subjectBreakdown = [];
        $topicBreakdown = [];

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

            // Initialize subject breakdown if not exists
            if (!isset($subjectBreakdown[$subject])) {
                $subjectBreakdown[$subject] = [
                    'correct' => 0,
                    'incorrect' => 0,
                    'unanswered' => 0,
                    'score' => 0.00,
                    'max_score' => 0.00,
                    'time_spent' => 0,
                ];
            }
            $subjectBreakdown[$subject]['max_score'] += $marks;
            $subjectBreakdown[$subject]['time_spent'] += $timeSpent;

            // Initialize topic breakdown if not exists
            if (!isset($topicBreakdown[$topic])) {
                $topicBreakdown[$topic] = [
                    'correct' => 0,
                    'incorrect' => 0,
                    'unanswered' => 0,
                    'score' => 0.00,
                    'max_score' => 0.00,
                    'time_spent' => 0,
                ];
            }
            $topicBreakdown[$topic]['max_score'] += $marks;
            $topicBreakdown[$topic]['time_spent'] += $timeSpent;

            if (!$answer->isAttempted()) {
                $unansweredCount++;
                $subjectBreakdown[$subject]['unanswered']++;
                $topicBreakdown[$topic]['unanswered']++;
            } else {
                if ($answer->isCorrect()) {
                    $correctCount++;
                    $totalScore += $marks;
                    
                    $subjectBreakdown[$subject]['correct']++;
                    $subjectBreakdown[$subject]['score'] += $marks;

                    $topicBreakdown[$topic]['correct']++;
                    $topicBreakdown[$topic]['score'] += $marks;
                } else {
                    $incorrectCount++;
                    $totalScore -= $negMarks;

                    $subjectBreakdown[$subject]['incorrect']++;
                    $subjectBreakdown[$subject]['score'] -= $negMarks;

                    $topicBreakdown[$topic]['incorrect']++;
                    $topicBreakdown[$topic]['score'] -= $negMarks;
                }
            }
        }

        // Calculate accuracy
        $attempted = $correctCount + $incorrectCount;
        $accuracyPercentage = $attempted > 0 
            ? round(($correctCount / $attempted) * 100, 2) 
            : 0.00;

        // Upsert the analytic record
        TestAnalytic::updateOrCreate(
            ['test_session_id' => $session->id],
            [
                'total_score' => round($totalScore, 2),
                'max_score' => round($maxScore, 2),
                'correct_count' => $correctCount,
                'incorrect_count' => $incorrectCount,
                'unanswered_count' => $unansweredCount,
                'accuracy_percentage' => $accuracyPercentage,
                'total_time_seconds' => $totalTimeSeconds,
                'subject_breakdown' => $subjectBreakdown,
                'topic_breakdown' => $topicBreakdown,
            ]
        );

        // The result now exists — notify the student (in-app feed + push).
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
}
