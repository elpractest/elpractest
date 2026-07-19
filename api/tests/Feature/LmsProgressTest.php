<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\CourseModule;
use App\Models\Lesson;
use App\Models\LessonProgress;
use App\Models\Enrollment;
use App\Models\User;
use App\Models\Batch;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LmsProgressTest extends TestCase
{
    use RefreshDatabase;

    private User $student;
    private Course $course;
    private CourseModule $module;
    private Lesson $lesson1;
    private Lesson $lesson2;
    private Batch $batch;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);

        $this->student = User::factory()->create();
        $this->student->assignRole('student');

        $this->course = Course::create([
            'title' => 'SSC Master Class',
            'slug' => 'ssc-master-class',
            'description' => 'Math & English',
            'mode' => 'recorded',
            'exam_category' => 'SSC',
        ]);

        $this->batch = Batch::create([
            'course_id' => $this->course->id,
            'name' => 'SSC Batch A',
        ]);

        $this->module = CourseModule::create([
            'course_id' => $this->course->id,
            'title' => 'Algebra Module',
        ]);

        // Lesson 1: 1000s duration, normal lesson
        $this->lesson1 = Lesson::create([
            'module_id' => $this->module->id,
            'title' => 'Intro to Equations',
            'video_provider' => 'youtube',
            'video_id' => 'yt_equations',
            'duration_seconds' => 1000,
            'is_free_preview' => false,
        ]);

        // Lesson 2: Free preview lesson
        $this->lesson2 = Lesson::create([
            'module_id' => $this->module->id,
            'title' => 'Algebra Basics Preview',
            'video_provider' => 'youtube',
            'video_id' => 'yt_basics',
            'duration_seconds' => 500,
            'is_free_preview' => true,
        ]);
    }

    public function test_unenrolled_student_cannot_access_course_outline_or_private_lesson(): void
    {
        // Unenrolled tries to access course outline
        $outlineRes = $this->actingAs($this->student)
            ->getJson("/api/student/courses/{$this->course->id}/outline");
        $outlineRes->assertStatus(403);

        // Unenrolled tries to access private lesson details
        $lessonRes1 = $this->actingAs($this->student)
            ->getJson("/api/student/lessons/{$this->lesson1->id}");
        $lessonRes1->assertStatus(403);

        // Unenrolled CAN access free preview lesson
        $lessonRes2 = $this->actingAs($this->student)
            ->getJson("/api/student/lessons/{$this->lesson2->id}");
        $lessonRes2->assertStatus(200)
            ->assertJsonPath('lesson.title', 'Algebra Basics Preview');
    }

    public function test_enrolled_student_can_view_outline_and_details_with_progress(): void
    {
        // Enroll student
        Enrollment::create([
            'user_id' => $this->student->id,
            'course_id' => $this->course->id,
            'batch_id' => $this->batch->id,
            'is_active' => true,
            'enrolled_at' => now(),
        ]);

        // Set some progress on lesson1
        LessonProgress::create([
            'user_id' => $this->student->id,
            'lesson_id' => $this->lesson1->id,
            'watched_seconds' => 450,
            'is_completed' => false,
        ]);

        // Check outline
        $outlineRes = $this->actingAs($this->student)
            ->getJson("/api/student/courses/{$this->course->id}/outline");

        $outlineRes->assertStatus(200)
            ->assertJsonPath('modules.0.lessons.0.student_progress.watched_seconds', 450)
            ->assertJsonPath('modules.0.lessons.0.student_progress.is_completed', false)
            ->assertJsonPath('modules.0.lessons.1.student_progress', null); // no progress on lesson2 yet
    }

    public function test_watched_seconds_completion_threshold(): void
    {
        Enrollment::create([
            'user_id' => $this->student->id,
            'course_id' => $this->course->id,
            'batch_id' => $this->batch->id,
            'is_active' => true,
            'enrolled_at' => now(),
        ]);

        // 1. Update progress below 90% (800 seconds out of 1000)
        $response1 = $this->actingAs($this->student)
            ->postJson("/api/student/lessons/{$this->lesson1->id}/progress", [
                'watched_seconds' => 800,
            ]);

        $response1->assertStatus(200)
            ->assertJsonPath('progress.watched_seconds', 800)
            ->assertJsonPath('progress.is_completed', false);

        // 2. Update progress to 90% (900 seconds out of 1000) -> should auto-complete
        $response2 = $this->actingAs($this->student)
            ->postJson("/api/student/lessons/{$this->lesson1->id}/progress", [
                'watched_seconds' => 900,
            ]);

        $response2->assertStatus(200)
            ->assertJsonPath('progress.watched_seconds', 900)
            ->assertJsonPath('progress.is_completed', true)
            ->assertJsonStructure([
                'progress' => [
                    'completed_at',
                ],
            ]);
    }
}
