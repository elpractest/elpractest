<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Entitlement;
use App\Models\Product;
use App\Models\TestSeries;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Admin CRUD for store products — the screen that makes the purchase rail
 * usable without a console.
 */
class AdminProductCrudTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private Course $course;
    private TestSeries $series;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);

        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');
        $this->admin->update(['google2fa_enabled' => true, 'google2fa_secret' => 'B39XKJ2938JJD982']);

        $this->course = Course::create([
            'title' => 'SSC CGL Master Class',
            'slug' => 'ssc-cgl-master-class',
            'description' => 'D',
            'exam_category' => 'SSC',
            'mode' => 'online',
        ]);

        $this->series = TestSeries::create([
            'title' => 'SSC CGL Tier I Series',
            'slug' => 'ssc-cgl-tier-i-series',
            'exam_category' => 'SSC',
            'created_by' => $this->admin->id,
        ]);
    }

    private function asAdmin(): self
    {
        return $this->actingAs($this->admin)->withSession(['2fa_verified' => true]);
    }

    public function test_an_admin_can_create_a_bundle_of_a_course_and_a_series(): void
    {
        $response = $this->asAdmin()->postJson('/api/admin/products', [
            'type' => 'bundle',
            'title' => 'SSC CGL Complete Bundle',
            'exam_category' => 'SSC',
            'price_paise' => 549900,
            'list_price_paise' => 749900,
            'access_days' => 365,
            'items' => [
                ['kind' => 'course', 'id' => $this->course->id],
                ['kind' => 'test_series', 'id' => $this->series->id],
            ],
        ])->assertStatus(201);

        $product = Product::findOrFail($response->json('product.id'));

        $this->assertSame(2, $product->items()->count());
        $this->assertSame('ssc-cgl-complete-bundle', $product->slug);
        // A new product is a draft, exactly like a test or a series.
        $this->assertFalse($product->is_published);
        $this->assertSame(26, $product->savings_percent);
    }

    public function test_a_product_that_grants_nothing_cannot_be_published(): void
    {
        $product = Product::create([
            'type' => 'bundle',
            'title' => 'Empty',
            'exam_category' => 'SSC',
            'price_paise' => 10000,
        ]);

        $this->asAdmin()
            ->postJson("/api/admin/products/{$product->id}/publish")
            ->assertStatus(422);

        $this->assertFalse($product->fresh()->is_published);
    }

    public function test_creating_a_product_with_no_items_is_rejected_outright(): void
    {
        $this->asAdmin()->postJson('/api/admin/products', [
            'type' => 'course',
            'title' => 'No items',
            'exam_category' => 'SSC',
            'price_paise' => 1000,
            'items' => [],
        ])->assertStatus(422)->assertJsonValidationErrors('items');
    }

    public function test_editing_the_items_does_not_disturb_what_someone_already_bought(): void
    {
        $create = $this->asAdmin()->postJson('/api/admin/products', [
            'type' => 'bundle',
            'title' => 'Bundle',
            'exam_category' => 'SSC',
            'price_paise' => 100000,
            'items' => [
                ['kind' => 'course', 'id' => $this->course->id],
                ['kind' => 'test_series', 'id' => $this->series->id],
            ],
        ])->assertStatus(201);

        $product = Product::findOrFail($create->json('product.id'));

        $buyer = User::factory()->create();
        $buyer->assignRole('student');
        app(\App\Services\EntitlementService::class)->grantProduct($buyer, $product);

        $this->assertSame(2, Entitlement::where('user_id', $buyer->id)->count());

        // Shrink the bundle to just the course.
        $this->asAdmin()->putJson("/api/admin/products/{$product->id}", [
            'items' => [['kind' => 'course', 'id' => $this->course->id]],
        ])->assertStatus(200);

        $this->assertSame(1, $product->fresh()->items()->count());
        // Entitlements were resolved at purchase, so the buyer keeps both.
        $this->assertSame(2, Entitlement::where('user_id', $buyer->id)->where('is_active', true)->count());
    }

    public function test_removing_a_product_pulls_it_from_sale_but_not_from_buyers(): void
    {
        $product = Product::create([
            'type' => 'test_series',
            'title' => 'Series product',
            'exam_category' => 'SSC',
            'price_paise' => 99900,
            'is_published' => true,
        ]);
        \App\Models\ProductItem::create([
            'product_id' => $product->id,
            'grantable_type' => TestSeries::class,
            'grantable_id' => $this->series->id,
        ]);

        $buyer = User::factory()->create();
        $buyer->assignRole('student');
        app(\App\Services\EntitlementService::class)->grantProduct($buyer, $product);

        $this->asAdmin()->deleteJson("/api/admin/products/{$product->id}")->assertStatus(200);

        $this->assertSoftDeleted('products', ['id' => $product->id]);
        $this->assertSame(1, Entitlement::where('user_id', $buyer->id)->where('is_active', true)->count());
    }

    public function test_an_unknown_exam_category_is_rejected(): void
    {
        $this->asAdmin()->postJson('/api/admin/products', [
            'type' => 'course',
            'title' => 'X',
            'exam_category' => 'Hogwarts',
            'price_paise' => 1000,
            'items' => [['kind' => 'course', 'id' => $this->course->id]],
        ])->assertStatus(422)->assertJsonValidationErrors('exam_category');
    }

    public function test_a_student_cannot_reach_the_admin_product_routes(): void
    {
        $student = User::factory()->create();
        $student->assignRole('student');

        $this->actingAs($student)->getJson('/api/admin/products')->assertStatus(403);
        $this->actingAs($student)->postJson('/api/admin/products', [])->assertStatus(403);
    }

    public function test_duplicate_titles_get_distinct_slugs(): void
    {
        foreach ([1, 2] as $_) {
            $this->asAdmin()->postJson('/api/admin/products', [
                'type' => 'course',
                'title' => 'SSC CGL 2026',
                'exam_category' => 'SSC',
                'price_paise' => 1000,
                'items' => [['kind' => 'course', 'id' => $this->course->id]],
            ])->assertStatus(201);
        }

        $this->assertSame(2, Product::where('title', 'SSC CGL 2026')->count());
        $this->assertSame(2, Product::where('title', 'SSC CGL 2026')->distinct()->count('slug'));
    }
}
