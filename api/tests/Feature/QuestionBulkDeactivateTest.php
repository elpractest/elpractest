<?php

namespace Tests\Feature;

use App\Models\Question;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Bulk deactivate — the only way to claw back a bad CSV import (wrong exam
 * tags, a passage_id nobody had created yet) without clicking "Deactivate"
 * once per row. Same effect as the single-question destroy(): is_active
 * flips to false, nothing is hard-deleted.
 */
class QuestionBulkDeactivateTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);

        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');
        $this->admin->update(['google2fa_enabled' => true]);
    }

    private function makeQuestion(): Question
    {
        return Question::create([
            'subject' => 'Quant', 'topic' => 'Algebra', 'difficulty' => 'medium',
            'question_text' => 'Q?', 'marks' => 1, 'negative_marks' => 0.25,
            'status' => Question::STATUS_APPROVED, 'is_active' => true,
        ]);
    }

    public function test_an_admin_can_deactivate_many_questions_at_once(): void
    {
        $ids = collect(range(1, 5))->map(fn () => $this->makeQuestion()->id);

        $response = $this->actingAs($this->admin)
            ->withSession(['2fa_verified' => true])
            ->postJson('/api/admin/questions/bulk-deactivate', [
                'ids' => $ids->toArray(),
            ]);

        $response->assertOk()->assertJson(['count' => 5]);
        $this->assertSame(0, Question::where('is_active', true)->whereIn('id', $ids)->count());
    }

    public function test_ids_belonging_to_no_question_are_silently_ignored(): void
    {
        $question = $this->makeQuestion();

        $response = $this->actingAs($this->admin)
            ->withSession(['2fa_verified' => true])
            ->postJson('/api/admin/questions/bulk-deactivate', [
                'ids' => [$question->id, 999999],
            ]);

        $response->assertOk()->assertJson(['count' => 1]);
        $this->assertFalse($question->fresh()->is_active);
    }

    public function test_an_empty_id_list_is_rejected(): void
    {
        $this->actingAs($this->admin)
            ->withSession(['2fa_verified' => true])
            ->postJson('/api/admin/questions/bulk-deactivate', ['ids' => []])
            ->assertStatus(422);
    }

    public function test_a_student_cannot_bulk_deactivate(): void
    {
        $student = User::factory()->create();
        $student->assignRole('student');
        $question = $this->makeQuestion();

        $this->actingAs($student)
            ->postJson('/api/admin/questions/bulk-deactivate', ['ids' => [$question->id]])
            ->assertStatus(403);

        $this->assertTrue($question->fresh()->is_active);
    }
}
