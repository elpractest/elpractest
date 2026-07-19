<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class CourseBannerUploadTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $superAdmin;
    protected Course $course;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);

        $this->admin = User::factory()->create([
            'google2fa_enabled' => true,
            'google2fa_secret' => 'LUTWUXK6K5F5GDZ6',
        ]);
        $this->admin->assignRole('admin');

        $this->superAdmin = User::factory()->create([
            'email' => env('SUPER_ADMIN_EMAIL', 'thevinstitution@gmail.com'),
            'google2fa_enabled' => true,
            'google2fa_secret' => 'LUTWUXK6K5F5GDZ6',
        ]);
        $this->superAdmin->assignRole('super-admin');

        $this->course = Course::create([
            'title' => 'Test Course Outline',
            'slug' => 'test-course-outline',
            'exam_category' => 'UPSC',
            'mode' => 'online',
            'is_published' => true,
        ]);

        Storage::fake('public');
    }

    public function test_admin_can_upload_banner_to_course(): void
    {
        $file = UploadedFile::fake()->image('banner.jpg', 1200, 400);

        // Act: call upload banner route
        $response = $this->actingAs($this->admin)
            ->withSession(['2fa_verified' => true])
            ->postJson("/api/admin/courses/{$this->course->id}/banner", [
                'banner' => $file,
            ]);

        $response->assertOk();
        $response->assertJsonStructure([
            'message',
            'banner_url',
        ]);

        $this->course->refresh();
        $this->assertNotNull($this->course->banner_image_path);
        Storage::disk('public')->assertExists($this->course->banner_image_path);
    }

    public function test_super_admin_can_upload_banner_to_any_course(): void
    {
        $file = UploadedFile::fake()->image('banner.png', 1200, 400);

        $response = $this->actingAs($this->superAdmin)
            ->withSession(['2fa_verified' => true])
            ->postJson("/api/admin/courses/{$this->course->id}/banner", [
                'banner' => $file,
            ]);

        $response->assertOk();
        
        $this->course->refresh();
        $this->assertNotNull($this->course->banner_image_path);
        Storage::disk('public')->assertExists($this->course->banner_image_path);
    }

    public function test_invalid_file_size_or_format_rejected(): void
    {
        // 1. Text file instead of image
        $fileText = UploadedFile::fake()->create('document.txt', 100);

        $response = $this->actingAs($this->admin)
            ->withSession(['2fa_verified' => true])
            ->postJson("/api/admin/courses/{$this->course->id}/banner", [
                'banner' => $fileText,
            ]);

        $response->assertStatus(422);

        // 2. Too large file (e.g. 5MB)
        $fileLarge = UploadedFile::fake()->image('large.jpg')->size(5000); // 5000kb

        $response = $this->actingAs($this->admin)
            ->withSession(['2fa_verified' => true])
            ->postJson("/api/admin/courses/{$this->course->id}/banner", [
                'banner' => $fileLarge,
            ]);

        $response->assertStatus(422);
    }

    public function test_public_courses_api_returns_banner_url(): void
    {
        \Illuminate\Support\Facades\Cache::flush();
        $this->course->update(['banner_image_path' => 'banners/dummy.jpg']);

        $response = $this->getJson('/api/courses/public');

        $response->assertOk();
        $response->assertJsonFragment([
            'banner_url' => Storage::disk('public')->url('banners/dummy.jpg'),
        ]);
    }
}
