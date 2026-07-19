<?php

namespace Tests\Feature;

use App\Models\User;
use App\Models\Course;
use App\Models\Batch;
use App\Models\Enrollment;
use App\Models\Test;
use App\Models\TestSession;
use App\Models\TestAnalytic;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminManagementTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $student;
    protected Course $course;
    protected Batch $batch;

    protected function setUp(): void
    {
        parent::setUp();

        // Seed roles & permissions
        $this->artisan('db:seed', ['--class' => 'RolesAndPermissionsSeeder']);

        // Create Admin user
        $this->admin = User::factory()->create([
            'email' => 'admin@test.com',
            'google2fa_enabled' => true,
            'google2fa_secret' => 'LUTWUXK6K5F5GDZ6',
        ]);
        $this->admin->assignRole('admin');

        // Create Student user
        $this->student = User::factory()->create([
            'email' => 'student@test.com',
        ]);
        $this->student->assignRole('student');

        // Create Course and Batch
        $this->course = Course::create([
            'title' => 'SSC Exam Prep',
            'slug' => 'ssc-exam-prep',
            'exam_category' => 'SSC',
        ]);

        $this->batch = Batch::create([
            'course_id' => $this->course->id,
            'name' => 'Morning Batch',
            'max_students' => 2,
            'is_active' => true,
        ]);
    }

    /**
     * Helper to authenticate as admin with 2FA session verification.
     */
    protected function actingAsAdmin(): self
    {
        $this->actingAs($this->admin);
        session(['2fa_verified' => true]);
        return $this;
    }

    /**
     * Test 2FA route guarding.
     */
    public function test_admin_routes_blocked_without_2fa_verification(): void
    {
        $this->actingAs($this->admin); // Logged in, but session 2fa_verified is not set (will be false/null)

        $response = $this->withHeaders(['Referer' => 'http://localhost:3000'])
            ->withSession(['2fa_verified' => false])
            ->getJson("/api/admin/courses/{$this->course->id}/batches");
        $response->assertStatus(403)
            ->assertJson([
                '2fa_required' => true,
                '2fa_setup_needed' => false,
            ]);
    }

    /**
     * Test student search endpoint.
     */
    public function test_user_search_retrieves_only_students(): void
    {
        $this->actingAsAdmin();

        // Search for 'student'
        $response = $this->getJson('/api/admin/users?search=student');
        $response->assertStatus(200)
            ->assertJsonCount(1)
            ->assertJsonFragment(['email' => 'student@test.com']);

        // Search for 'admin' (should be empty because admin is not a student)
        $response = $this->getJson('/api/admin/users?search=admin');
        $response->assertStatus(200)
            ->assertJsonCount(0);
    }

    /**
     * Test Batch CRUD.
     */
    public function test_batch_crud_operations(): void
    {
        $this->actingAsAdmin();

        // 1. Index batches
        $response = $this->getJson("/api/admin/courses/{$this->course->id}/batches");
        $response->assertStatus(200)
            ->assertJsonFragment(['name' => 'Morning Batch']);

        // 2. Store batch
        $response = $this->postJson("/api/admin/courses/{$this->course->id}/batches", [
            'name' => 'Evening Batch',
            'max_students' => 10,
        ]);
        $response->assertStatus(201)
            ->assertJsonFragment(['name' => 'Evening Batch']);
        $this->assertDatabaseHas('batches', ['name' => 'Evening Batch', 'is_active' => true]);

        $batchId = $response->json('batch.id');

        // 3. Update batch
        $response = $this->putJson("/api/admin/batches/{$batchId}", [
            'name' => 'Night Batch',
        ]);
        $response->assertStatus(200)
            ->assertJsonFragment(['name' => 'Night Batch']);
        $this->assertDatabaseHas('batches', ['id' => $batchId, 'name' => 'Night Batch']);

        // 4. Destroy (soft deactivation)
        $response = $this->deleteJson("/api/admin/batches/{$batchId}");
        $response->assertStatus(200);
        $this->assertDatabaseHas('batches', ['id' => $batchId, 'is_active' => false]); // Soft deactivated
    }

    /**
     * Test Enrollment listing and toggling with capacity verification.
     */
    public function test_enrollment_listing_and_toggling(): void
    {
        $this->actingAsAdmin();

        // Enroll student
        $enrollment = Enrollment::create([
            'user_id' => $this->student->id,
            'course_id' => $this->course->id,
            'batch_id' => $this->batch->id,
            'is_active' => true,
            'enrolled_at' => now(),
        ]);

        // 1. List enrollments
        $response = $this->getJson('/api/admin/enrollments');
        $response->assertStatus(200)
            ->assertJsonFragment(['user_id' => $this->student->id]);

        // 2. Toggle status (Deactivate)
        $response = $this->postJson("/api/admin/enrollments/{$enrollment->id}/toggle");
        $response->assertStatus(200);
        $this->assertFalse($enrollment->fresh()->is_active);

        // 3. Toggle status (Reactivate)
        $response = $this->postJson("/api/admin/enrollments/{$enrollment->id}/toggle");
        $response->assertStatus(200);
        $this->assertTrue($enrollment->fresh()->is_active);

        // 4. Verify batch capacity during reactivation
        // Enroll a second student
        $student2 = User::factory()->create();
        $student2->assignRole('student');
        Enrollment::create([
            'user_id' => $student2->id,
            'course_id' => $this->course->id,
            'batch_id' => $this->batch->id,
            'is_active' => true,
            'enrolled_at' => now(),
        ]);

        // Now batch has 2 active students (capacity is 2).
        // If we suspend student 1
        $enrollment->update(['is_active' => false]);

        // Trying to reactivate student 1 should fail because batch is now full with student 2 and some other means?
        // Wait, if enrollment 1 is inactive, active count is 1 (student 2).
        // Let's add student 3 to fill the capacity of 2.
        $student3 = User::factory()->create();
        $student3->assignRole('student');
        Enrollment::create([
            'user_id' => $student3->id,
            'course_id' => $this->course->id,
            'batch_id' => $this->batch->id,
            'is_active' => true,
            'enrolled_at' => now(),
        ]);

        // Active count is 2 (student 2, student 3).
        // Try to reactivate enrollment 1 (student 1). Should fail with 422.
        $response = $this->postJson("/api/admin/enrollments/{$enrollment->id}/toggle");
        $response->assertStatus(422)
            ->assertJsonFragment(['message' => 'The batch has reached its maximum capacity of 2 students.']);
    }

    /**
     * Test Results Dashboard and details.
     */
    public function test_results_listing_and_scorecard(): void
    {
        $this->actingAsAdmin();

        $test = Test::create([
            'title' => 'SSC Algebra Mock',
            'course_id' => $this->course->id,
            'batch_id' => $this->batch->id,
            'type' => 'mock',
            'duration_seconds' => 3600,
            'total_marks' => 10,
            'is_published' => true,
            'created_by' => $this->admin->id,
        ]);

        $session = TestSession::create([
            'user_id' => $this->student->id,
            'test_id' => $test->id,
            'started_at' => now()->subMinutes(10),
            'submitted_at' => now(),
            'duration_seconds' => 3600,
        ]);

        TestAnalytic::create([
            'test_session_id' => $session->id,
            'total_score' => 8.5,
            'max_score' => 10.0,
            'accuracy_percentage' => 85.0,
            'correct_count' => 8,
            'incorrect_count' => 2,
            'unanswered_count' => 0,
            'total_time_seconds' => 600,
            'subject_breakdown' => [],
            'topic_breakdown' => [],
        ]);

        // Make an enrollment active for cohort percentile calculations
        Enrollment::create([
            'user_id' => $this->student->id,
            'course_id' => $this->course->id,
            'batch_id' => $this->batch->id,
            'is_active' => true,
            'enrolled_at' => now(),
        ]);

        // 1. Index results
        $response = $this->getJson('/api/admin/results');
        $response->assertStatus(200)
            ->assertJsonFragment(['user_id' => $this->student->id, 'rank' => 1, 'percentile' => 100.00]);

        // 2. Show detailed result
        $response = $this->getJson("/api/admin/results/{$session->id}");
        $response->assertStatus(200)
            ->assertJsonFragment(['rank' => 1, 'percentile' => 100.00])
            ->assertJsonStructure([
                'analytic' => ['total_score', 'accuracy_percentage'],
                'answers',
                'rank',
                'percentile',
            ]);
    }
}
