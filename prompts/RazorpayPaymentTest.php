<?php

namespace Tests\Feature;

use App\Models\Batch;
use App\Models\Coupon;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Payment;
use App\Models\Setting;
use App\Models\User;
use App\Services\RazorpayService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * ASSUMPTIONS — reconcile against your actual factories/schema:
 * - User factory + 'role' column; role:student middleware checks it
 * - Course, Batch, Coupon, Enrollment, Payment, Setting factories exist
 * - Setting: key/value string columns
 * - Batch: price_paise, is_active, max_students, ends_at, course_id
 * - Coupon: code, discount_type ('percentage'|'fixed'), discount_value,
 *   valid_until, times_used, ->isValid(), ->calculateDiscount($price)
 * - Payment: user_id, batch_id, coupon_id, amount, status, razorpay_order_id
 * - Enrollment: user_id, batch_id, payment_id, is_active, enrolled_at, expires_at
 *
 * If your route prefix differs from /api/student/checkout/*, update the
 * URLs below to match routes/api.php.
 */
class RazorpayPaymentTest extends TestCase
{
    use RefreshDatabase;

    protected function enablePaymentGateway(bool $enabled = true): void
    {
        Setting::updateOrCreate(
            ['key' => 'payment_gateway_enabled'],
            ['value' => $enabled ? 'true' : 'false'],
        );
    }

    protected function priceBatch(?int $pricePaise = 99900, array $overrides = []): Batch
    {
        $course = Course::factory()->create();

        return Batch::factory()->create(array_merge([
            'course_id' => $course->id,
            'price_paise' => $pricePaise,
            'is_active' => true,
        ], $overrides));
    }

    protected function student(): User
    {
        return User::factory()->create(['role' => 'student']);
    }

    public function test_create_order_returns_razorpay_order_data(): void
    {
        $this->enablePaymentGateway();
        $student = $this->student();
        $batch = $this->priceBatch();

        $this->mock(RazorpayService::class, function ($mock) {
            $mock->shouldReceive('createOrder')->once()->andReturn(['id' => 'order_test123']);
        });

        $response = $this->actingAs($student)
            ->postJson('/api/student/checkout/create-order', ['batch_id' => $batch->id]);

        $response->assertOk()
            ->assertJsonStructure(['order_id', 'razorpay_key', 'amount', 'currency', 'payment_id']);

        $this->assertDatabaseHas('payments', [
            'razorpay_order_id' => 'order_test123',
            'status' => 'created',
        ]);
    }

    public function test_create_order_blocked_when_payment_gateway_disabled(): void
    {
        $this->enablePaymentGateway(false);
        $student = $this->student();
        $batch = $this->priceBatch();

        $response = $this->actingAs($student)
            ->postJson('/api/student/checkout/create-order', ['batch_id' => $batch->id]);

        $response->assertStatus(403);
    }

    public function test_create_order_rejects_null_price_batch(): void
    {
        $this->enablePaymentGateway();
        $student = $this->student();
        $batch = $this->priceBatch(null);

        $response = $this->actingAs($student)
            ->postJson('/api/student/checkout/create-order', ['batch_id' => $batch->id]);

        $response->assertStatus(422)
            ->assertJsonFragment(['message' => 'This batch is not available for online purchase.']);
    }

    public function test_create_order_rejects_already_enrolled_student(): void
    {
        $this->enablePaymentGateway();
        $student = $this->student();
        $batch = $this->priceBatch();

        Enrollment::factory()->create([
            'user_id' => $student->id,
            'batch_id' => $batch->id,
            'is_active' => true,
        ]);

        $response = $this->actingAs($student)
            ->postJson('/api/student/checkout/create-order', ['batch_id' => $batch->id]);

        $response->assertStatus(409);
    }

    public function test_coupon_applies_percentage_discount(): void
    {
        $this->enablePaymentGateway();
        $student = $this->student();
        $batch = $this->priceBatch(100000);
        $coupon = Coupon::factory()->create([
            'code' => 'SAVE20',
            'discount_type' => 'percentage',
            'discount_value' => 20,
            'valid_until' => now()->addDays(10),
        ]);

        $this->mock(RazorpayService::class, function ($mock) {
            $mock->shouldReceive('createOrder')->once()->andReturn(['id' => 'order_test123']);
        });

        $response = $this->actingAs($student)->postJson('/api/student/checkout/create-order', [
            'batch_id' => $batch->id,
            'coupon_code' => 'SAVE20',
        ]);

        $response->assertOk()->assertJson(['amount' => 80000]);
        $this->assertDatabaseHas('payments', ['coupon_id' => $coupon->id, 'amount' => 80000]);
    }

    public function test_coupon_applies_fixed_discount(): void
    {
        $this->enablePaymentGateway();
        $student = $this->student();
        $batch = $this->priceBatch(100000);
        Coupon::factory()->create([
            'code' => 'FLAT200',
            'discount_type' => 'fixed',
            'discount_value' => 20000, // ₹200 in paise
            'valid_until' => now()->addDays(10),
        ]);

        $this->mock(RazorpayService::class, function ($mock) {
            $mock->shouldReceive('createOrder')->once()->andReturn(['id' => 'order_test123']);
        });

        $response = $this->actingAs($student)->postJson('/api/student/checkout/create-order', [
            'batch_id' => $batch->id,
            'coupon_code' => 'FLAT200',
        ]);

        $response->assertOk()->assertJson(['amount' => 80000]);
    }

