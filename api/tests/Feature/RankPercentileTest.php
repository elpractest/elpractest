<?php

namespace Tests\Feature;

use App\Models\Enrollment;
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

class RankPercentileTest extends TestCase
{
    use RefreshDatabase;

    private Test $test;
    private array $students = [];
    private \App\Models\Course $course;
    private \App\Models\Batch $batchA;
    private \App\Models\Batch $batchB;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);

        $this->course = \App\Models\Course::create([
            'title' => 'SSC CGL Master Class',
            'description' => 'Course description',
            'exam_category' => 'SSC',
        ]);

        $this->batchA = \App\Models\Batch::create([
            'course_id' => $this->course->id,
            'name' => 'Batch A',
        ]);

        $this->batchB = \App\Models\Batch::create([
            'course_id' => $this->course->id,
            'name' => 'Batch B',
        ]);

        $creator = User::factory()->create();

        $this->test = Test::create([
            'title' => 'Math Sectional Test',
            'course_id' => $this->course->id,
            'total_marks' => 100.00,
            'type' => 'mock',
            'is_published' => true,
            'created_by' => $creator->id,
        ]);
    }

    public function test_distinct_scores_computes_correct_ranks_and_percentiles(): void
    {
        // 3 students in Batch A with distinct scores: 90, 80, 70
        $scores = [90.00, 80.00, 70.00];
        $expectedRanks = [1, 2, 3];
        $expectedPercentiles = [100.00, 50.00, 0.00];

        $sessions = [];
        foreach ($scores as $index => $score) {
            $student = User::factory()->create();
            $student->assignRole('student');
            Enrollment::create([
                'user_id' => $student->id,
                'course_id' => $this->course->id,
                'batch_id' => $this->batchA->id,
                'enrolled_at' => now(),
            ]);

            $session = TestSession::create([
                'user_id' => $student->id,
                'test_id' => $this->test->id,
                'started_at' => now(),
                'duration_seconds' => 120,
                'submitted_at' => now(),
            ]);

            TestAnalytic::create([
                'test_session_id' => $session->id,
                'total_score' => $score,
                'max_score' => 100.00,
                'correct_count' => (int)($score / 2),
                'incorrect_count' => 0,
                'unanswered_count' => 0,
                'accuracy_percentage' => 100.00,
                'total_time_seconds' => 120,
                'subject_breakdown' => [],
                'topic_breakdown' => [],
            ]);

            $sessions[$index] = $session;
        }

        // Fetch result endpoint for each and assert rank/percentile
        foreach ($sessions as $index => $session) {
            $response = $this->actingAs($session->user)
                ->getJson("/api/student/tests/sessions/{$session->id}/result");

            $response->assertStatus(200);
            
            $this->assertEquals($expectedRanks[$index], $response->json('rank'), "Index {$index} Rank mismatch");
            $this->assertEquals($expectedPercentiles[$index], (float)$response->json('percentile'), "Index {$index} Percentile mismatch");
        }
    }

    public function test_tied_scores_uses_standard_competition_ranking_and_correct_percentiles(): void
    {
        // 3 students: 90, 90, 70 in Batch A
        // expected rank: 1, 1, 3 (standard competition rank: skips 2)
        // expected percentile:
        // top scores 90.00: rank = 1. PERCENT_RANK() = 0. Inverted = 1. * 100 = 100%
        // score 70.00: rank = 3. PERCENT_RANK() = (3-1)/(3-1) = 1. Inverted = 0. * 100 = 0%
        $scores = [90.00, 90.00, 70.00];
        $expectedRanks = [1, 1, 3];
        $expectedPercentiles = [100.00, 100.00, 0.00];

        $sessions = [];
        foreach ($scores as $index => $score) {
            $student = User::factory()->create();
            $student->assignRole('student');
            Enrollment::create([
                'user_id' => $student->id,
                'course_id' => $this->course->id,
                'batch_id' => $this->batchA->id,
                'enrolled_at' => now(),
            ]);

            $session = TestSession::create([
                'user_id' => $student->id,
                'test_id' => $this->test->id,
                'started_at' => now(),
                'duration_seconds' => 120,
                'submitted_at' => now(),
            ]);

            TestAnalytic::create([
                'test_session_id' => $session->id,
                'total_score' => $score,
                'max_score' => 100.00,
                'correct_count' => 10,
                'incorrect_count' => 0,
                'unanswered_count' => 0,
                'accuracy_percentage' => 100.00,
                'total_time_seconds' => 120,
                'subject_breakdown' => [],
                'topic_breakdown' => [],
            ]);

            $sessions[$index] = $session;
        }

        foreach ($sessions as $index => $session) {
            $response = $this->actingAs($session->user)
                ->getJson("/api/student/tests/sessions/{$session->id}/result");

            $response->assertStatus(200);
            
            $this->assertEquals($expectedRanks[$index], $response->json('rank'), "Tied Rank index {$index}");
            $this->assertEquals($expectedPercentiles[$index], (float)$response->json('percentile'), "Tied Percentile index {$index}");
        }
    }

    public function test_single_student_lands_at_rank_1_percentile_100(): void
    {
        $student = User::factory()->create();
        $student->assignRole('student');
        Enrollment::create([
            'user_id' => $student->id,
            'course_id' => $this->course->id,
            'batch_id' => $this->batchA->id,
            'enrolled_at' => now(),
        ]);

        $session = TestSession::create([
            'user_id' => $student->id,
            'test_id' => $this->test->id,
            'started_at' => now(),
            'duration_seconds' => 120,
            'submitted_at' => now(),
        ]);

        TestAnalytic::create([
            'test_session_id' => $session->id,
            'total_score' => 85.00,
            'max_score' => 100.00,
            'correct_count' => 10,
            'incorrect_count' => 0,
            'unanswered_count' => 0,
            'accuracy_percentage' => 100.00,
            'total_time_seconds' => 120,
            'subject_breakdown' => [],
            'topic_breakdown' => [],
        ]);

        $response = $this->actingAs($student)
            ->getJson("/api/student/tests/sessions/{$session->id}/result");

        $response->assertStatus(200)
            ->assertJsonPath('rank', 1);
        $this->assertEquals(100.00, (float)$response->json('percentile'));
    }

    public function test_rankings_are_batch_scoped(): void
    {
        // Batch A student: score 50 (should be Rank 1 of Batch A)
        // Batch B student: score 90 (should be Rank 1 of Batch B)
        // Batch B student: score 95 (should be Rank 1 of Batch B, 90 becomes Rank 2)
        // Verify that Batch A student does not get mixed with Batch B scores (Rank 1 of Batch A, not Rank 3).

        // Batch A Student
        $studentA = User::factory()->create();
        $studentA->assignRole('student');
        Enrollment::create([
            'user_id' => $studentA->id,
            'course_id' => $this->course->id,
            'batch_id' => $this->batchA->id,
            'enrolled_at' => now(),
        ]);
        $sessionA = TestSession::create([
            'user_id' => $studentA->id,
            'test_id' => $this->test->id,
            'started_at' => now(),
            'duration_seconds' => 120,
            'submitted_at' => now(),
        ]);
        TestAnalytic::create(['test_session_id' => $sessionA->id, 'total_score' => 50.00, 'max_score' => 100.00, 'correct_count' => 5, 'incorrect_count' => 0, 'unanswered_count' => 0, 'accuracy_percentage' => 100.00, 'total_time_seconds' => 120, 'subject_breakdown' => [], 'topic_breakdown' => []]);

        // Batch B Student 1
        $studentB1 = User::factory()->create();
        $studentB1->assignRole('student');
        Enrollment::create([
            'user_id' => $studentB1->id,
            'course_id' => $this->course->id,
            'batch_id' => $this->batchB->id,
            'enrolled_at' => now(),
        ]);
        $sessionB1 = TestSession::create([
            'user_id' => $studentB1->id,
            'test_id' => $this->test->id,
            'started_at' => now(),
            'duration_seconds' => 120,
            'submitted_at' => now(),
        ]);
        TestAnalytic::create(['test_session_id' => $sessionB1->id, 'total_score' => 90.00, 'max_score' => 100.00, 'correct_count' => 9, 'incorrect_count' => 0, 'unanswered_count' => 0, 'accuracy_percentage' => 100.00, 'total_time_seconds' => 120, 'subject_breakdown' => [], 'topic_breakdown' => []]);

        // Batch B Student 2
        $studentB2 = User::factory()->create();
        $studentB2->assignRole('student');
        Enrollment::create([
            'user_id' => $studentB2->id,
            'course_id' => $this->course->id,
            'batch_id' => $this->batchB->id,
            'enrolled_at' => now(),
        ]);
        $sessionB2 = TestSession::create([
            'user_id' => $studentB2->id,
            'test_id' => $this->test->id,
            'started_at' => now(),
            'duration_seconds' => 120,
            'submitted_at' => now(),
        ]);
        TestAnalytic::create(['test_session_id' => $sessionB2->id, 'total_score' => 95.00, 'max_score' => 100.00, 'correct_count' => 10, 'incorrect_count' => 0, 'unanswered_count' => 0, 'accuracy_percentage' => 100.00, 'total_time_seconds' => 120, 'subject_breakdown' => [], 'topic_breakdown' => []]);

        // Assert Student A is Rank 1 in Batch A (though their score of 50 is lower than Batch B scores)
        $responseA = $this->actingAs($studentA)->getJson("/api/student/tests/sessions/{$sessionA->id}/result");
        $responseA->assertStatus(200)->assertJsonPath('rank', 1);
        $this->assertEquals(100.00, (float)$responseA->json('percentile'));

        // Assert Student B1 is Rank 2 in Batch B (score 90 is below Student B2's 95)
        $responseB1 = $this->actingAs($studentB1)->getJson("/api/student/tests/sessions/{$sessionB1->id}/result");
        $responseB1->assertStatus(200)->assertJsonPath('rank', 2);
        $this->assertEquals(0.00, (float)$responseB1->json('percentile'));
    }

    public function test_all_tied_scores_gives_rank_1_and_percentile_100(): void
    {
        // 3 students in Batch A with exact same score: 80, 80, 80
        // Standard competition ranking should give Rank 1 to all
        // Percent rank gives 0 for all (since they are all top/equal).
        // 1 - 0 = 1 * 100 = 100% percentile for all.
        $sessions = [];
        for ($i = 0; $i < 3; $i++) {
            $student = User::factory()->create();
            $student->assignRole('student');
            Enrollment::create([
                'user_id' => $student->id,
                'course_id' => $this->course->id,
                'batch_id' => $this->batchA->id,
                'enrolled_at' => now(),
            ]);

            $session = TestSession::create([
                'user_id' => $student->id,
                'test_id' => $this->test->id,
                'started_at' => now(),
                'duration_seconds' => 120,
                'submitted_at' => now(),
            ]);

            TestAnalytic::create([
                'test_session_id' => $session->id,
                'total_score' => 80.00,
                'max_score' => 100.00,
                'correct_count' => 8,
                'incorrect_count' => 0,
                'unanswered_count' => 0,
                'accuracy_percentage' => 100.00,
                'total_time_seconds' => 120,
                'subject_breakdown' => [],
                'topic_breakdown' => [],
            ]);

            $sessions[] = $session;
        }

        foreach ($sessions as $session) {
            $response = $this->actingAs($session->user)->getJson("/api/student/tests/sessions/{$session->id}/result");
            $response->assertStatus(200)->assertJsonPath('rank', 1);
            $this->assertEquals(100.00, (float)$response->json('percentile'));
        }
    }
}
