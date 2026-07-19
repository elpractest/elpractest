<?php

namespace Tests\Feature;

use App\Jobs\ComputeTestAnalytics;
use App\Models\Question;
use App\Models\QuestionOption;
use App\Models\Test;
use App\Models\TestSection;
use App\Models\TestSectionQuestion;
use App\Models\TestSession;
use App\Models\TestAnswer;
use App\Models\TestAnalytic;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ComputeTestAnalyticsTest extends TestCase
{
    use RefreshDatabase;

    private User $student;
    private Test $test;
    private array $questions;

    protected function setUp(): void
    {
        parent::setUp();

        $this->student = User::factory()->create();

        // Create a test
        $this->test = Test::create([
            'title' => 'SSC CGL Mock Test',
            'type' => 'mock',
            'duration_seconds' => 3600,
            'total_marks' => 10.00,
            'is_published' => true,
            'created_by' => $this->student->id,
        ]);

        $section = TestSection::create([
            'test_id' => $this->test->id,
            'title' => 'Quantitative Aptitude',
            'sort_order' => 0,
        ]);

        // Create 5 questions with different subjects and topics
        $this->questions = [];
        $subjects = ['Math', 'Math', 'English', 'English', 'Reasoning'];
        $topics = ['Algebra', 'Geometry', 'Grammar', 'Vocabulary', 'Puzzles'];

        for ($i = 0; $i < 5; $i++) {
            $q = Question::create([
                'subject' => $subjects[$i],
                'topic' => $topics[$i],
                'difficulty' => 'medium',
                'question_text' => "Question Text {$i}",
                'marks' => 2.00,
                'negative_marks' => 0.25,
                'is_active' => true,
            ]);

            // Options: label 'a' is correct, label 'b' is incorrect
            QuestionOption::create([
                'question_id' => $q->id,
                'label' => 'a',
                'option_text' => 'Correct Option',
                'is_correct' => true,
                'sort_order' => 0,
            ]);

            QuestionOption::create([
                'question_id' => $q->id,
                'label' => 'b',
                'option_text' => 'Incorrect Option',
                'is_correct' => false,
                'sort_order' => 1,
            ]);

            TestSectionQuestion::create([
                'test_section_id' => $section->id,
                'question_id' => $q->id,
                'sort_order' => $i,
            ]);

            $this->questions[] = $q;
        }
    }

    public function test_all_correct_answers_scores_full_marks(): void
    {
        $session = TestSession::create([
            'user_id' => $this->student->id,
            'test_id' => $this->test->id,
            'started_at' => now(),
            'duration_seconds' => 3600,
        ]);

        // Pre-create answers all correct (option_id of option label 'a')
        foreach ($this->questions as $q) {
            $correctOption = $q->options()->where('is_correct', true)->first();
            TestAnswer::create([
                'test_session_id' => $session->id,
                'question_id' => $q->id,
                'selected_option_id' => $correctOption->id,
                'is_visited' => true,
                'time_spent_seconds' => 60,
            ]);
        }

        // Run job
        (new ComputeTestAnalytics($session))->handle();

        $analytics = TestAnalytic::where('test_session_id', $session->id)->first();

        $this->assertNotNull($analytics);
        $this->assertEquals(10.00, (float)$analytics->total_score);
        $this->assertEquals(10.00, (float)$analytics->max_score);
        $this->assertEquals(5, $analytics->correct_count);
        $this->assertEquals(0, $analytics->incorrect_count);
        $this->assertEquals(0, $analytics->unanswered_count);
        $this->assertEquals(100.00, (float)$analytics->accuracy_percentage);
        $this->assertEquals(300, $analytics->total_time_seconds);

        // Subject breakdown check
        $this->assertEquals(4.00, (float)$analytics->subject_breakdown['Math']['score']);
        $this->assertEquals(2, $analytics->subject_breakdown['Math']['correct']);
    }

    public function test_all_incorrect_answers_applies_fractional_negative_marks(): void
    {
        $session = TestSession::create([
            'user_id' => $this->student->id,
            'test_id' => $this->test->id,
            'started_at' => now(),
            'duration_seconds' => 3600,
        ]);

        // Pre-create answers all incorrect (option_id of label 'b')
        foreach ($this->questions as $q) {
            $incorrectOption = $q->options()->where('is_correct', false)->first();
            TestAnswer::create([
                'test_session_id' => $session->id,
                'question_id' => $q->id,
                'selected_option_id' => $incorrectOption->id,
                'is_visited' => true,
                'time_spent_seconds' => 30,
            ]);
        }

        (new ComputeTestAnalytics($session))->handle();

        $analytics = TestAnalytic::where('test_session_id', $session->id)->first();

        // 5 questions incorrect * 0.25 negative marks = -1.25 total score
        $this->assertEquals(-1.25, (float)$analytics->total_score);
        $this->assertEquals(0, $analytics->correct_count);
        $this->assertEquals(5, $analytics->incorrect_count);
        $this->assertEquals(0.00, (float)$analytics->accuracy_percentage);
    }

    public function test_all_unanswered_scores_zero_without_negative_marks(): void
    {
        $session = TestSession::create([
            'user_id' => $this->student->id,
            'test_id' => $this->test->id,
            'started_at' => now(),
            'duration_seconds' => 3600,
        ]);

        foreach ($this->questions as $q) {
            TestAnswer::create([
                'test_session_id' => $session->id,
                'question_id' => $q->id,
                'selected_option_id' => null,
                'is_visited' => false,
                'time_spent_seconds' => 0,
            ]);
        }

        (new ComputeTestAnalytics($session))->handle();

        $analytics = TestAnalytic::where('test_session_id', $session->id)->first();

        $this->assertEquals(0.00, (float)$analytics->total_score);
        $this->assertEquals(0, $analytics->correct_count);
        $this->assertEquals(0, $analytics->incorrect_count);
        $this->assertEquals(5, $analytics->unanswered_count);
        $this->assertEquals(0.00, (float)$analytics->accuracy_percentage);
    }

    public function test_mixed_results_computes_exact_score(): void
    {
        $session = TestSession::create([
            'user_id' => $this->student->id,
            'test_id' => $this->test->id,
            'started_at' => now(),
            'duration_seconds' => 3600,
        ]);

        // Q0: Correct (+2)
        // Q1: Incorrect (-0.25)
        // Q2: Unanswered (0)
        // Q3: Correct (+2)
        // Q4: Incorrect (-0.25)
        // Expected: 2 - 0.25 + 0 + 2 - 0.25 = 3.50
        // Accuracy: 2 correct / 4 attempted = 50.00%

        foreach ($this->questions as $index => $q) {
            $selectedOptionId = null;
            $isVisited = false;
            $timeSpent = 0;

            if ($index === 0 || $index === 3) {
                $selectedOptionId = $q->options()->where('is_correct', true)->first()->id;
                $isVisited = true;
                $timeSpent = 40;
            } elseif ($index === 1 || $index === 4) {
                $selectedOptionId = $q->options()->where('is_correct', false)->first()->id;
                $isVisited = true;
                $timeSpent = 20;
            }

            TestAnswer::create([
                'test_session_id' => $session->id,
                'question_id' => $q->id,
                'selected_option_id' => $selectedOptionId,
                'is_visited' => $isVisited,
                'time_spent_seconds' => $timeSpent,
            ]);
        }

        (new ComputeTestAnalytics($session))->handle();

        $analytics = TestAnalytic::where('test_session_id', $session->id)->first();

        $this->assertEquals(3.50, (float)$analytics->total_score);
        $this->assertEquals(2, $analytics->correct_count);
        $this->assertEquals(2, $analytics->incorrect_count);
        $this->assertEquals(1, $analytics->unanswered_count);
        $this->assertEquals(50.00, (float)$analytics->accuracy_percentage);
        $this->assertEquals(120, $analytics->total_time_seconds);
    }

    public function test_job_is_idempotent_multiple_runs_do_not_duplicate_analytics_row(): void
    {
        $session = TestSession::create([
            'user_id' => $this->student->id,
            'test_id' => $this->test->id,
            'started_at' => now(),
            'duration_seconds' => 3600,
        ]);

        foreach ($this->questions as $q) {
            $correctOption = $q->options()->where('is_correct', true)->first();
            TestAnswer::create([
                'test_session_id' => $session->id,
                'question_id' => $q->id,
                'selected_option_id' => $correctOption->id,
                'is_visited' => true,
                'time_spent_seconds' => 60,
            ]);
        }

        // Run 1
        (new ComputeTestAnalytics($session))->handle();
        $this->assertEquals(1, TestAnalytic::where('test_session_id', $session->id)->count());
        $firstId = TestAnalytic::where('test_session_id', $session->id)->first()->id;

        // Run 2
        (new ComputeTestAnalytics($session))->handle();
        $this->assertEquals(1, TestAnalytic::where('test_session_id', $session->id)->count());
        $secondId = TestAnalytic::where('test_session_id', $session->id)->first()->id;

        $this->assertEquals($firstId, $secondId, "Idempotency failed: analytics row ID changed or duplicated.");
    }

    public function test_job_handles_various_fractional_negative_marking_values(): void
    {
        // Set up test with custom fractional negative marking values (0.33 and 0.50)
        $customTest = Test::create([
            'title' => 'Custom Marks Test',
            'type' => 'mock',
            'duration_seconds' => 3600,
            'total_marks' => 4.00,
            'is_published' => true,
            'created_by' => $this->student->id,
        ]);

        $section = TestSection::create([
            'test_id' => $customTest->id,
            'title' => 'Mixed Marks Section',
            'sort_order' => 0,
        ]);

        // Q1: Marks = 2.00, Neg = 0.33 (Wrong) -> -0.33
        // Q2: Marks = 2.00, Neg = 0.50 (Wrong) -> -0.50
        // Expected total score = -0.83
        $q1 = Question::create([
            'subject' => 'Math',
            'topic' => 'Algebra',
            'difficulty' => 'hard',
            'question_text' => 'Question 1',
            'marks' => 2.00,
            'negative_marks' => 0.33,
            'is_active' => true,
        ]);
        QuestionOption::create(['question_id' => $q1->id, 'label' => 'a', 'option_text' => 'Correct', 'is_correct' => true]);
        QuestionOption::create(['question_id' => $q1->id, 'label' => 'b', 'option_text' => 'Incorrect', 'is_correct' => false]);
        TestSectionQuestion::create(['test_section_id' => $section->id, 'question_id' => $q1->id, 'sort_order' => 0]);

        $q2 = Question::create([
            'subject' => 'Math',
            'topic' => 'Geometry',
            'difficulty' => 'hard',
            'question_text' => 'Question 2',
            'marks' => 2.00,
            'negative_marks' => 0.50,
            'is_active' => true,
        ]);
        QuestionOption::create(['question_id' => $q2->id, 'label' => 'a', 'option_text' => 'Correct', 'is_correct' => true]);
        QuestionOption::create(['question_id' => $q2->id, 'label' => 'b', 'option_text' => 'Incorrect', 'is_correct' => false]);
        TestSectionQuestion::create(['test_section_id' => $section->id, 'question_id' => $q2->id, 'sort_order' => 1]);

        $session = TestSession::create([
            'user_id' => $this->student->id,
            'test_id' => $customTest->id,
            'started_at' => now(),
            'duration_seconds' => 3600,
        ]);

        // Wrong option for Q1
        TestAnswer::create([
            'test_session_id' => $session->id,
            'question_id' => $q1->id,
            'selected_option_id' => $q1->options()->where('is_correct', false)->first()->id,
            'is_visited' => true,
        ]);

        // Wrong option for Q2
        TestAnswer::create([
            'test_session_id' => $session->id,
            'question_id' => $q2->id,
            'selected_option_id' => $q2->options()->where('is_correct', false)->first()->id,
            'is_visited' => true,
        ]);

        (new ComputeTestAnalytics($session))->handle();

        $analytics = TestAnalytic::where('test_session_id', $session->id)->first();

        $this->assertEquals(-0.83, (float)$analytics->total_score);
    }
}
