<?php

namespace Tests\Feature;

use App\Jobs\SendConversionEvents;
use App\Models\Batch;
use App\Models\Course;
use App\Models\Payment;
use App\Models\User;
use App\Services\ConversionTrackingService;
use App\Services\RazorpayService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class ConversionTrackingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);
    }

    protected function makePayment(): Payment
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
            'razorpay_order_id' => 'order_abc',
            'event_id' => 'evt_12345',
        ]);
    }

    public function test_successful_payment_dispatches_conversion_job(): void
    {
        Queue::fake();

        $payment = $this->makePayment();

        $this->mock(RazorpayService::class, function ($mock) {
            $mock->shouldReceive('verifyPaymentSignature')->once();
        });

        $response = $this->actingAs($payment->user)->postJson('/api/student/checkout/verify', [
            'razorpay_order_id' => 'order_abc',
            'razorpay_payment_id' => 'pay_abc',
            'razorpay_signature' => 'sig_abc',
        ]);

        $response->assertOk();

        Queue::assertPushed(SendConversionEvents::class, function ($job) use ($payment) {
            return $job->payment->id === $payment->id;
        });
    }

    public function test_conversion_tracking_service_handles_missing_credentials_gracefully(): void
    {
        config(['services.meta.pixel_id' => null]);
        config(['services.meta.capi_access_token' => null]);
        config(['services.ga4.measurement_id' => null]);
        config(['services.ga4.api_secret' => null]);

        Http::fake();

        $payment = $this->makePayment();

        $service = new ConversionTrackingService();
        $service->sendMetaPurchaseEvent($payment);
        $service->sendGa4PurchaseEvent($payment);

        Http::assertNothingSent();
    }

    public function test_conversion_tracking_service_sends_payload_correctly(): void
    {
        config(['services.meta.pixel_id' => 'pixel_123']);
        config(['services.meta.capi_access_token' => 'token_123']);
        config(['services.ga4.measurement_id' => 'ga_123']);
        config(['services.ga4.api_secret' => 'secret_123']);

        Http::fake([
            'graph.facebook.com/*' => Http::response(['success' => true]),
            'google-analytics.com/*' => Http::response(['status' => 'ok']),
        ]);

        $payment = $this->makePayment();

        $service = new ConversionTrackingService();
        $service->sendMetaPurchaseEvent($payment);
        $service->sendGa4PurchaseEvent($payment);

        Http::assertSent(function ($request) {
            return str_contains($request->url(), 'graph.facebook.com/v19.0/pixel_123/events') &&
                   $request['access_token'] === 'token_123' &&
                   $request['data'][0]['event_id'] === 'evt_12345';
        });

        Http::assertSent(function ($request) {
            return str_contains($request->url(), 'google-analytics.com/mp/collect?measurement_id=ga_123&api_secret=secret_123') &&
                   $request['events'][0]['params']['event_id'] === 'evt_12345';
        });
    }
}
