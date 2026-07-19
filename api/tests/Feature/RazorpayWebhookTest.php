<?php

namespace Tests\Feature;

use App\Models\Batch;
use App\Models\Course;
use App\Models\Payment;
use App\Models\User;
use App\Services\RazorpayService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RazorpayWebhookTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);
    }

    protected function makePayment(string $orderId = 'order_webhook_1'): Payment
    {
        $student = User::factory()->create();
        $student->assignRole('student');
        
        $course = Course::create([
            'title' => 'Test Course ' . uniqid(),
            'slug' => 'test-course-' . uniqid(),
            'exam_category' => 'SSC',
            'mode' => 'online',
            'is_published' => true,
        ]);
        
        $batch = Batch::create([
            'course_id' => $course->id,
            'name' => 'Test Batch ' . uniqid(),
            'price_paise' => 99900,
            'is_active' => true,
        ]);

        return Payment::create([
            'user_id' => $student->id,
            'batch_id' => $batch->id,
            'course_id' => $course->id,
            'amount' => 99900,
            'status' => 'created',
            'razorpay_order_id' => $orderId,
        ]);
    }

    protected function capturedPayload(string $orderId, string $paymentId = 'pay_webhook_1'): array
    {
        return [
            'event' => 'payment.captured',
            'payload' => [
                'payment' => [
                    'entity' => [
                        'id' => $paymentId,
                        'order_id' => $orderId,
                    ],
                ],
            ],
        ];
    }

    public function test_webhook_payment_captured_enrolls_student(): void
    {
        $payment = $this->makePayment();

        $this->mock(RazorpayService::class, function ($mock) {
            $mock->shouldReceive('verifyWebhookSignature')->andReturn(true);
        });

        $response = $this->postJson(
            '/api/webhooks/razorpay',
            $this->capturedPayload('order_webhook_1'),
            ['X-Razorpay-Signature' => 'valid_sig'],
        );

        $response->assertOk();
        $this->assertDatabaseHas('payments', ['id' => $payment->id, 'status' => 'paid']);
        $this->assertDatabaseHas('enrollments', ['payment_id' => $payment->id]);
    }

    public function test_webhook_is_idempotent_on_duplicate_events(): void
    {
        $this->makePayment();

        $this->mock(RazorpayService::class, function ($mock) {
            $mock->shouldReceive('verifyWebhookSignature')->andReturn(true);
        });

        $payload = $this->capturedPayload('order_webhook_1');

        $this->postJson('/api/webhooks/razorpay', $payload, ['X-Razorpay-Signature' => 'valid_sig'])
            ->assertOk();
        $this->postJson('/api/webhooks/razorpay', $payload, ['X-Razorpay-Signature' => 'valid_sig'])
            ->assertOk();

        $this->assertDatabaseCount('enrollments', 1);
    }

    public function test_webhook_rejects_invalid_signature(): void
    {
        $payment = $this->makePayment();

        $this->mock(RazorpayService::class, function ($mock) {
            $mock->shouldReceive('verifyWebhookSignature')->andReturn(false);
        });

        $response = $this->postJson(
            '/api/webhooks/razorpay',
            $this->capturedPayload('order_webhook_1'),
            ['X-Razorpay-Signature' => 'tampered'],
        );

        $response->assertStatus(400);
        $this->assertDatabaseHas('payments', ['id' => $payment->id, 'status' => 'created']);
        $this->assertDatabaseMissing('enrollments', ['payment_id' => $payment->id]);
    }
}
