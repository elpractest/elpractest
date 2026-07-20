<?php

namespace Tests\Feature;

use App\Models\ActivationRequest;
use App\Models\Batch;
use App\Models\Course;
use App\Models\Test;
use App\Models\TestSession;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StudentEndpointsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);
    }

    public function test_student_can_fetch_own_activation_requests(): void
    {
        $student = User::factory()->create(['phone_verified_at' => now()]);
        $student->assignRole('student');

        $otherStudent = User::factory()->create(['phone_verified_at' => now()]);
        $otherStudent->assignRole('student');

        $course = Course::create([
            'title' => 'SSC CGL Tier 1',
            'slug' => 'ssc-cgl-tier-1',
            'description' => 'SSC CGL',
            'mode' => 'online',
            'exam_category' => 'SSC',
        ]);

        $batch = Batch::create([
            'course_id' => $course->id,
            'name' => 'SSC CGL Batch 2026',
        ]);

        ActivationRequest::create([
            'user_id' => $student->id,
            'batch_id' => $batch->id,
            'payment_reference' => 'TXN-STUDENT-OWN-1',
            'proof_document_path' => 'proofs/dummy.png',
            'status' => 'pending',
        ]);

        ActivationRequest::create([
            'user_id' => $otherStudent->id,
            'batch_id' => $batch->id,
            'payment_reference' => 'TXN-OTHER-STUDENT-1',
            'proof_document_path' => 'proofs/dummy2.png',
            'status' => 'pending',
        ]);

        $response = $this->actingAs($student)->getJson('/api/student/activation-requests');

        $response->assertStatus(200)
            ->assertJsonCount(1, 'requests')
            ->assertJsonPath('requests.0.payment_reference', 'TXN-STUDENT-OWN-1')
            ->assertJsonPath('requests.0.batch.name', 'SSC CGL Batch 2026')
            ->assertJsonPath('requests.0.batch.course.title', 'SSC CGL Tier 1');
    }

    public function test_student_can_fetch_own_test_results_history(): void
    {
        $student = User::factory()->create();
        $student->assignRole('student');

        $otherStudent = User::factory()->create();
        $otherStudent->assignRole('student');

        $course = Course::create([
            'title' => 'Banking Speed Test',
            'slug' => 'banking-speed-test',
            'description' => 'Banking',
            'mode' => 'online',
            'exam_category' => 'Banking',
        ]);

        $test = Test::create([
            'course_id' => $course->id,
            'title' => 'SBI PO Prelims Mock 1',
            'type' => 'mock',
            'duration_seconds' => 3600,
            'total_marks' => 100,
            'is_published' => true,
            'created_by' => $student->id,
        ]);

        $session1 = TestSession::create([
            'user_id' => $student->id,
            'test_id' => $test->id,
            'started_at' => now()->subHour(),
            'submitted_at' => now()->subMinutes(10),
            'duration_seconds' => 3600,
            'current_section_index' => 0,
            'section_started_at' => now()->subHour(),
        ]);

        // Unsubmitted session should be excluded
        TestSession::create([
            'user_id' => $student->id,
            'test_id' => $test->id,
            'started_at' => now(),
            'duration_seconds' => 3600,
            'current_section_index' => 0,
            'section_started_at' => now(),
        ]);

        // Other student's session should be excluded
        TestSession::create([
            'user_id' => $otherStudent->id,
            'test_id' => $test->id,
            'started_at' => now()->subHour(),
            'submitted_at' => now()->subMinutes(5),
            'duration_seconds' => 3600,
            'current_section_index' => 0,
            'section_started_at' => now()->subHour(),
        ]);

        $response = $this->actingAs($student)->getJson('/api/student/results');

        $response->assertStatus(200)
            ->assertJsonCount(1, 'results')
            ->assertJsonPath('results.0.session_id', $session1->id)
            ->assertJsonPath('results.0.test_title', 'SBI PO Prelims Mock 1')
            ->assertJsonPath('results.0.course_title', 'Banking Speed Test');
    }
}
