<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\User;
use App\Models\VajiniChunk;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

/**
 * Vajini chat — the student-facing RAG endpoint. OpenAI is faked, so these
 * prove the wiring (auth, retrieval, grounding, audit, graceful degradation)
 * without a real key and without the suite ever calling out to the network.
 */
class VajiniChatTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);

        // A key must be present for configured() to be true. Never a real one.
        config(['services.openai.key' => 'sk-test-key']);
    }

    private function student(): User
    {
        $student = User::factory()->create(['phone_verified_at' => now()]);
        $student->assignRole('student');

        return $student;
    }

    private function fakeOpenAi(array $embedding = [1.0, 0.0, 0.0], string $reply = 'Here is the answer.'): void
    {
        Http::fake([
            '*/embeddings' => Http::response(['data' => [['index' => 0, 'embedding' => $embedding]]]),
            '*/chat/completions' => Http::response(['choices' => [['message' => ['content' => $reply]]]]),
        ]);
    }

    private function seedChunk(array $embedding = [1.0, 0.0, 0.0]): VajiniChunk
    {
        return VajiniChunk::create([
            'source_type' => 'question',
            'source_id' => 42,
            'title' => 'Question · Photosynthesis',
            'content' => 'Q: What gas do plants take in? Explanation: Carbon dioxide.',
            'content_hash' => hash('sha256', 'seed'),
            'embedding' => $embedding,
        ]);
    }

    public function test_guest_cannot_chat(): void
    {
        $this->postJson('/api/student/vajini/chat', ['message' => 'hi'])
            ->assertUnauthorized();
    }

    public function test_non_student_is_forbidden(): void
    {
        $admin = User::factory()->create();
        $admin->assignRole('admin');

        $this->actingAs($admin)
            ->postJson('/api/student/vajini/chat', ['message' => 'hi'])
            ->assertForbidden();
    }

    public function test_message_is_required(): void
    {
        $this->actingAs($this->student())
            ->postJson('/api/student/vajini/chat', ['message' => ''])
            ->assertStatus(422)
            ->assertJsonValidationErrors('message');
    }

    public function test_student_gets_a_grounded_reply_with_sources(): void
    {
        $this->fakeOpenAi(embedding: [1.0, 0.0, 0.0], reply: 'Plants take in carbon dioxide.');
        $this->seedChunk(embedding: [1.0, 0.0, 0.0]); // cosine 1.0 with the query

        $response = $this->actingAs($this->student())
            ->postJson('/api/student/vajini/chat', ['message' => 'What gas do plants absorb?']);

        $response->assertOk()
            ->assertJsonPath('reply', 'Plants take in carbon dioxide.')
            ->assertJsonPath('sources.0.title', 'Question · Photosynthesis')
            ->assertJsonPath('sources.0.type', 'question')
            ->assertJsonPath('sources.0.id', 42);
    }

    public function test_chat_is_audit_logged(): void
    {
        $this->fakeOpenAi();
        $this->seedChunk();

        $this->actingAs($this->student())
            ->postJson('/api/student/vajini/chat', ['message' => 'Explain osmosis'])
            ->assertOk();

        $this->assertDatabaseHas('audit_logs', ['action' => 'vajini.chat']);

        $log = AuditLog::where('action', 'vajini.chat')->first();
        $this->assertSame('Explain osmosis', $log->new_values['message']);
        $this->assertContains('Question · Photosynthesis', $log->new_values['sources']);
    }

    public function test_it_returns_503_when_openai_is_not_configured(): void
    {
        config(['services.openai.key' => null]);

        $this->actingAs($this->student())
            ->postJson('/api/student/vajini/chat', ['message' => 'hi'])
            ->assertStatus(503);
    }

    public function test_it_returns_503_when_openai_call_fails(): void
    {
        Http::fake([
            '*/embeddings' => Http::response(['data' => [['index' => 0, 'embedding' => [1.0, 0.0, 0.0]]]]),
            '*/chat/completions' => Http::response('upstream error', 500),
        ]);
        $this->seedChunk();

        $this->actingAs($this->student())
            ->postJson('/api/student/vajini/chat', ['message' => 'hi'])
            ->assertStatus(503);
    }
}
