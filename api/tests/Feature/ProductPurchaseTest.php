<?php

namespace Tests\Feature;

use App\Models\Batch;
use App\Models\Course;
use App\Models\Coupon;
use App\Models\Entitlement;
use App\Models\Enrollment;
use App\Models\Payment;
use App\Models\Product;
use App\Models\ProductItem;
use App\Models\Setting;
use App\Models\Test;
use App\Models\TestSeries;
use App\Models\User;
use App\Services\PaymentEnrollmentService;
use App\Services\RazorpayService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Buying a course, a test series, or a bundle of both.
 *
 * The point of the product rail is that a test series can be sold on its own —
 * previously impossible, because payments and enrollments both required a batch.
 */
class ProductPurchaseTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);

        Setting::updateOrCreate(['key' => 'payment_gateway_enabled'], ['value' => 'true']);
    }

    public function test_a_test_series_can_be_sold_without_any_course(): void
    {
        $student = $this->student();
        $series = $this->series();
        $product = $this->product(Product::TYPE_TEST_SERIES, [['kind' => 'test_series', 'model' => $series]]);

        $payment = $this->pay($student, $product);

        $this->assertDatabaseHas('entitlements', [
            'user_id' => $student->id,
            'grantable_type' => TestSeries::class,
            'grantable_id' => $series->id,
            'source' => Entitlement::SOURCE_PAYMENT,
            'is_active' => true,
        ]);

        // The thing that was impossible before: a paid purchase with no batch.
        $this->assertNull($payment->fresh()->batch_id);
        $this->assertSame('paid', $payment->fresh()->status);
    }

    public function test_buying_a_course_product_also_places_the_student_in_a_cohort(): void
    {
        $student = $this->student();
        $course = $this->course();
        $batch = Batch::create(['course_id' => $course->id, 'name' => 'Batch A', 'is_active' => true]);

        $product = $this->product(Product::TYPE_COURSE, [['kind' => 'course', 'model' => $course]]);
        $this->pay($student, $product);

        $this->assertDatabaseHas('entitlements', [
            'user_id' => $student->id,
            'grantable_type' => Course::class,
            'grantable_id' => $course->id,
        ]);

        // Batch capacity, cohort analytics and the LMS all still read enrollments.
        $this->assertDatabaseHas('enrollments', [
            'user_id' => $student->id,
            'course_id' => $course->id,
            'batch_id' => $batch->id,
            'is_active' => true,
        ]);
    }

    public function test_a_bundle_grants_every_item_it_contains(): void
    {
        $student = $this->student();
        $course = $this->course();
        Batch::create(['course_id' => $course->id, 'name' => 'B', 'is_active' => true]);
        $seriesA = $this->series('Prelims Series');
        $seriesB = $this->series('Mains Series');

        $product = $this->product(Product::TYPE_BUNDLE, [
            ['kind' => 'course', 'model' => $course],
            ['kind' => 'test_series', 'model' => $seriesA],
            ['kind' => 'test_series', 'model' => $seriesB],
        ]);

        $this->pay($student, $product);

        $this->assertSame(3, Entitlement::where('user_id', $student->id)->count());
    }

    public function test_an_overlapping_bundle_never_shortens_access_already_paid_for(): void
    {
        $student = $this->student();
        $series = $this->series();

        // A perpetual grant first...
        $perpetual = $this->product(Product::TYPE_TEST_SERIES, [['kind' => 'test_series', 'model' => $series]], [
            'access_days' => null,
        ]);
        $this->pay($student, $perpetual);

        // ...then a 30-day bundle containing the same series.
        $shortBundle = $this->product(Product::TYPE_BUNDLE, [['kind' => 'test_series', 'model' => $series]], [
            'access_days' => 30,
        ]);
        $this->pay($student, $shortBundle);

        $entitlement = Entitlement::where('user_id', $student->id)
            ->where('grantable_id', $series->id)
            ->firstOrFail();

        $this->assertNull($entitlement->expires_at, 'perpetual access must not be downgraded to 30 days');
        $this->assertSame(1, Entitlement::where('user_id', $student->id)->count(), 'no duplicate rows');
    }

    public function test_access_days_sets_an_expiry(): void
    {
        $student = $this->student();
        $series = $this->series();
        $product = $this->product(Product::TYPE_TEST_SERIES, [['kind' => 'test_series', 'model' => $series]], [
            'access_days' => 365,
        ]);

        $this->pay($student, $product);

        $entitlement = Entitlement::where('user_id', $student->id)->firstOrFail();
        $this->assertNotNull($entitlement->expires_at);
        $this->assertEqualsWithDelta(365, now()->diffInDays($entitlement->expires_at), 1);
    }

    public function test_an_entitled_series_unlocks_its_tests(): void
    {
        $student = $this->student();
        $series = $this->series();
        $test = $this->testInSeries($series);

        $this->actingAs($student)
            ->postJson("/api/student/tests/{$test->id}/start")
            ->assertStatus(403);

        $product = $this->product(Product::TYPE_TEST_SERIES, [['kind' => 'test_series', 'model' => $series]]);
        $this->pay($student, $product);

        $this->actingAs($student)
            ->postJson("/api/student/tests/{$test->id}/start")
            ->assertStatus(200);
    }

    public function test_the_library_lists_everything_the_student_holds(): void
    {
        $student = $this->student();
        $course = $this->course();
        Batch::create(['course_id' => $course->id, 'name' => 'B', 'is_active' => true]);
        $series = $this->series();

        $product = $this->product(Product::TYPE_BUNDLE, [
            ['kind' => 'course', 'model' => $course],
            ['kind' => 'test_series', 'model' => $series],
        ]);
        $this->pay($student, $product);

        $response = $this->actingAs($student)->getJson('/api/student/library')->assertStatus(200);

        $this->assertSame(2, $response->json('total'));
        $this->assertSame($course->id, $response->json('courses.0.id'));
        $this->assertSame($series->id, $response->json('test_series.0.id'));
    }

    public function test_the_store_marks_what_the_student_already_owns(): void
    {
        $student = $this->student();
        $series = $this->series();
        $product = $this->product(Product::TYPE_TEST_SERIES, [['kind' => 'test_series', 'model' => $series]]);
        $product->update(['is_published' => true]);

        $before = $this->actingAs($student)->getJson('/api/student/store')->json('products.0.owned');
        $this->assertFalse($before);

        $this->pay($student, $product);

        $after = $this->actingAs($student)->getJson('/api/student/store')->json('products.0.owned');
        $this->assertTrue($after);
    }

    public function test_buying_something_already_fully_owned_is_refused(): void
    {
        $student = $this->student();
        $series = $this->series();
        $product = $this->product(Product::TYPE_TEST_SERIES, [['kind' => 'test_series', 'model' => $series]]);
        $product->update(['is_published' => true]);

        $this->pay($student, $product);

        $this->actingAs($student)
            ->postJson('/api/student/checkout/product/create-order', ['product_id' => $product->id])
            ->assertStatus(409);
    }

    public function test_an_unpublished_or_empty_product_cannot_be_bought(): void
    {
        $student = $this->student();
        $series = $this->series();

        $draft = $this->product(Product::TYPE_TEST_SERIES, [['kind' => 'test_series', 'model' => $series]]);
        $this->actingAs($student)
            ->postJson('/api/student/checkout/product/create-order', ['product_id' => $draft->id])
            ->assertStatus(422);

        $empty = Product::create([
            'type' => Product::TYPE_BUNDLE,
            'title' => 'Empty Bundle',
            'exam_category' => 'SSC',
            'price_paise' => 10000,
            'is_published' => true,
        ]);

        $this->actingAs($student)
            ->postJson('/api/student/checkout/product/create-order', ['product_id' => $empty->id])
            ->assertStatus(422);
    }

    public function test_a_full_refund_withdraws_the_entitlements_it_granted(): void
    {
        $student = $this->student();
        $series = $this->series();
        $test = $this->testInSeries($series);
        $product = $this->product(Product::TYPE_TEST_SERIES, [['kind' => 'test_series', 'model' => $series]]);

        $payment = $this->pay($student, $product);
        $payment->update(['razorpay_payment_id' => 'pay_' . uniqid()]);

        $this->mock(RazorpayService::class, function ($mock) {
            $mock->shouldReceive('refund')->once()->andReturn(['id' => 'rfnd_1']);
        });

        $admin = User::factory()->create();
        $admin->assignRole('admin');
        $admin->update(['google2fa_enabled' => true, 'google2fa_secret' => 'B39XKJ2938JJD982']);

        $this->actingAs($admin)->withSession(['2fa_verified' => true])
            ->postJson("/api/admin/payments/{$payment->id}/refund")
            ->assertStatus(200);

        $this->assertDatabaseHas('entitlements', [
            'payment_id' => $payment->id,
            'is_active' => false,
        ]);

        $this->actingAs($student)
            ->postJson("/api/student/tests/{$test->id}/start")
            ->assertStatus(403);
    }

    public function test_a_receipt_for_a_series_names_the_series_not_a_course(): void
    {
        $student = $this->student();
        $series = $this->series('SSC CGL Prelims Series');
        $product = $this->product(Product::TYPE_TEST_SERIES, [['kind' => 'test_series', 'model' => $series]], [
            'title' => 'SSC CGL Prelims Series 2026',
        ]);

        $payment = $this->pay($student, $product);

        $this->assertDatabaseHas('invoices', [
            'payment_id' => $payment->id,
            'description' => 'SSC CGL Prelims Series 2026',
        ]);
    }

    public function test_a_hundred_percent_coupon_grants_without_a_gateway_call(): void
    {
        $student = $this->student();
        $series = $this->series();
        $product = $this->product(Product::TYPE_TEST_SERIES, [['kind' => 'test_series', 'model' => $series]]);
        $product->update(['is_published' => true, 'price_paise' => 50000]);

        Coupon::create([
            'code' => 'FREE100',
            'discount_type' => 'percentage',
            'discount_value' => 100,
            'is_active' => true,
        ]);

        // No RazorpayService mock: reaching the gateway at all would fail here,
        // which is the assertion.
        $this->actingAs($student)
            ->postJson('/api/student/checkout/product/create-order', [
                'product_id' => $product->id,
                'coupon_code' => 'FREE100',
            ])
            ->assertStatus(200)
            ->assertJsonPath('granted', true);

        $this->assertDatabaseHas('entitlements', [
            'user_id' => $student->id,
            'grantable_id' => $series->id,
        ]);
    }

    // ── helpers ─────────────────────────────────────────────────────────────

    private function student(): User
    {
        $user = User::factory()->create();
        $user->assignRole('student');

        return $user;
    }

    private function course(string $title = 'SSC CGL Master Class'): Course
    {
        return Course::create([
            'title' => $title,
            'slug' => \Illuminate\Support\Str::slug($title) . '-' . uniqid(),
            'description' => 'Description',
            'exam_category' => 'SSC',
            'mode' => 'online',
            'is_published' => true,
        ]);
    }

    private function series(string $title = 'SSC CGL Test Series'): TestSeries
    {
        return TestSeries::create([
            'title' => $title,
            'slug' => \Illuminate\Support\Str::slug($title) . '-' . uniqid(),
            'exam_category' => 'SSC',
            'is_published' => true,
            'created_by' => User::factory()->create()->id,
        ]);
    }

    private function product(string $type, array $items, array $overrides = []): Product
    {
        $product = Product::create(array_merge([
            'type' => $type,
            'title' => ucfirst($type) . ' ' . uniqid(),
            'exam_category' => 'SSC',
            'price_paise' => 99900,
            'is_published' => false,
        ], $overrides));

        foreach ($items as $index => $item) {
            ProductItem::create([
                'product_id' => $product->id,
                'grantable_type' => $item['kind'] === 'course' ? Course::class : TestSeries::class,
                'grantable_id' => $item['model']->id,
                'sort_order' => $index,
            ]);
        }

        return $product->fresh();
    }

    /**
     * Drive a purchase all the way through the shared confirm-and-grant service,
     * the same path the Razorpay verify call and the webhook both take.
     */
    private function pay(User $student, Product $product): Payment
    {
        $payment = Payment::create([
            'user_id' => $student->id,
            'product_id' => $product->id,
            'amount' => $product->price_paise,
            'status' => 'created',
            'razorpay_order_id' => 'order_' . uniqid(),
        ]);

        app(PaymentEnrollmentService::class)->confirmAndEnroll($payment->id);

        return $payment->fresh();
    }

    private function testInSeries(TestSeries $series): Test
    {
        $admin = User::factory()->create();

        $test = Test::create([
            'title' => 'Mock 1',
            'type' => 'mock',
            'duration_seconds' => 3600,
            'total_marks' => 2,
            'is_published' => true,
            'created_by' => $admin->id,
            'test_series_id' => $series->id,
        ]);

        $section = \App\Models\TestSection::create([
            'test_id' => $test->id,
            'title' => 'S1',
            'sort_order' => 0,
        ]);

        $question = \App\Models\Question::create([
            'subject' => 'Reasoning',
            'topic' => 'Series',
            'difficulty' => 'easy',
            'question_text' => 'Next?',
            'marks' => 2,
            'negative_marks' => 0.5,
            'is_active' => true,
            'created_by' => $admin->id,
        ]);

        \App\Models\QuestionOption::create([
            'question_id' => $question->id,
            'label' => 'a',
            'option_text' => '10',
            'is_correct' => true,
            'sort_order' => 0,
        ]);

        \App\Models\TestSectionQuestion::create([
            'test_section_id' => $section->id,
            'question_id' => $question->id,
            'sort_order' => 0,
        ]);

        return $test->fresh();
    }
}
