<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * `exam_category` now resolves from config/exams.php everywhere.
 *
 * The list used to be a hard-coded `in:` rule in four FormRequests plus two
 * literal arrays in the admin SPA, and those had already drifted apart — the
 * Test Series form offered categories the Course API rejected. These tests pin
 * the two invariants that keep it from happening again: Course and Test Series
 * accept the *same* list, and the frontends can read that list from the API.
 */
class ExamCategoryConfigTest extends TestCase
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

    protected function actingAsAdmin(): self
    {
        return $this->actingAs($this->admin)->withSession(['2fa_verified' => true]);
    }

    public function test_the_public_settings_endpoint_serves_the_exam_category_list(): void
    {
        $response = $this->getJson('/api/settings/public')->assertStatus(200);

        $categories = $response->json('settings.exam_categories');

        $this->assertIsArray($categories);
        $this->assertSame(config('exams.categories'), $categories);
    }

    public function test_neet_jee_and_ugc_net_are_now_valid_course_categories(): void
    {
        foreach (['NEET', 'JEE', 'UGC NET'] as $category) {
            $this->actingAsAdmin()->postJson('/api/admin/courses', [
                'title' => "{$category} Foundation",
                'description' => 'Full syllabus programme.',
                'mode' => 'online',
                'exam_category' => $category,
            ])->assertStatus(201);
        }

        $this->assertSame(3, Course::whereIn('exam_category', ['NEET', 'JEE', 'UGC NET'])->count());
    }

    public function test_an_unknown_category_is_still_rejected(): void
    {
        $this->actingAsAdmin()->postJson('/api/admin/courses', [
            'title' => 'Mystery Exam',
            'description' => 'Nope.',
            'mode' => 'online',
            'exam_category' => 'Hogwarts Entrance',
        ])->assertStatus(422)->assertJsonValidationErrors('exam_category');
    }

    /**
     * The drift that actually happened: the Test Series form offered Railways /
     * Defence / Other while the Course API 422'd all three.
     */
    public function test_course_and_test_series_accept_the_same_categories(): void
    {
        foreach (config('exams.categories') as $category) {
            $this->actingAsAdmin()->postJson('/api/admin/courses', [
                'title' => "Course {$category}",
                'description' => 'Description.',
                'mode' => 'online',
                'exam_category' => $category,
            ])->assertStatus(201);

            $this->actingAsAdmin()->postJson('/api/admin/test-series', [
                'title' => "Series {$category}",
                'exam_category' => $category,
            ])->assertStatus(201);
        }
    }
}
