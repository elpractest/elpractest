<?php

namespace Tests\Feature;

use App\Models\Assignment;
use App\Models\Batch;
use App\Models\Course;
use App\Models\TestSeries;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AssignmentApiTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected Batch $batch1;
    protected Batch $batch2;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);

        $this->admin = User::factory()->create(['email_verified_at' => now()]);
        $this->admin->assignRole('admin');
        $this->admin->update([
            'google2fa_enabled' => true,
            'google2fa_secret' => '5SOPMH6I26QGPM4U',
        ]);

        $course = Course::create([
            'title' => 'SSC CGL Master Course',
            'slug' => 'ssc-cgl-master',
            'exam_category' => 'SSC',
            'description' => 'Test course',
            'created_by' => $this->admin->id,
        ]);

        $this->batch1 = Batch::create([
            'course_id' => $course->id,
            'name' => 'Batch 2026 A',
            'starts_at' => now(),
            'ends_at' => now()->addYear(),
        ]);

        $this->batch2 = Batch::create([
            'course_id' => $course->id,
            'name' => 'Batch 2026 B',
            'starts_at' => now(),
            'ends_at' => now()->addYear(),
        ]);
    }

    protected function actingAsAdmin(): self
    {
        return $this->actingAs($this->admin)->withSession(['2fa_verified' => true]);
    }

    public function test_admin_can_assign_test_series_to_multiple_batches(): void
    {
        $series = TestSeries::create([
            'title' => 'SSC CGL Full Test Series',
            'slug' => 'ssc-cgl-full-series',
            'exam_category' => 'SSC',
            'created_by' => $this->admin->id,
        ]);

        $response = $this->actingAsAdmin()->postJson('/api/admin/assignments', [
            'batch_ids' => [$this->batch1->id, $this->batch2->id],
            'assignable_type' => 'series',
            'assignable_id' => $series->id,
            'available_from' => now()->toDateTimeString(),
            'due_at' => now()->addDays(14)->toDateTimeString(),
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('assignments', [
            'batch_id' => $this->batch1->id,
            'assignable_type' => TestSeries::class,
            'assignable_id' => $series->id,
        ]);
        $this->assertDatabaseHas('assignments', [
            'batch_id' => $this->batch2->id,
            'assignable_type' => TestSeries::class,
            'assignable_id' => $series->id,
        ]);
    }
}
