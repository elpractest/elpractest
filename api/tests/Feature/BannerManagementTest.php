<?php

namespace Tests\Feature;

use App\Models\Banner;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class BannerManagementTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $superAdmin;

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

        Storage::fake('public');
    }

    private function asSuperAdmin()
    {
        return $this->actingAs($this->superAdmin)->withSession(['2fa_verified' => true]);
    }

    public function test_super_admin_can_create_a_banner(): void
    {
        $response = $this->asSuperAdmin()->postJson('/api/super-admin/banners', [
            'title' => 'Free Scholarship Test',
            'subtitle' => 'Win up to 100% off',
            'kicker' => 'FREE SCHOLARSHIP',
            'cta_label' => 'Attempt free',
            'cta_url' => '/student/test-series',
            'exam_category' => 'SSC',
        ]);

        $response->assertCreated();
        $this->assertDatabaseHas('banners', ['title' => 'Free Scholarship Test', 'is_active' => true]);
    }

    public function test_super_admin_can_upload_a_banner_image(): void
    {
        $banner = Banner::create(['title' => 'Promo']);
        $file = UploadedFile::fake()->image('promo.jpg', 1920, 1080);

        $response = $this->asSuperAdmin()
            ->postJson("/api/super-admin/banners/{$banner->id}/image", ['image' => $file]);

        $response->assertOk()->assertJsonStructure(['message', 'image_url']);

        $banner->refresh();
        $this->assertNotNull($banner->image_path);
        Storage::disk('public')->assertExists($banner->image_path);
    }

    public function test_super_admin_can_update_and_delete_a_banner(): void
    {
        $banner = Banner::create(['title' => 'Old title']);

        $this->asSuperAdmin()
            ->putJson("/api/super-admin/banners/{$banner->id}", ['title' => 'New title', 'is_active' => false])
            ->assertOk();
        $this->assertDatabaseHas('banners', ['id' => $banner->id, 'title' => 'New title', 'is_active' => false]);

        $this->asSuperAdmin()
            ->deleteJson("/api/super-admin/banners/{$banner->id}")
            ->assertOk();
        $this->assertDatabaseMissing('banners', ['id' => $banner->id]);
    }

    public function test_image_upload_rejects_non_image(): void
    {
        $banner = Banner::create(['title' => 'Promo']);
        $file = UploadedFile::fake()->create('notes.txt', 100);

        $this->asSuperAdmin()
            ->postJson("/api/super-admin/banners/{$banner->id}/image", ['image' => $file])
            ->assertStatus(422);
    }

    /**
     * Every banner surface (student carousel, Android carousel, admin preview)
     * renders 16:9, so a differently-shaped upload has to be refused here
     * rather than silently centre-cropped on the student's home screen.
     */
    public function test_image_upload_rejects_a_non_16_9_image(): void
    {
        $banner = Banner::create(['title' => 'Promo']);

        $this->asSuperAdmin()
            ->postJson("/api/super-admin/banners/{$banner->id}/image", [
                'image' => UploadedFile::fake()->image('square.jpg', 1200, 1200),
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('image');

        $this->assertNull($banner->fresh()->image_path);
    }

    /** Correctly shaped but too small to survive a 2x phone display. */
    public function test_image_upload_rejects_an_undersized_16_9_image(): void
    {
        $banner = Banner::create(['title' => 'Promo']);

        $this->asSuperAdmin()
            ->postJson("/api/super-admin/banners/{$banner->id}/image", [
                'image' => UploadedFile::fake()->image('small.jpg', 640, 360),
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('image');
    }

    public function test_public_endpoint_returns_only_active_banners_in_order(): void
    {
        Banner::create(['title' => 'Second', 'is_active' => true, 'sort_order' => 2]);
        Banner::create(['title' => 'First', 'is_active' => true, 'sort_order' => 1]);
        Banner::create(['title' => 'Hidden', 'is_active' => false, 'sort_order' => 0]);
        Banner::create(['title' => 'Expired', 'is_active' => true, 'sort_order' => 0, 'ends_at' => now()->subDay()]);

        $response = $this->getJson('/api/banners/public');

        $response->assertOk();
        $titles = array_column($response->json(), 'title');

        $this->assertSame(['First', 'Second'], $titles);
        $this->assertNotContains('Hidden', $titles);
        $this->assertNotContains('Expired', $titles);
    }

    public function test_public_endpoint_exposes_image_url(): void
    {
        Banner::create(['title' => 'WithImage', 'image_path' => 'banners/x.jpg']);

        $this->getJson('/api/banners/public')
            ->assertOk()
            ->assertJsonFragment(['image_url' => Storage::disk('public')->url('banners/x.jpg')]);
    }

    public function test_plain_admin_cannot_manage_banners(): void
    {
        $banner = Banner::create(['title' => 'Promo']);

        $this->actingAs($this->admin)->withSession(['2fa_verified' => true])
            ->getJson('/api/super-admin/banners')
            ->assertForbidden();

        $this->actingAs($this->admin)->withSession(['2fa_verified' => true])
            ->postJson('/api/super-admin/banners', ['title' => 'Nope'])
            ->assertForbidden();

        $this->actingAs($this->admin)->withSession(['2fa_verified' => true])
            ->deleteJson("/api/super-admin/banners/{$banner->id}")
            ->assertForbidden();
    }

    public function test_guest_can_read_public_banners_but_not_manage(): void
    {
        $this->getJson('/api/banners/public')->assertOk();
        $this->postJson('/api/super-admin/banners', ['title' => 'Nope'])->assertUnauthorized();
    }
}
