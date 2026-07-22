<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Test;
use App\Models\TestSeries;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TestSeriesApiTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;

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
    }

    protected function actingAsAdmin(): self
    {
        return $this->actingAs($this->admin)->withSession(['2fa_verified' => true]);
    }

    public function test_admin_can_create_test_series(): void
    {
        $response = $this->actingAsAdmin()->postJson('/api/admin/test-series', [
            'title' => 'SSC CGL 2026 Tier I Mock Series',
            'exam_category' => 'SSC',
            'description' => 'Comprehensive 50-test series for SSC CGL',
        ]);

        $response->assertStatus(201);
        $response->assertJsonPath('series.title', 'SSC CGL 2026 Tier I Mock Series');
        $response->assertJsonPath('series.exam_category', 'SSC');

        $this->assertDatabaseHas('test_series', [
            'title' => 'SSC CGL 2026 Tier I Mock Series',
            'exam_category' => 'SSC',
        ]);
    }

    public function test_cannot_publish_series_with_zero_tests(): void
    {
        $series = TestSeries::create([
            'title' => 'Empty Series',
            'slug' => 'empty-series',
            'exam_category' => 'Banking',
            'created_by' => $this->admin->id,
        ]);

        $response = $this->actingAsAdmin()->postJson("/api/admin/test-series/{$series->id}/publish");

        $response->assertStatus(422);
        $response->assertJsonPath('message', 'Cannot publish a test series with zero tests attached.');
        $this->assertFalse($series->fresh()->is_published);
    }

    public function test_admin_can_sync_and_order_tests_in_series(): void
    {
        $series = TestSeries::create([
            'title' => 'SBI PO 2026 Series',
            'slug' => 'sbi-po-2026-series',
            'exam_category' => 'Banking',
            'created_by' => $this->admin->id,
        ]);

        $test1 = Test::create([
            'title' => 'Full Mock 01',
            'type' => 'mock',
            'duration_seconds' => 3600,
            'max_attempts' => 1,
            'total_marks' => 200,
            'created_by' => $this->admin->id,
        ]);
        $test2 = Test::create([
            'title' => 'Quant Sectional 01',
            'type' => 'practice',
            'duration_seconds' => 1200,
            'max_attempts' => 1,
            'total_marks' => 50,
            'created_by' => $this->admin->id,
        ]);

        $response = $this->actingAsAdmin()->putJson("/api/admin/test-series/{$series->id}/tests", [
            'tests' => [
                ['test_id' => $test1->id, 'series_sort_order' => 1, 'category' => 'full_mock', 'is_free' => true],
                ['test_id' => $test2->id, 'series_sort_order' => 2, 'category' => 'sectional', 'is_free' => false],
            ],
        ]);

        $response->assertStatus(200);

        $this->assertEquals($series->id, $test1->fresh()->test_series_id);
        $this->assertEquals(1, $test1->fresh()->series_sort_order);
        $this->assertEquals('full_mock', $test1->fresh()->category);
        $this->assertTrue($test1->fresh()->is_free);

        $this->assertEquals($series->id, $test2->fresh()->test_series_id);
        $this->assertEquals(2, $test2->fresh()->series_sort_order);
        $this->assertEquals('sectional', $test2->fresh()->category);
        $this->assertFalse($test2->fresh()->is_free);

        // Now publish should succeed
        $pubResponse = $this->actingAsAdmin()->postJson("/api/admin/test-series/{$series->id}/publish");
        $pubResponse->assertStatus(200);
        $this->assertTrue($series->fresh()->is_published);
    }
}
