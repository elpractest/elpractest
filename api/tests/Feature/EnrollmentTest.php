<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Batch;
use App\Models\User;
use App\Models\Enrollment;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class EnrollmentTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $student;
    private Course $course;
    private Course $course2;
    private Batch $batch;
    private Batch $batch2;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);

        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');
        $this->admin->update([
            'google2fa_enabled' => true,
            'google2fa_secret' => 'B39XKJ2938JJD982',
        ]);

        $this->student = User::factory()->create();
        $this->student->assignRole('student');

        $this->course = Course::create([
            'title' => 'Math Special',
            'slug' => 'math-special',
            'description' => 'Algebra & Geometry',
            'mode' => 'recorded',
            'exam_category' => 'SSC',
        ]);

        $this->course2 = Course::create([
            'title' => 'English Special',
            'slug' => 'english-special',
            'description' => 'Grammar',
            'mode' => 'recorded',
            'exam_category' => 'SSC',
        ]);

        $this->batch = Batch::create([
            'course_id' => $this->course->id,
            'name' => 'Batch Alpha',
            'max_students' => 2, // small limit to test max_students
        ]);

        $this->batch2 = Batch::create([
            'course_id' => $this->course2->id,
            'name' => 'Batch Beta',
        ]);
    }

    public function test_admin_can_manually_enroll_student_and_suspends_it(): void
    {
        // 1. Manual enrollment
        $response = $this->actingAs($this->admin)
            ->postJson('/api/admin/enrollments', [
                'user_id' => $this->student->id,
                'course_id' => $this->course->id,
                'batch_id' => $this->batch->id,
            ]);

        $response->assertStatus(200);
        $enrollment = Enrollment::first();
        $this->assertNotNull($enrollment);
        $this->assertTrue($enrollment->is_active);

        // Student can now view myCourses
        $myCoursesRes = $this->actingAs($this->student)->getJson('/api/student/courses');
        $myCoursesRes->assertStatus(200)->assertJsonCount(1);

        // 2. Suspend/deactivate enrollment
        $suspendRes = $this->actingAs($this->admin)
            ->deleteJson("/api/admin/enrollments/{$enrollment->id}");

        $suspendRes->assertStatus(200);
        
        $enrollment->refresh();
        $this->assertFalse($enrollment->is_active);

        // Student can no longer view the course
        $myCoursesRes2 = $this->actingAs($this->student)->getJson('/api/student/courses');
        $myCoursesRes2->assertStatus(200)->assertJsonCount(0);
    }

    public function test_batch_correlation_validation_on_enrollment(): void
    {
        // Try enrolling with a batch that does NOT belong to the course (batch2 belongs to course2)
        $response = $this->actingAs($this->admin)
            ->postJson('/api/admin/enrollments', [
                'user_id' => $this->student->id,
                'course_id' => $this->course->id,
                'batch_id' => $this->batch2->id, // mismatch!
            ]);

        $response->assertStatus(422)
            ->assertJsonValidationErrors('batch_id');
    }

    public function test_max_students_cap_prevents_manual_enrollment(): void
    {
        // Fill batch capacity (max_students = 2)
        Enrollment::create(['user_id' => User::factory()->create()->id, 'course_id' => $this->course->id, 'batch_id' => $this->batch->id, 'is_active' => true, 'enrolled_at' => now()]);
        Enrollment::create(['user_id' => User::factory()->create()->id, 'course_id' => $this->course->id, 'batch_id' => $this->batch->id, 'is_active' => true, 'enrolled_at' => now()]);

        // Attempting to enroll 3rd student manually should fail
        $response = $this->actingAs($this->admin)
            ->postJson('/api/admin/enrollments', [
                'user_id' => $this->student->id,
                'course_id' => $this->course->id,
                'batch_id' => $this->batch->id,
            ]);

        $response->assertStatus(422)
            ->assertJsonPath('message', 'The batch has reached its maximum capacity of 2 students.');
    }

    public function test_enrollment_with_expires_at_is_gated_correctly(): void
    {
        // Enroll with expiration time set to 2 hours from now
        $expiresAt = now()->addHours(2);
        
        $response = $this->actingAs($this->admin)
            ->postJson('/api/admin/enrollments', [
                'user_id' => $this->student->id,
                'course_id' => $this->course->id,
                'batch_id' => $this->batch->id,
                'expires_at' => $expiresAt->toDateTimeString(),
            ]);

        $response->assertStatus(200);

        // 1. Accessing course now is allowed
        $this->actingAs($this->student)
            ->getJson("/api/student/courses/{$this->course->id}/outline")
            ->assertStatus(200);

        // 2. Travel to 3 hours later (enrollment expired)
        Carbon::setTestNow(now()->addHours(3));

        // Course is no longer accessible
        $this->actingAs($this->student)
            ->getJson("/api/student/courses/{$this->course->id}/outline")
            ->assertStatus(403);

        Carbon::setTestNow(); // reset
    }
}
