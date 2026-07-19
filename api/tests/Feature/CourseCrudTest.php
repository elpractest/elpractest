<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\CourseModule;
use App\Models\Lesson;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CourseCrudTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

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
    }

    public function test_admin_can_create_course_with_auto_generated_slug(): void
    {
        $response = $this->actingAs($this->admin)
            ->postJson('/api/admin/courses', [
                'title' => 'SSC CGL Master Class 2026',
                'description' => 'Comprehensive course for SSC CGL.',
                'short_description' => 'Short course overview',
                'mode' => 'recorded',
                'exam_category' => 'SSC',
                'is_published' => true,
            ]);

        $response->assertStatus(201)
            ->assertJsonPath('course.slug', 'ssc-cgl-master-class-2026');

        $this->assertDatabaseHas('courses', [
            'title' => 'SSC CGL Master Class 2026',
            'slug' => 'ssc-cgl-master-class-2026',
        ]);
    }

    public function test_course_slug_is_locked_on_title_update(): void
    {
        $course = Course::create([
            'title' => 'Banking Special QA',
            'slug' => 'banking-special-qa',
            'description' => 'Math course',
            'mode' => 'live',
            'exam_category' => 'Banking',
            'is_published' => true,
        ]);

        $response = $this->actingAs($this->admin)
            ->putJson("/api/admin/courses/{$course->id}", [
                'title' => 'Updated Banking Special QA Pro',
                'description' => 'Math course updated',
                'mode' => 'live',
                'exam_category' => 'Banking',
            ]);

        $response->assertStatus(200);
        $course->refresh();

        // Title updated, slug remains locked
        $this->assertEquals('Updated Banking Special QA Pro', $course->title);
        $this->assertEquals('banking-special-qa', $course->slug);
    }

    public function test_admin_can_manually_override_slug(): void
    {
        $course = Course::create([
            'title' => 'RRB NTPC Reasoning',
            'slug' => 'rrb-ntpc-reasoning',
            'description' => 'Reasoning',
            'mode' => 'hybrid',
            'exam_category' => 'RRB',
            'is_published' => true,
        ]);

        $response = $this->actingAs($this->admin)
            ->putJson("/api/admin/courses/{$course->id}", [
                'title' => 'RRB NTPC Reasoning',
                'slug' => 'rrb-reasoning-new-slug',
                'description' => 'Reasoning',
                'mode' => 'hybrid',
                'exam_category' => 'RRB',
            ]);

        $response->assertStatus(200);
        $course->refresh();

        $this->assertEquals('rrb-reasoning-new-slug', $course->slug);
    }

    public function test_module_crud_operations(): void
    {
        $course = Course::create([
            'title' => 'UPSC GS Core',
            'slug' => 'upsc-gs-core',
            'description' => 'UPSC GS Core',
            'mode' => 'recorded',
            'exam_category' => 'UPSC',
        ]);

        // Create Module
        $response = $this->actingAs($this->admin)
            ->postJson("/api/admin/courses/{$course->id}/modules", [
                'title' => 'Indian Polity',
                'sort_order' => 1,
            ]);

        $response->assertStatus(201);
        $module = CourseModule::first();
        $this->assertNotNull($module);
        $this->assertEquals('Indian Polity', $module->title);

        // Update Module
        $updateResponse = $this->actingAs($this->admin)
            ->putJson("/api/admin/modules/{$module->id}", [
                'title' => 'Polity & Constitution',
                'sort_order' => 2,
            ]);
        $updateResponse->assertStatus(200);
        $module->refresh();
        $this->assertEquals('Polity & Constitution', $module->title);

        // Delete Module
        $deleteResponse = $this->actingAs($this->admin)
            ->deleteJson("/api/admin/modules/{$module->id}");
        $deleteResponse->assertStatus(200);
        $this->assertDatabaseMissing('course_modules', ['id' => $module->id]);
    }

    public function test_lesson_crud_operations(): void
    {
        $course = Course::create([
            'title' => 'UPSC GS Core',
            'slug' => 'upsc-gs-core',
            'description' => 'UPSC GS Core',
            'mode' => 'recorded',
            'exam_category' => 'UPSC',
        ]);

        $module = CourseModule::create([
            'course_id' => $course->id,
            'title' => 'Polity',
        ]);

        // Create Lesson
        $response = $this->actingAs($this->admin)
            ->postJson("/api/admin/modules/{$module->id}/lessons", [
                'title' => 'Preamble of the Constitution',
                'video_provider' => 'youtube',
                'video_id' => 'abc123xyz',
                'duration_seconds' => 1800,
                'sort_order' => 1,
                'is_free_preview' => true,
            ]);

        $response->assertStatus(201);
        $lesson = Lesson::first();
        $this->assertNotNull($lesson);
        $this->assertEquals('Preamble of the Constitution', $lesson->title);
        $this->assertTrue($lesson->is_free_preview);

        // Update Lesson
        $updateResponse = $this->actingAs($this->admin)
            ->putJson("/api/admin/lessons/{$lesson->id}", [
                'title' => 'Preamble of the Constitution v2',
                'video_provider' => 'youtube',
                'video_id' => 'abc123xyz',
                'duration_seconds' => 1850,
                'sort_order' => 1,
                'is_free_preview' => false,
            ]);
        $updateResponse->assertStatus(200);
        $lesson->refresh();
        $this->assertEquals('Preamble of the Constitution v2', $lesson->title);
        $this->assertFalse($lesson->is_free_preview);

        // Delete Lesson
        $deleteResponse = $this->actingAs($this->admin)
            ->deleteJson("/api/admin/lessons/{$lesson->id}");
        $deleteResponse->assertStatus(200);
        $this->assertDatabaseMissing('lessons', ['id' => $lesson->id]);
    }
}
