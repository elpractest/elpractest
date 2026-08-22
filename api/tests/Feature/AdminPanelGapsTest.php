<?php

namespace Tests\Feature;

use App\Http\Controllers\PublicCourseController;
use App\Models\Batch;
use App\Models\Course;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Tests\TestCase;

/**
 * Covers three things the admin panel could not do, each of which passed the
 * old suite because every existing test sent a hand-written payload rather than
 * the one the panel actually sends.
 *
 *  1. Creating a course. The form omitted `mode` (required) and offered exam
 *     categories the API rejects, so "Create Course" always 422'd.
 *  2. Publishing a course. /courses/public returns published courses only and
 *     nothing in the panel could set the flag.
 *  3. Setting a batch's Play product id — the field the Android purchase flow
 *     resolves a payment by. The endpoint did not accept it at all.
 */
class AdminPanelGapsTest extends TestCase
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

    /** The exact payload the course form now sends. */
    private function panelCoursePayload(array $overrides = []): array
    {
        return array_merge([
            'title' => 'SSC CGL 2026 Foundation',
            'description' => 'Full syllabus coverage with weekly mocks.',
            'exam_category' => 'SSC',
            'mode' => 'hybrid',
            'sort_order' => 0,
            'is_published' => false,
        ], $overrides);
    }

    public function test_the_admin_panel_payload_creates_a_course(): void
    {
        $response = $this->actingAs($this->admin)
            ->postJson('/api/admin/courses', $this->panelCoursePayload());

        $response->assertStatus(201);
        $this->assertDatabaseHas('courses', [
            'title' => 'SSC CGL 2026 Foundation',
            'slug' => 'ssc-cgl-2026-foundation',
            'mode' => 'hybrid',
        ]);
    }

    public function test_every_exam_category_the_form_offers_is_accepted(): void
    {
        foreach (['SSC', 'Banking', 'RRB', 'UPSC', 'State PCS'] as $i => $category) {
            $this->actingAs($this->admin)
                ->postJson('/api/admin/courses', $this->panelCoursePayload([
                    'title' => "Course {$i}",
                    'exam_category' => $category,
                ]))
                ->assertStatus(201);
        }
    }

    public function test_every_delivery_mode_the_form_offers_is_accepted(): void
    {
        foreach (['hybrid', 'online', 'offline', 'live', 'recorded'] as $i => $mode) {
            $this->actingAs($this->admin)
                ->postJson('/api/admin/courses', $this->panelCoursePayload([
                    'title' => "Mode course {$i}",
                    'mode' => $mode,
                ]))
                ->assertStatus(201);
        }
    }

    public function test_a_typed_slug_is_kept_instead_of_being_regenerated(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/api/admin/courses', $this->panelCoursePayload(['slug' => 'my-chosen-slug']))
            ->assertStatus(201)
            ->assertJsonPath('course.slug', 'my-chosen-slug');
    }

    public function test_publishing_a_course_puts_it_on_the_public_catalogue(): void
    {
        $course = Course::create($this->panelCoursePayload([
            'slug' => 'ssc-cgl-2026-foundation',
            'is_published' => false,
        ]));
        Batch::create([
            'course_id' => $course->id,
            'name' => 'Batch A',
            'is_active' => true,
            'price_paise' => 99900,
        ]);

        // Warm the cache while it is still a draft.
        $this->getJson('/api/courses/public')->assertStatus(200)->assertJsonCount(0);

        $this->actingAs($this->admin)
            ->putJson("/api/admin/courses/{$course->id}", ['is_published' => true])
            ->assertStatus(200);

        $this->assertTrue($course->fresh()->is_published);

        // The write forgets the catalogue cache, so this is visible at once
        // rather than up to five minutes later.
        $this->getJson('/api/courses/public')
            ->assertStatus(200)
            ->assertJsonCount(1)
            ->assertJsonPath('0.slug', 'ssc-cgl-2026-foundation');
    }

    public function test_unpublishing_removes_it_again(): void
    {
        $course = Course::create($this->panelCoursePayload([
            'slug' => 'temp-course',
            'is_published' => true,
        ]));
        Batch::create([
            'course_id' => $course->id,
            'name' => 'Batch A',
            'is_active' => true,
            'price_paise' => 50000,
        ]);
        Cache::forget(PublicCourseController::CACHE_KEY);

        $this->getJson('/api/courses/public')->assertJsonCount(1);

        $this->actingAs($this->admin)
            ->putJson("/api/admin/courses/{$course->id}", ['is_published' => false])
            ->assertStatus(200);

        $this->getJson('/api/courses/public')->assertJsonCount(0);
    }

    public function test_a_batch_can_be_given_a_play_product_id(): void
    {
        $course = Course::create($this->panelCoursePayload(['slug' => 'play-course']));

        $response = $this->actingAs($this->admin)
            ->postJson("/api/admin/courses/{$course->id}/batches", [
                'name' => 'Play Batch',
                'price_paise' => 99900,
                'play_product_id' => 'ssc_cgl_2026_tier1',
            ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('batches', [
            'name' => 'Play Batch',
            'play_product_id' => 'ssc_cgl_2026_tier1',
        ]);
    }

    public function test_two_batches_cannot_share_one_play_product_id(): void
    {
        $course = Course::create($this->panelCoursePayload(['slug' => 'play-course-2']));

        $this->actingAs($this->admin)
            ->postJson("/api/admin/courses/{$course->id}/batches", [
                'name' => 'First',
                'play_product_id' => 'duplicate_id',
            ])->assertStatus(201);

        // A shared id would make GooglePlayController enrol whichever batch it
        // happened to find first.
        $this->actingAs($this->admin)
            ->postJson("/api/admin/courses/{$course->id}/batches", [
                'name' => 'Second',
                'play_product_id' => 'duplicate_id',
            ])->assertStatus(422);
    }

    public function test_editing_a_batch_keeps_its_own_play_product_id(): void
    {
        $course = Course::create($this->panelCoursePayload(['slug' => 'play-course-3']));
        $batch = Batch::create([
            'course_id' => $course->id,
            'name' => 'Existing',
            'is_active' => true,
            'play_product_id' => 'keep_me',
        ]);

        // Re-sending its own id must not trip the uniqueness rule.
        $this->actingAs($this->admin)
            ->putJson("/api/admin/batches/{$batch->id}", [
                'name' => 'Renamed',
                'play_product_id' => 'keep_me',
            ])->assertStatus(200);

        $this->assertEquals('Renamed', $batch->fresh()->name);
    }
}