    public function test_expired_coupon_rejected(): void
    {
        $this->enablePaymentGateway();
        $student = $this->student();
        $batch = $this->priceBatch();
        Coupon::factory()->create([
            'code' => 'OLDCODE',
            'valid_until' => now()->subDay(),
        ]);

        $response = $this->actingAs($student)->postJson('/api/student/checkout/create-order', [
            'batch_id' => $batch->id,
            'coupon_code' => 'OLDCODE',
        ]);

        $response->assertStatus(422)
            ->assertJsonFragment(['message' => 'This coupon is no longer valid.']);
    }

    public function test_full_discount_coupon_skips_razorpay_and_enrolls(): void
    {
        $this->enablePaymentGateway();
        $student = $this->student();
        $batch = $this->priceBatch(50000);
        Coupon::factory()->create([
            'code' => 'FREE100',
            'discount_type' => 'percentage',
            'discount_value' => 100,
            'valid_until' => now()->addDays(10),
        ]);

        $this->mock(RazorpayService::class, function ($mock) {
            $mock->shouldNotReceive('createOrder');
        });

        $response = $this->actingAs($student)->postJson('/api/student/checkout/create-order', [
            'batch_id' => $batch->id,
            'coupon_code' => 'FREE100',
        ]);

        $response->assertOk()->assertJson(['enrolled' => true]);
        $this->assertDatabaseHas('payments', ['status' => 'paid', 'amount' => 0]);
        $this->assertDatabaseHas('enrollments', [
            'user_id' => $student->id,
            'batch_id' => $batch->id,
            'is_active' => true,
        ]);
    }

    public function test_verify_payment_enrolls_student(): void
    {
        $student = $this->student();
        $batch = $this->priceBatch();
        $coupon = Coupon::factory()->create(['times_used' => 0]);
        $payment = Payment::factory()->create([
            'user_id' => $student->id,
            'batch_id' => $batch->id,
            'coupon_id' => $coupon->id,
            'status' => 'created',
            'razorpay_order_id' => 'order_abc',
        ]);

        $this->mock(RazorpayService::class, function ($mock) {
            $mock->shouldReceive('verifyPaymentSignature')->once();
        });

        $response = $this->actingAs($student)->postJson('/api/student/checkout/verify', [
            'razorpay_order_id' => 'order_abc',
            'razorpay_payment_id' => 'pay_abc',
            'razorpay_signature' => 'sig_abc',
        ]);

        $response->assertOk()->assertJson(['enrolled' => true]);
        $this->assertDatabaseHas('payments', ['id' => $payment->id, 'status' => 'paid']);
        $this->assertDatabaseHas('enrollments', ['payment_id' => $payment->id, 'user_id' => $student->id]);
        $this->assertEquals(1, $coupon->fresh()->times_used);
    }

    public function test_verify_payment_rejects_invalid_signature(): void
    {
        $student = $this->student();
        $batch = $this->priceBatch();
        $payment = Payment::factory()->create([
            'user_id' => $student->id,
            'batch_id' => $batch->id,
            'status' => 'created',
            'razorpay_order_id' => 'order_bad',
        ]);

        $this->mock(RazorpayService::class, function ($mock) {
            $mock->shouldReceive('verifyPaymentSignature')
                ->once()
                ->andThrow(new \Exception('Invalid signature'));
        });

        $response = $this->actingAs($student)->postJson('/api/student/checkout/verify', [
            'razorpay_order_id' => 'order_bad',
            'razorpay_payment_id' => 'pay_bad',
            'razorpay_signature' => 'tampered',
        ]);

        $response->assertStatus(400);
        $this->assertDatabaseHas('payments', ['id' => $payment->id, 'status' => 'created']);
        $this->assertDatabaseMissing('enrollments', ['payment_id' => $payment->id]);
    }

    public function test_batch_capacity_check_on_payment(): void
    {
        $student = $this->student();
        $batch = $this->priceBatch(99900, ['max_students' => 1]);

        $otherStudent = $this->student();
        Enrollment::factory()->create([
            'user_id' => $otherStudent->id,
            'batch_id' => $batch->id,
            'is_active' => true,
        ]);

        $payment = Payment::factory()->create([
            'user_id' => $student->id,
            'batch_id' => $batch->id,
            'status' => 'created',
            'razorpay_order_id' => 'order_full',
        ]);

        $this->mock(RazorpayService::class, function ($mock) {
            $mock->shouldReceive('verifyPaymentSignature')->once();
        });

        $response = $this->actingAs($student)->postJson('/api/student/checkout/verify', [
            'razorpay_order_id' => 'order_full',
            'razorpay_payment_id' => 'pay_full',
            'razorpay_signature' => 'sig_full',
        ]);

        $response->assertStatus(422)
            ->assertJsonFragment(['message' => 'This batch has reached its maximum student capacity.']);
    }
}
