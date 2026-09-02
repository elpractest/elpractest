<?php

namespace Tests\Feature;

use App\Models\Batch;
use App\Models\Coupon;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Setting;
use App\Models\User;
use App\Services\InvoiceService;
use App\Services\PaymentEnrollmentService;
use App\Services\RazorpayService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Phase 2 — receipts/tax invoices, admin-initiated refunds, and the per-user
 * coupon cap.
 */
class InvoiceAndRefundTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);
        $this->seed(\Database\Seeders\DefaultSettingsSeeder::class);
    }

    private function student(): User
    {
        $user = User::factory()->create();
        $user->assignRole('student');
        return $user;
    }

    private function admin(): User
    {
        $user = User::factory()->create(['google2fa_enabled' => true, 'google2fa_secret' => 'LUTWUXK6K5F5GDZ6']);
        $user->assignRole('admin');
        return $user;
    }

    private function actingAsAdmin(User $admin): self
    {
        $this->actingAs($admin);
        session(['2fa_verified' => true]);
        return $this;
    }

    private function batch(int $pricePaise = 99900): Batch
    {
        $course = Course::create([
            'title' => 'SSC CGL ' . uniqid(), 'slug' => 'ssc-' . uniqid(),
            'exam_category' => 'SSC', 'is_published' => true,
        ]);

        return Batch::create([
            'course_id' => $course->id, 'name' => 'Batch A',
            'price_paise' => $pricePaise, 'is_active' => true,
        ]);
    }

    private function paidPayment(User $user, ?Batch $batch = null, int $amount = 99900, array $overrides = []): Payment
    {
        $batch ??= $this->batch($amount);

        return Payment::create(array_merge([
            'user_id' => $user->id,
            'course_id' => $batch->course_id,
            'batch_id' => $batch->id,
            'amount' => $amount,
            'status' => 'paid',
            'razorpay_payment_id' => 'pay_' . uniqid(),
        ], $overrides));
    }

    private function setGstin(string $gstin = '29ABCDE1234F1Z5', string $rate = '18'): void
    {
        Setting::where('key', 'invoice_gstin')->update(['value' => $gstin]);
        Setting::where('key', 'invoice_gst_rate')->update(['value' => $rate]);
        Setting::where('key', 'invoice_seller_name')->update(['value' => 'Thevi Institution']);
    }

    // ── Invoice issuing ──────────────────────────────────────────────────

    public function test_without_a_gstin_it_issues_a_plain_receipt_with_no_tax_lines(): void
    {
        $payment = $this->paidPayment($this->student());

        $invoice = app(InvoiceService::class)->issueFor($payment);

        $this->assertNotNull($invoice);
        $this->assertFalse($invoice->is_tax_invoice);
        $this->assertSame(0, (int) $invoice->cgst_paise);
        $this->assertSame(0, (int) $invoice->sgst_paise);
        // With no tax, the whole amount is the taxable value.
        $this->assertSame(99900, (int) $invoice->taxable_paise);
        $this->assertSame(99900, (int) $invoice->total_paise);
    }

    public function test_with_a_gstin_it_issues_a_tax_invoice_splitting_gst_out_of_the_charged_amount(): void
    {
        $this->setGstin();
        $payment = $this->paidPayment($this->student(), null, 118000); // ₹1180 incl. 18%

        $invoice = app(InvoiceService::class)->issueFor($payment);

        $this->assertTrue($invoice->is_tax_invoice);
        // GST is INCLUSIVE: ₹1180 total = ₹1000 taxable + ₹180 tax.
        $this->assertSame(100000, (int) $invoice->taxable_paise);
        $this->assertSame(9000, (int) $invoice->cgst_paise);
        $this->assertSame(9000, (int) $invoice->sgst_paise);
        // The parts must reconstruct the charged total exactly.
        $this->assertSame(
            (int) $invoice->total_paise,
            (int) $invoice->taxable_paise + (int) $invoice->cgst_paise + (int) $invoice->sgst_paise
        );
    }

    public function test_odd_paise_in_the_tax_split_still_reconciles_to_the_exact_total(): void
    {
        $this->setGstin();
        // A price chosen so the tax is an odd number of paise.
        $payment = $this->paidPayment($this->student(), null, 99901);

        $invoice = app(InvoiceService::class)->issueFor($payment);

        $this->assertSame(
            (int) $invoice->total_paise,
            (int) $invoice->taxable_paise + (int) $invoice->cgst_paise + (int) $invoice->sgst_paise,
            'CGST + SGST + taxable must equal the amount actually charged.'
        );
    }

    public function test_issuing_is_idempotent_so_verify_and_webhook_cannot_double_invoice(): void
    {
        $payment = $this->paidPayment($this->student());
        $service = app(InvoiceService::class);

        $first = $service->issueFor($payment);
        $second = $service->issueFor($payment->fresh());

        $this->assertSame($first->id, $second->id);
        $this->assertSame(1, Invoice::where('payment_id', $payment->id)->count());
    }

    public function test_invoice_numbers_are_sequential_within_the_financial_year(): void
    {
        $service = app(InvoiceService::class);
        $fy = $service->financialYear();

        $a = $service->issueFor($this->paidPayment($this->student()));
        $b = $service->issueFor($this->paidPayment($this->student()));
        $c = $service->issueFor($this->paidPayment($this->student()));

        $this->assertSame([1, 2, 3], [$a->sequence, $b->sequence, $c->sequence]);
        $this->assertSame("INV/{$fy}/0001", $a->invoice_number);
        $this->assertSame("INV/{$fy}/0003", $c->invoice_number);
    }

    public function test_financial_year_runs_april_to_march(): void
    {
        $service = app(InvoiceService::class);

        $this->assertSame('2026-27', $service->financialYear(new \DateTime('2026-04-01')));
        $this->assertSame('2026-27', $service->financialYear(new \DateTime('2027-03-31')));
        $this->assertSame('2025-26', $service->financialYear(new \DateTime('2026-03-31')));
    }

    public function test_a_free_enrolment_gets_no_invoice_number(): void
    {
        $payment = $this->paidPayment($this->student(), null, 0);

        $this->assertNull(app(InvoiceService::class)->issueFor($payment));
        $this->assertSame(0, Invoice::count());
    }

    public function test_an_unpaid_payment_gets_no_invoice(): void
    {
        $payment = $this->paidPayment($this->student(), null, 99900, ['status' => 'created']);

        $this->assertNull(app(InvoiceService::class)->issueFor($payment));
    }

    public function test_a_capture_produces_an_invoice_through_the_enrolment_service(): void
    {
        $this->setGstin();
        $student = $this->student();
        $batch = $this->batch();
        $payment = $this->paidPayment($student, $batch, 99900, ['status' => 'created']);

        $result = app(PaymentEnrollmentService::class)->confirmAndEnroll($payment->id, 'pay_capture123');

        $this->assertFalse($result['already_processed']);
        $this->assertNotNull($result['invoice']);
        $this->assertSame('paid', $result['payment']->status);
    }

    // ── Student access ───────────────────────────────────────────────────

    public function test_a_student_sees_their_own_invoices_and_can_open_one(): void
    {
        $student = $this->student();
        $invoice = app(InvoiceService::class)->issueFor($this->paidPayment($student));

        $this->actingAs($student)->getJson('/api/student/invoices')
            ->assertOk()
            ->assertJsonPath('invoices.0.invoice_number', $invoice->invoice_number);

        $this->actingAs($student)->get("/api/student/invoices/{$invoice->id}")
            ->assertOk()
            ->assertSee($invoice->invoice_number)
            ->assertSee('Payment Receipt');
    }

    /**
     * REGRESSION: the app-wide CSP is `default-src 'none'`, which is right for
     * a JSON API but silently blocks the invoice's own <style> block — the
     * document rendered as unstyled plain text with no error anywhere except
     * the browser console. The route sets its own nonce-based policy instead of
     * the global one being loosened.
     */
    public function test_the_invoice_page_ships_a_nonce_csp_that_allows_its_own_styles(): void
    {
        $student = $this->student();
        $invoice = app(InvoiceService::class)->issueFor($this->paidPayment($student));

        $response = $this->actingAs($student)->get("/api/student/invoices/{$invoice->id}");
        $response->assertOk();

        $csp = $response->headers->get('Content-Security-Policy');
        $this->assertNotNull($csp);
        $this->assertMatchesRegularExpression("/style-src 'nonce-[^']+'/", $csp);
        $this->assertMatchesRegularExpression("/script-src 'nonce-[^']+'/", $csp);
        $this->assertStringContainsString("frame-ancestors 'none'", $csp);

        // The nonce in the header must be the one actually on the <style> tag,
        // or the browser blocks it exactly as before.
        preg_match("/style-src 'nonce-([^']+)'/", $csp, $m);
        $response->assertSee('<style nonce="' . $m[1] . '">', false);
    }

    public function test_a_student_cannot_open_someone_elses_invoice(): void
    {
        $invoice = app(InvoiceService::class)->issueFor($this->paidPayment($this->student()));

        $this->actingAs($this->student())
            ->get("/api/student/invoices/{$invoice->id}")
            ->assertForbidden();
    }

    // ── Refunds ──────────────────────────────────────────────────────────

    public function test_admin_full_refund_calls_razorpay_marks_refunded_and_withdraws_access(): void
    {
        $student = $this->student();
        $batch = $this->batch();
        $payment = $this->paidPayment($student, $batch);
        $enrollment = Enrollment::create([
            'user_id' => $student->id, 'course_id' => $batch->course_id, 'batch_id' => $batch->id,
            'payment_id' => $payment->id, 'is_active' => true, 'enrolled_at' => now(),
        ]);

        $this->mock(RazorpayService::class, function ($mock) use ($payment) {
            $mock->shouldReceive('refund')
                ->once()
                ->with($payment->razorpay_payment_id, null)
                ->andReturn(['id' => 'rfnd_test123']);
        });

        $this->actingAsAdmin($this->admin())
            ->postJson("/api/admin/payments/{$payment->id}/refund")
            ->assertOk()
            ->assertJsonPath('refund_id', 'rfnd_test123');

        $this->assertSame('refunded', $payment->fresh()->status);
        $this->assertFalse((bool) $enrollment->fresh()->is_active);
    }

    public function test_a_partial_refund_leaves_access_intact(): void
    {
        $student = $this->student();
        $batch = $this->batch();
        $payment = $this->paidPayment($student, $batch);
        $enrollment = Enrollment::create([
            'user_id' => $student->id, 'course_id' => $batch->course_id, 'batch_id' => $batch->id,
            'payment_id' => $payment->id, 'is_active' => true, 'enrolled_at' => now(),
        ]);

        $this->mock(RazorpayService::class, function ($mock) {
            $mock->shouldReceive('refund')->once()->andReturn(['id' => 'rfnd_partial']);
        });

        $this->actingAsAdmin($this->admin())
            ->postJson("/api/admin/payments/{$payment->id}/refund", ['amount' => 40000])
            ->assertOk();

        // Still paid, still enrolled — they part-paid for the course.
        $this->assertSame('paid', $payment->fresh()->status);
        $this->assertTrue((bool) $enrollment->fresh()->is_active);
    }

    public function test_refund_is_refused_when_razorpay_rejects_it_and_nothing_changes_locally(): void
    {
        $student = $this->student();
        $batch = $this->batch();
        $payment = $this->paidPayment($student, $batch);
        $enrollment = Enrollment::create([
            'user_id' => $student->id, 'course_id' => $batch->course_id, 'batch_id' => $batch->id,
            'payment_id' => $payment->id, 'is_active' => true, 'enrolled_at' => now(),
        ]);

        $this->mock(RazorpayService::class, function ($mock) {
            $mock->shouldReceive('refund')->once()->andThrow(new \RuntimeException('gateway down'));
        });

        $this->actingAsAdmin($this->admin())
            ->postJson("/api/admin/payments/{$payment->id}/refund")
            ->assertStatus(502);

        $this->assertSame('paid', $payment->fresh()->status);
        $this->assertTrue((bool) $enrollment->fresh()->is_active, 'Access must survive a failed refund.');
    }

    public function test_a_payment_cannot_be_refunded_twice(): void
    {
        $payment = $this->paidPayment($this->student(), null, 99900, ['status' => 'refunded']);

        $this->actingAsAdmin($this->admin())
            ->postJson("/api/admin/payments/{$payment->id}/refund")
            ->assertStatus(422);
    }

    public function test_refund_amount_cannot_exceed_what_was_captured(): void
    {
        $payment = $this->paidPayment($this->student(), null, 50000);

        $this->actingAsAdmin($this->admin())
            ->postJson("/api/admin/payments/{$payment->id}/refund", ['amount' => 60000])
            ->assertStatus(422)
            ->assertJsonValidationErrors('amount');
    }

    public function test_a_student_cannot_refund_a_payment(): void
    {
        $payment = $this->paidPayment($this->student());

        $this->actingAs($this->student())
            ->postJson("/api/admin/payments/{$payment->id}/refund")
            ->assertForbidden();
    }

    /**
     * SettingsController::update() SKIPS any key that does not already exist,
     * and seeding is a manual one-off in production while migrations autorun.
     * So the invoice keys are created by a migration — without that the admin
     * could fill this form in, get "saved", and have nothing persist.
     */
    public function test_the_invoice_settings_exist_and_actually_save(): void
    {
        // The super-admin role is owner-locked to one designated email, so it
        // comes from the seeder rather than a factory.
        $this->seed(\Database\Seeders\SuperAdminSeeder::class);
        $superAdmin = User::role('super-admin')->firstOrFail();
        $superAdmin->update(['google2fa_enabled' => true, 'google2fa_secret' => 'LUTWUXK6K5F5GDZ6']);

        $this->actingAs($superAdmin);
        session(['2fa_verified' => true]);

        $this->putJson('/api/super-admin/settings', [
            'settings' => [
                'invoice_gstin' => '29ABCDE1234F1Z5',
                'invoice_seller_name' => 'Thevi Institution Pvt Ltd',
                'invoice_gst_rate' => '18',
                'invoice_number_prefix' => 'TIP',
            ],
        ])->assertOk();

        $this->assertSame('29ABCDE1234F1Z5', Setting::where('key', 'invoice_gstin')->value('value'));
        $this->assertSame('TIP', Setting::where('key', 'invoice_number_prefix')->value('value'));

        // And the saved prefix is what a newly-issued invoice actually uses.
        $invoice = app(InvoiceService::class)->issueFor($this->paidPayment($this->student()));
        $this->assertStringStartsWith('TIP/', $invoice->invoice_number);
        $this->assertTrue($invoice->is_tax_invoice);
    }

    // ── Per-user coupon cap ──────────────────────────────────────────────

    private function coupon(array $overrides = []): Coupon
    {
        return Coupon::create(array_merge([
            'code' => 'SAVE' . strtoupper(substr(uniqid(), -5)),
            'discount_type' => 'percentage',
            'discount_value' => 10,
            'is_active' => true,
        ], $overrides));
    }

    public function test_a_coupon_capped_per_user_is_refused_on_the_second_attempt(): void
    {
        Setting::where('key', 'payment_gateway_enabled')->update(['value' => 'true']);
        $student = $this->student();
        $batch = $this->batch();
        $coupon = $this->coupon(['max_uses_per_user' => 1]);

        // Their first, already-completed redemption.
        $this->paidPayment($student, $batch, 89910, ['coupon_id' => $coupon->id]);

        $this->actingAs($student)
            ->postJson('/api/student/checkout/validate-coupon', [
                'code' => $coupon->code, 'batch_id' => $batch->id,
            ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'You have already used this coupon.');
    }

    public function test_another_student_can_still_use_that_coupon(): void
    {
        Setting::where('key', 'payment_gateway_enabled')->update(['value' => 'true']);
        $batch = $this->batch();
        $coupon = $this->coupon(['max_uses_per_user' => 1]);

        $this->paidPayment($this->student(), $batch, 89910, ['coupon_id' => $coupon->id]);

        $this->actingAs($this->student())
            ->postJson('/api/student/checkout/validate-coupon', [
                'code' => $coupon->code, 'batch_id' => $batch->id,
            ])
            ->assertOk()
            ->assertJsonPath('valid', true);
    }

    public function test_a_refunded_redemption_gives_the_student_their_use_back(): void
    {
        Setting::where('key', 'payment_gateway_enabled')->update(['value' => 'true']);
        $student = $this->student();
        $batch = $this->batch();
        $coupon = $this->coupon(['max_uses_per_user' => 1]);

        $this->paidPayment($student, $batch, 89910, ['coupon_id' => $coupon->id, 'status' => 'refunded']);

        $this->actingAs($student)
            ->postJson('/api/student/checkout/validate-coupon', [
                'code' => $coupon->code, 'batch_id' => $batch->id,
            ])
            ->assertOk();
    }

    public function test_an_exhausted_coupon_is_still_honoured_for_a_student_who_already_paid(): void
    {
        $student = $this->student();
        $batch = $this->batch();
        // Pool already full — mimics the pool emptying mid-checkout.
        $coupon = $this->coupon(['max_uses' => 1, 'times_used' => 1]);
        $payment = $this->paidPayment($student, $batch, 89910, [
            'coupon_id' => $coupon->id, 'status' => 'created',
        ]);

        $result = app(PaymentEnrollmentService::class)->confirmAndEnroll($payment->id, 'pay_race123');

        // Taking their money and refusing access would be the worse failure.
        $this->assertSame('paid', $result['payment']->status);
        $this->assertNotNull($result['enrollment']);
        $this->assertTrue((bool) $result['enrollment']->is_active);
    }
}
