<?php

namespace Tests\Feature;

use App\Models\Batch;
use App\Models\Course;
use App\Models\CourseModule;
use App\Models\Enrollment;
use App\Models\Lesson;
use App\Models\LessonProgress;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The cohort-level video analytics `CohortAnalyticsController::videoEngagement`
 * derives from `lesson_progress` — a table that has been written on every
 * lesson view since the LMS shipped, but was never read back in aggregate
 * anywhere on the admin side. These pin the numbers that matter to an owner
 * deciding which lesson is losing students: enrolled vs. started vs.
 * completed, and that a student who never opened a lesson still counts
 * against it rather than being invisible.
 */
class VideoEngagementAnalyticsTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private Course $course;
    private CourseModule $module;
    private Lesson $lessonA;
    private Lesson $lessonB;
    private Batch $batch;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);

        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');
        $this->admin->update(['google2fa_enabled' => true, 'google2fa_secret' => 'B39XKJ2938JJD982']);

        $this->course = Course::create([
            'title' => 'SSC CGL Master Class',
            'description' => 'desc',
            'exam_category' => 'SSC',
        ]);

        $this->batch = Batch::create(['course_id' => $this->course->id, 'name' => 'Batch A']);

        $this->module = CourseModule::create(['course_id' => $this->course->id, 'title' => 'Module 1']);

        $this->lessonA = Lesson::create([
            'module_id' => $this->module->id,
            'title' => 'Lesson A',
            'video_provider' => 'youtube',
            'video_id' => 'aaa',
            'duration_seconds' => 1000,
            'sort_order' => 1,
        ]);

        $this->lessonB = Lesson::create([
            'module_id' => $this->module->id,
            'title' => 'Lesson B',
            'video_provider' => 'youtube',
            'video_id' => 'bbb',
            'duration_seconds' => 1000,
            'sort_order' => 2,
        ]);
    }

    private function enrol(User $user): void
    {
        Enrollment::create([
            'user_id' => $user->id,
            'course_id' => $this->course->id,
            'batch_id' => $this->batch->id,
            'enrolled_at' => now(),
            'is_active' => true,
        ]);
    }

    public function test_a_student_who_never_opened_a_lesson_still_counts_against_it(): void
    {
        $watcher = User::factory()->create();
        $watcher->assignRole('student');
        $this->enrol($watcher);

        $ghost = User::factory()->create();
        $ghost->assignRole('student');
        $this->enrol($ghost);

        LessonProgress::create([
            'user_id' => $watcher->id,
            'lesson_id' => $this->lessonA->id,
            'watched_seconds' => 1000,
            'completed' => true,
        ]);

        $response = $this->actingAs($this->admin)
            ->getJson("/api/admin/courses/{$this->course->id}/video-analytics")
            ->assertOk();

        $response->assertJsonPath('enrolled_students', 2);

        $lessonA = collect($response->json('lessons'))->firstWhere('lesson_id', $this->lessonA->id);
        $this->assertSame(1, $lessonA['students_started']);
        $this->assertSame(1, $lessonA['students_completed']);
        // Against ENROLLED (2), not against viewers (1) — the ghost student
        // must pull this rate down, not disappear from it.
        $this->assertEqualsWithDelta(50.0, $lessonA['start_rate'], 0.001);
        $this->assertEqualsWithDelta(50.0, $lessonA['completion_rate'], 0.001);
    }

    public function test_watched_percentage_is_relative_to_the_lessons_own_duration(): void
    {
        $student = User::factory()->create();
        $student->assignRole('student');
        $this->enrol($student);

        LessonProgress::create([
            'user_id' => $student->id,
            'lesson_id' => $this->lessonA->id,
            'watched_seconds' => 250, // 25% of a 1000s lesson
            'completed' => false,
        ]);

        $response = $this->actingAs($this->admin)
            ->getJson("/api/admin/courses/{$this->course->id}/video-analytics")
            ->assertOk();

        $lessonA = collect($response->json('lessons'))->firstWhere('lesson_id', $this->lessonA->id);
        $this->assertEqualsWithDelta(25.0, $lessonA['average_watched_percentage'], 0.001);
    }

    public function test_weakest_lessons_surfaces_the_lowest_completion_rate_first(): void
    {
        $student = User::factory()->create();
        $student->assignRole('student');
        $this->enrol($student);

        // Finished A, never touched B — B should be the weaker of the two.
        LessonProgress::create([
            'user_id' => $student->id,
            'lesson_id' => $this->lessonA->id,
            'watched_seconds' => 1000,
            'completed' => true,
        ]);

        $response = $this->actingAs($this->admin)
            ->getJson("/api/admin/courses/{$this->course->id}/video-analytics")
            ->assertOk();

        $weakest = $response->json('weakest_lessons');
        $this->assertSame($this->lessonB->id, $weakest[0]['lesson_id']);
        $this->assertEqualsWithDelta(0.0, $weakest[0]['completion_rate'], 0.001);
    }

    public function test_batch_id_narrows_the_cohort(): void
    {
        $otherBatch = Batch::create(['course_id' => $this->course->id, 'name' => 'Batch B']);

        $inBatch = User::factory()->create();
        $inBatch->assignRole('student');
        $this->enrol($inBatch);

        $inOtherBatch = User::factory()->create();
        $inOtherBatch->assignRole('student');
        Enrollment::create([
            'user_id' => $inOtherBatch->id,
            'course_id' => $this->course->id,
            'batch_id' => $otherBatch->id,
            'enrolled_at' => now(),
            'is_active' => true,
        ]);

        $response = $this->actingAs($this->admin)
            ->getJson("/api/admin/courses/{$this->course->id}/video-analytics?batch_id={$this->batch->id}")
            ->assertOk();

        $this->assertSame(1, $response->json('enrolled_students'));
    }

    public function test_a_course_with_no_lessons_reports_zeros_rather_than_erroring(): void
    {
        $empty = Course::create(['title' => 'Empty', 'description' => 'd', 'exam_category' => 'SSC']);

        $this->actingAs($this->admin)
            ->getJson("/api/admin/courses/{$empty->id}/video-analytics")
            ->assertOk()
            ->assertJsonPath('total_lessons', 0)
            ->assertJsonPath('lessons', []);
    }

    public function test_a_student_cannot_reach_this_admin_endpoint(): void
    {
        $student = User::factory()->create();
        $student->assignRole('student');

        $this->actingAs($student)
            ->getJson("/api/admin/courses/{$this->course->id}/video-analytics")
            ->assertStatus(403);
    }
}
