<?php

namespace Tests\Feature;

use App\Models\Assignment;
use App\Models\Batch;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Test;
use App\Models\TestSeries;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StudentTestSeriesApiTest extends TestCase
{
    use RefreshDatabase;

    protected User $student;
    protected User $admin;
    protected Batch $batch;
    protected TestSeries $series;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);

        $this->admin = User::factory()->create(['email_verified_at' => now()]);
        $this->admin->assignRole('admin');

        $this->student = User::factory()->create(['email_verified_at' => now()]);
        $this->student->assignRole('student');

        $course = Course::create([
            'title' => 'SSC CGL Master Course',
            'slug' => 'ssc-cgl-master-student',
            'exam_category' => 'SSC',
            'description' => 'Test course',
            'created_by' => $this->admin->id,
        ]);

        $this->batch = Batch::create([
            'course_id' => $course->id,
            'name' => 'Batch 2026 Student',
            'starts_at' => now(),
            'ends_at' => now()->addYear(),
        ]);

        Enrollment::create([
            'user_id' => $this->student->id,
            'course_id' => $course->id,
            'batch_id' => $this->batch->id,
            'enrolled_at' => now(),
            'is_active' => true,
        ]);

        $this->series = TestSeries::create([
            'title' => 'SSC CGL Tier I Target Series',
            'slug' => 'ssc-cgl-tier-1-target',
            'exam_category' => 'SSC',
            'is_published' => true,
            'created_by' => $this->admin->id,
        ]);

        Test::create([
            'title' => 'Full Mock 01',
            'type' => 'mock',
            'duration_seconds' => 3600,
            'max_attempts' => 1,
            'total_marks' => 200,
            'test_series_id' => $this->series->id,
            'series_sort_order' => 1,
            'category' => 'full_mock',
            'is_free' => true,
            'is_published' => true,
            'created_by' => $this->admin->id,
        ]);

        Assignment::create([
            'batch_id' => $this->batch->id,
            'assignable_type' => TestSeries::class,
            'assignable_id' => $this->series->id,
            'assigned_by' => $this->admin->id,
            'is_active' => true,
        ]);
    }

    public function test_student_can_fetch_assigned_test_series(): void
    {
        $response = $this->actingAs($this->student)->getJson('/api/student/test-series');

        $response->assertStatus(200);
        $response->assertJsonCount(1);
        $response->assertJsonPath('0.id', $this->series->id);
        $response->assertJsonPath('0.title', 'SSC CGL Tier I Target Series');
    }

    public function test_student_can_view_study_path_detail(): void
    {
        $response = $this->actingAs($this->student)->getJson("/api/student/test-series/{$this->series->id}");

        $response->assertStatus(200);
        $response->assertJsonPath('id', $this->series->id);
        $response->assertJsonPath('total_tests', 1);
        $response->assertJsonPath('tests.0.category', 'full_mock');
        $response->assertJsonPath('tests.0.status', 'not_started');
        $this->assertNotNull($response->json('next_test_id'));
        // Not started yet, so there is no attempt to link to.
        $this->assertNull($response->json('tests.0.session_id'));
    }

    /**
     * Regression: the "Analysis" link on a completed test in the study path
     * had nowhere real to go — it navigated to a route keyed by SESSION id,
     * but this payload only ever carried the TEST id. `session_id` is the
     * completed attempt's own id, which is what a results page actually needs.
     */
    public function test_a_completed_test_reports_its_own_session_id(): void
    {
        $test = Test::where('test_series_id', $this->series->id)->first();

        $session = \App\Models\TestSession::create([
            'user_id' => $this->student->id,
            'test_id' => $test->id,
            'started_at' => now()->subMinutes(30),
            'submitted_at' => now(),
            'duration_seconds' => $test->duration_seconds,
            'total_score' => 120,
        ]);

        $response = $this->actingAs($this->student)->getJson("/api/student/test-series/{$this->series->id}");

        $response->assertStatus(200);
        $response->assertJsonPath('tests.0.status', 'completed');
        $response->assertJsonPath('tests.0.session_id', $session->id);
    }
}
