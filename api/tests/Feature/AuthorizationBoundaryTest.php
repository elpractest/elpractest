<?php

namespace Tests\Feature;

use App\Models\Payment;
use App\Models\Test;
use App\Models\TestSession;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * Locks in the server-side authorization controls a black-box pentest could
 * only *hypothesise* about (BFLA / vertical priv-esc, horizontal IDOR, and
 * cross-user payment-order access). These are the real "fix" for the report's
 * unvalidated hypotheses: if a future refactor weakens any of these gates,
 * this suite fails loudly instead of shipping the hole to prod.
 *
 * Mass-assignment on register + Razorpay signature rejection are already
 * covered by SuperAdminProtectionTest and RazorpayPaymentTest respectively;
 * this file deliberately covers only the gaps those leave.
 */
class AuthorizationBoundaryTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);
    }

    private function student(): User
    {
        $user = User::factory()->create();
        $user->assignRole('student');

        return $user;
    }

    /*
    |--------------------------------------------------------------------------
    | Vertical: a student session must be refused on admin / super-admin routes
    | (BFLA). The role middleware must fire server-side, not just in the SPA.
    |--------------------------------------------------------------------------
    */

    public static function adminRouteProvider(): array
    {
        return [
            'admin question bank'   => ['get',  '/api/admin/questions'],
            'admin user search'     => ['get',  '/api/admin/users'],
            'admin results'         => ['get',  '/api/admin/results'],
            'admin enrollments'     => ['get',  '/api/admin/enrollments'],
            'admin payments'        => ['get',  '/api/admin/payments'],
            'admin activation codes'=> ['get',  '/api/admin/activation-codes'],
            'super-admin admins'    => ['get',  '/api/super-admin/admins'],
            'super-admin settings'  => ['get',  '/api/super-admin/settings'],
            'super-admin audit log' => ['get',  '/api/super-admin/audit-logs'],
        ];
    }

    #[DataProvider('adminRouteProvider')]
    public function test_student_is_forbidden_from_privileged_routes(string $method, string $uri): void
    {
        $response = $this->actingAs($this->student())->json($method, $uri);

        // 403 = role gate refused. Anything 2xx would be a privilege escalation.
        $this->assertSame(
            403,
            $response->getStatusCode(),
            "Expected 403 for a student calling {$method} {$uri}, got {$response->getStatusCode()}"
        );
    }

    public function test_unauthenticated_request_to_privileged_route_is_rejected(): void
    {
        // No session at all → 401, never a 200.
        $this->getJson('/api/admin/users')->assertStatus(401);
    }

    /*
    |--------------------------------------------------------------------------
    | Horizontal: a student must not read another student's test session
    | (IDOR). Every session-scoped handler checks user_id ownership → 403.
    |--------------------------------------------------------------------------
    */

    public function test_student_cannot_read_another_students_test_session(): void
    {
        $owner = $this->student();
        $attacker = $this->student();

        $test = Test::create([
            'title' => 'Boundary Mock',
            'type' => 'mock',
            'duration_seconds' => 120,
            'total_marks' => 1.00,
            'is_published' => true,
            'max_attempts' => 1,
            'created_by' => $owner->id,
        ]);

        $session = TestSession::create([
            'user_id' => $owner->id,
            'test_id' => $test->id,
            'started_at' => now(),
            'duration_seconds' => 120,
            'submitted_at' => now(),
        ]);

        foreach ([
            "/api/student/tests/sessions/{$session->id}/result",
            "/api/student/tests/sessions/{$session->id}/palette",
            "/api/student/tests/sessions/{$session->id}",
        ] as $uri) {
            $this->actingAs($attacker)
                ->getJson($uri)
                ->assertStatus(403);
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Payments: verifyPayment is scoped to the caller's user_id, so another
    | user's order can never be claimed (the query misses → 404 before any
    | signature check). Guards against horizontal enrollment theft.
    |--------------------------------------------------------------------------
    */

    public function test_student_cannot_verify_another_users_payment_order(): void
    {
        $owner = $this->student();
        $attacker = $this->student();

        $course = \App\Models\Course::create([
            'title' => 'Boundary Course',
            'description' => 'x',
            'exam_category' => 'SSC',
        ]);
        $batch = \App\Models\Batch::create([
            'course_id' => $course->id,
            'name' => 'Boundary Batch',
        ]);

        Payment::create([
            'user_id' => $owner->id,
            'course_id' => $course->id,
            'batch_id' => $batch->id,
            'amount' => 99900,
            'status' => 'created',
            'razorpay_order_id' => 'order_boundary_test',
        ]);

        $this->actingAs($attacker)
            ->postJson('/api/student/checkout/verify', [
                'razorpay_order_id' => 'order_boundary_test',
                'razorpay_payment_id' => 'pay_forged',
                'razorpay_signature' => 'deadbeef',
            ])
            ->assertStatus(404);
    }
}
