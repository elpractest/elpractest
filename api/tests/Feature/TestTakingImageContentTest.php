<?php

namespace Tests\Feature;

use App\Models\Batch;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Passage;
use App\Models\Question;
use App\Models\QuestionOption;
use App\Models\Test;
use App\Models\TestSection;
use App\Models\TestSectionQuestion;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * A question's diagram, an image-only option, and a passage's shared chart
 * or Data Interpretation table all have to actually reach the student — the
 * three places TestTakingController hands a paper to a candidate (starting
 * it, resuming it, and reviewing it after submission) each build their own
 * response array by hand, so each one needed its own field added and can
 * silently drift from the others. These pin that they did not.
 */
class TestTakingImageContentTest extends TestCase
{
    use RefreshDatabase;

    private User $student;
    private Course $course;
    private Batch $batch;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);

        $this->student = User::factory()->create();
        $this->student->assignRole('student');

        $this->course = Course::create(['title' => 'SSC CGL', 'description' => 'd', 'exam_category' => 'SSC']);
        $this->batch = Batch::create(['course_id' => $this->course->id, 'name' => 'Batch A']);

        Enrollment::create([
            'user_id' => $this->student->id,
            'course_id' => $this->course->id,
            'batch_id' => $this->batch->id,
            'enrolled_at' => now(),
            'is_active' => true,
        ]);
    }

    private function makeTestWithImageContent(): Test
    {
        $admin = User::factory()->create();

        $passage = Passage::create([
            'title' => 'Company sales',
            'body' => 'Study the table below.',
            'image_path' => 'passage_images/chart.png',
            'table_data' => ['headers' => ['Co', '2024'], 'rows' => [['A', '150']]],
            'created_by' => $admin->id,
        ]);

        $test = Test::create([
            'title' => 'Mock', 'type' => 'mock', 'course_id' => $this->course->id,
            'duration_seconds' => 3600, 'total_marks' => 4, 'is_published' => true,
            'created_by' => $admin->id,
        ]);
        $section = TestSection::create(['test_id' => $test->id, 'title' => 'Section 1', 'sort_order' => 0]);

        $diQuestion = Question::create([
            'subject' => 'Quant', 'topic' => 'DI', 'difficulty' => 'medium',
            'question_text' => "Company A's growth?", 'marks' => 2, 'negative_marks' => 0.5,
            'is_active' => true, 'created_by' => $admin->id, 'status' => Question::STATUS_APPROVED,
            'passage_id' => $passage->id,
        ]);
        QuestionOption::create(['question_id' => $diQuestion->id, 'label' => 'a', 'option_text' => '25%', 'is_correct' => true, 'sort_order' => 0]);
        QuestionOption::create(['question_id' => $diQuestion->id, 'label' => 'b', 'option_text' => '30%', 'is_correct' => false, 'sort_order' => 1]);

        $figureQuestion = Question::create([
            'subject' => 'Reasoning', 'topic' => 'Series', 'difficulty' => 'medium',
            'question_text' => 'Which figure completes the series?', 'image_path' => 'question_images/series.png',
            'marks' => 2, 'negative_marks' => 0.5, 'is_active' => true,
            'created_by' => $admin->id, 'status' => Question::STATUS_APPROVED,
        ]);
        QuestionOption::create(['question_id' => $figureQuestion->id, 'label' => 'a', 'option_text' => '', 'image_path' => 'option_images/a.png', 'is_correct' => true, 'sort_order' => 0]);
        QuestionOption::create(['question_id' => $figureQuestion->id, 'label' => 'b', 'option_text' => '', 'image_path' => 'option_images/b.png', 'is_correct' => false, 'sort_order' => 1]);

        TestSectionQuestion::create(['test_section_id' => $section->id, 'question_id' => $diQuestion->id, 'sort_order' => 0]);
        TestSectionQuestion::create(['test_section_id' => $section->id, 'question_id' => $figureQuestion->id, 'sort_order' => 1]);

        return $test;
    }

    public function test_starting_a_test_sends_the_passage_table_and_image_and_option_images(): void
    {
        $test = $this->makeTestWithImageContent();

        $response = $this->actingAs($this->student)
            ->postJson("/api/student/tests/{$test->id}/start")
            ->assertOk();

        $questions = collect($response->json('sections.0.questions'));

        $diQuestion = $questions->firstWhere('subject', 'Quant');
        $this->assertNotNull($diQuestion['passage']);
        $this->assertNotNull($diQuestion['passage']['image_url']);
        $this->assertSame(['headers' => ['Co', '2024'], 'rows' => [['A', '150']]], $diQuestion['passage']['table']);

        $figureQuestion = $questions->firstWhere('subject', 'Reasoning');
        $this->assertNotNull($figureQuestion['image_url']);
        $optionA = collect($figureQuestion['options'])->firstWhere('label', 'a');
        $this->assertNotNull($optionA['image_url']);
        // is_correct must never reach the student mid-attempt regardless of
        // how many fields this payload grows to carry.
        $this->assertArrayNotHasKey('is_correct', $optionA);
    }

    public function test_the_post_submission_review_also_carries_the_image_content(): void
    {
        $test = $this->makeTestWithImageContent();

        $start = $this->actingAs($this->student)->postJson("/api/student/tests/{$test->id}/start")->assertOk();
        $sessionId = $start->json('session.id');

        $this->actingAs($this->student)->postJson("/api/student/tests/sessions/{$sessionId}/submit")->assertOk();

        $result = $this->actingAs($this->student)
            ->getJson("/api/student/tests/sessions/{$sessionId}/result")
            ->assertOk();

        $answers = collect($result->json('answers'));
        $withPassage = $answers->first(fn ($a) => $a['passage'] !== null);
        $this->assertNotNull($withPassage);
        $this->assertNotNull($withPassage['passage']['image_url']);
        $this->assertNotNull($withPassage['passage']['table']);

        $withImage = $answers->first(fn ($a) => $a['image_url'] !== null);
        $this->assertNotNull($withImage);
    }
}
