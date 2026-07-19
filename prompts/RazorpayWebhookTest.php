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

    protected function makePayment(string $orderId = 'order_webhook_1'): Payment
    {
        $student = User::factory()->create(['role' => 'student']);
        $course = Course::factory()->create();
        $batch = Batch::factory()->create([
            'course_id' => $course->id,
            'price_paise' => 99900,
            'is_active' => true,
        ]);

        return Payment::factory()->create([
            'user_id' => $student->id,
            'batch_id' => $batch->id,
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
