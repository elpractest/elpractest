<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Batch;
use App\Models\User;
use App\Models\ActivationRequest;
use App\Models\ActivationCode;
use App\Models\Enrollment;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ActivationFlowTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $student;
    private User $student2;
    private Course $course;
    private Batch $batch;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);

        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');
        $this->admin->update([
            'google2fa_enabled' => true,
            'google2fa_secret' => 'B39XKJ2938JJD982',
        ]);

        $this->student = User::factory()->create();
        $this->student->assignRole('student');

        $this->student2 = User::factory()->create();
        $this->student2->assignRole('student');

        $this->course = Course::create([
            'title' => 'UPSC GS Prelims',
            'slug' => 'upsc-gs-prelims',
            'description' => 'GS Prelims',
            'mode' => 'live',
            'exam_category' => 'UPSC',
        ]);

        $this->batch = Batch::create([
            'course_id' => $this->course->id,
            'name' => 'UPSC Batch 2026',
            'max_students' => 10,
        ]);

        Storage::fake('local');
    }

    public function test_student_request_activation_and_admin_approves_flow(): void
    {
        $file = UploadedFile::fake()->create('receipt.png', 500);

        // 1. Student requests activation
        $response = $this->actingAs($this->student)
            ->postJson('/api/student/activation-requests', [
                'batch_id' => $this->batch->id,
                'payment_reference' => 'TXN-987654321',
                'proof_document' => $file,
            ]);

        $response->assertStatus(201);
        $request = ActivationRequest::first();
        $this->assertNotNull($request);
        $this->assertEquals('pending', $request->status);
        $this->assertEquals('TXN-987654321', $request->payment_reference);

        // Verify file stored on private local disk
        Storage::disk('local')->assertExists($request->proof_document_path);

        // 2. Admin views proof
        $proofRes = $this->actingAs($this->admin)
            ->get("/api/admin/activation-requests/{$request->id}/proof");
        $proofRes->assertStatus(200);

        // 3. Admin approves request
        $approveRes = $this->actingAs($this->admin)
            ->postJson("/api/admin/activation-requests/{$request->id}/approve");

        $approveRes->assertStatus(200);

        $request->refresh();
        $this->assertEquals('approved', $request->status);
        $this->assertEquals($this->admin->id, $request->reviewed_by);

        // Student is now enrolled
        $this->assertDatabaseHas('enrollments', [
            'user_id' => $this->student->id,
            'course_id' => $this->course->id,
            'batch_id' => $this->batch->id,
            'is_active' => true,
        ]);
    }

    public function test_admin_rejects_activation_request_with_reason(): void
    {
        $file = UploadedFile::fake()->create('receipt.pdf', 300);

        $request = ActivationRequest::create([
            'user_id' => $this->student->id,
            'batch_id' => $this->batch->id,
            'payment_reference' => 'TXN-000000000',
            'proof_document_path' => $file->store('proofs', 'local'),
            'status' => 'pending',
        ]);

        $response = $this->actingAs($this->admin)
            ->postJson("/api/admin/activation-requests/{$request->id}/reject", [
                'reason' => 'Receipt is blurry. Please upload again.',
            ]);

        $response->assertStatus(200);
        $request->refresh();

        $this->assertEquals('rejected', $request->status);
        $this->assertEquals('Receipt is blurry. Please upload again.', $request->admin_notes);
        $this->assertEquals($this->admin->id, $request->reviewed_by);
    }

    public function test_admin_generates_codes_and_student_redeems_successfully(): void
    {
        // 1. Admin generates 2 codes
        $response = $this->actingAs($this->admin)
            ->postJson('/api/admin/activation-codes', [
                'course_id' => $this->course->id,
                'batch_id' => $this->batch->id,
                'count' => 2,
                'max_uses' => 1,
            ]);

        $response->assertStatus(201);
        $codes = ActivationCode::all();
        $this->assertCount(2, $codes);

        $codeStr = $codes[0]->code;

        // 2. Student redeems code
        $redeemRes = $this->actingAs($this->student)
            ->postJson('/api/student/activation-codes/redeem', [
                'code' => $codeStr,
            ]);

        $redeemRes->assertStatus(200)
            ->assertJsonPath('message', 'Activation code redeemed successfully. You are now enrolled in the course.');

        // Check enrollment
        $this->assertDatabaseHas('enrollments', [
            'user_id' => $this->student->id,
            'course_id' => $this->course->id,
            'batch_id' => $this->batch->id,
            'is_active' => true,
        ]);

        // Code uses updated
        $codes[0]->refresh();
        $this->assertEquals(1, $codes[0]->times_used);
        $this->assertFalse($codes[0]->isRedeemable());
    }

    public function test_expired_or_exhausted_codes_are_rejected(): void
    {
        // 1. Exhausted code
        $code = ActivationCode::create([
            'code' => 'ABCDEFGH',
            'course_id' => $this->course->id,
            'batch_id' => $this->batch->id,
            'max_uses' => 1,
            'times_used' => 1,
            'generated_by' => $this->admin->id,
        ]);

        $response = $this->actingAs($this->student)
            ->postJson('/api/student/activation-codes/redeem', [
                'code' => 'ABCDEFGH',
            ]);

        $response->assertStatus(422)
            ->assertJsonPath('message', 'This activation code has expired or reached its maximum uses.');

        // 2. Expired code
        $expiredCode = ActivationCode::create([
            'code' => 'EXPIRED1',
            'course_id' => $this->course->id,
            'batch_id' => $this->batch->id,
            'max_uses' => 5,
            'times_used' => 0,
            'expires_at' => now()->subDay(),
            'generated_by' => $this->admin->id,
        ]);

        $response2 = $this->actingAs($this->student)
            ->postJson('/api/student/activation-codes/redeem', [
                'code' => 'EXPIRED1',
            ]);

        $response2->assertStatus(422)
            ->assertJsonPath('message', 'This activation code has expired or reached its maximum uses.');
    }

    public function test_concurrent_redemptions_on_single_use_code_fails_gracefully(): void
    {
        $code = ActivationCode::create([
            'code' => 'CONCURR1',
            'course_id' => $this->course->id,
            'batch_id' => $this->batch->id,
            'max_uses' => 1,
            'times_used' => 0,
            'generated_by' => $this->admin->id,
        ]);

        // Simulating the transactional behavior where one lock holds and blocks another
        // To verify the transaction logic in a single-threaded test, we can verify that
        // inside the transaction, the first locks the row and increments, so that the second transaction fails.
        // We'll run the first redemption successfully.
        $res1 = $this->actingAs($this->student)
            ->postJson('/api/student/activation-codes/redeem', ['code' => 'CONCURR1']);
        $res1->assertStatus(200);

        // The second request immediately fails because times_used is now 1 (>= max_uses)
        $res2 = $this->actingAs($this->student2)
            ->postJson('/api/student/activation-codes/redeem', ['code' => 'CONCURR1']);
        $res2->assertStatus(422)
            ->assertJsonPath('message', 'This activation code has expired or reached its maximum uses.');

        $code->refresh();
        $this->assertEquals(1, $code->times_used);
        $this->assertEquals(1, Enrollment::count());
    }
}
