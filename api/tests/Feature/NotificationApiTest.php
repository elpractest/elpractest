<?php

namespace Tests\Feature;

use App\Models\DeviceToken;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * FCM v1.1 — step 1: device-token registration + in-app notifications feed.
 */
class NotificationApiTest extends TestCase
{
    use RefreshDatabase;

    private User $student;
    private User $student2;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);

        $this->student = User::factory()->create(['phone_verified_at' => now()]);
        $this->student->assignRole('student');

        $this->student2 = User::factory()->create(['phone_verified_at' => now()]);
        $this->student2->assignRole('student');
    }

    /** Insert a raw database notification for the given user. */
    private function makeNotification(User $user, array $data, bool $read = false): void
    {
        $user->notifications()->create([
            'id' => (string) Str::uuid(),
            'type' => 'App\\Notifications\\FcmTest',
            'data' => $data,
            'read_at' => $read ? now() : null,
        ]);
    }

    public function test_student_can_register_a_device_token(): void
    {
        $this->actingAs($this->student)
            ->postJson('/api/student/device-tokens', ['token' => 'tok-abc', 'platform' => 'android'])
            ->assertOk();

        $this->assertDatabaseHas('device_tokens', [
            'token' => 'tok-abc',
            'user_id' => $this->student->id,
            'platform' => 'android',
        ]);
    }

    public function test_registering_an_existing_token_reassigns_ownership(): void
    {
        $this->actingAs($this->student)
            ->postJson('/api/student/device-tokens', ['token' => 'shared-tok'])
            ->assertOk();

        // Same physical device now logs in as a different student.
        $this->actingAs($this->student2)
            ->postJson('/api/student/device-tokens', ['token' => 'shared-tok'])
            ->assertOk();

        $this->assertSame(1, DeviceToken::where('token', 'shared-tok')->count());
        $this->assertDatabaseHas('device_tokens', [
            'token' => 'shared-tok',
            'user_id' => $this->student2->id,
        ]);
    }

    public function test_student_can_delete_their_device_token(): void
    {
        DeviceToken::create(['user_id' => $this->student->id, 'token' => 'gone-tok', 'platform' => 'android']);

        $this->actingAs($this->student)
            ->deleteJson('/api/student/device-tokens', ['token' => 'gone-tok'])
            ->assertOk();

        $this->assertDatabaseMissing('device_tokens', ['token' => 'gone-tok']);
    }

    public function test_feed_returns_mapped_items_and_unread_count(): void
    {
        $this->makeNotification($this->student, [
            'type' => 'result', 'title' => 'Result ready', 'body' => 'Mock #1 — 88/100',
            'hue' => 'green', 'icon' => 'check-circle', 'route' => '/tests/1/result',
        ], read: false);

        $this->makeNotification($this->student, [
            'type' => 'activation', 'title' => 'Activation approved', 'body' => 'SSC CGL approved',
            'hue' => 'gold', 'icon' => 'key', 'route' => '/dashboard',
        ], read: true);

        // A notification belonging to another student must not leak in.
        $this->makeNotification($this->student2, ['title' => 'Other'], read: false);

        $res = $this->actingAs($this->student)
            ->getJson('/api/student/notifications')
            ->assertOk()
            ->assertJsonPath('unread_count', 1)
            ->assertJsonCount(2, 'notifications');

        $first = $res->json('notifications.0');
        $this->assertArrayHasKey('time', $first);
        $this->assertArrayHasKey('read', $first);
        $this->assertArrayHasKey('hue', $first);
        $this->assertArrayHasKey('link', $first);
    }

    public function test_unread_count_endpoint(): void
    {
        $this->makeNotification($this->student, ['title' => 'A'], read: false);
        $this->makeNotification($this->student, ['title' => 'B'], read: false);

        $this->actingAs($this->student)
            ->getJson('/api/student/notifications/unread-count')
            ->assertOk()
            ->assertJsonPath('unread_count', 2);
    }

    public function test_mark_all_read_clears_unread(): void
    {
        $this->makeNotification($this->student, ['title' => 'A'], read: false);
        $this->makeNotification($this->student, ['title' => 'B'], read: false);

        $this->actingAs($this->student)
            ->postJson('/api/student/notifications/read-all')
            ->assertOk();

        $this->assertSame(0, $this->student->fresh()->unreadNotifications()->count());
    }
}
