<?php

namespace Tests\Feature;

use App\Models\Entitlement;
use App\Models\Question;
use App\Models\QuestionOption;
use App\Models\QuestionPool;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The pool rail: practice access granted by owning a slice of the bank rather
 * than by owning a paper that happens to contain it.
 *
 * The property that matters most here is that this is purely ADDITIVE. The
 * old rule — you may drill a question if it appears in a test you may sit —
 * has to keep working untouched, because every existing student depends on it.
 */
class QuestionPoolTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $student;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);

        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');
        $this->admin->update(['google2fa_enabled' => true]);

        $this->student = User::factory()->create();
        $this->student->assignRole('student');
    }

    /** Bank questions that belong to no test at all — only a pool can reach them. */
    private function bankQuestions(array $facets, int $count, string $subject = 'Teaching Aptitude'): void
    {
        for ($i = 1; $i <= $count; $i++) {
            $question = Question::create($facets + [
                'subject' => $subject,
                'topic' => $subject,
                'difficulty' => 'medium',
                'question_text' => "{$subject} {$i} " . json_encode($facets),
                'marks' => 2,
                'negative_marks' => 0,
                'is_active' => true,
                'status' => Question::STATUS_APPROVED,
                'created_by' => $this->admin->id,
                'serial' => $i,
                'question_code' => implode('-', array_filter([
                    $facets['exam_code'] ?? 'X',
                    $facets['paper'] ?? null,
                    strtoupper(substr($facets['source'] ?? 'mock', 0, 2)),
                    $facets['year'] ?? null,
                    str_pad((string) $i, 3, '0', STR_PAD_LEFT),
                ])),
            ]);

            QuestionOption::create([
                'question_id' => $question->id, 'label' => 'a',
                'option_text' => 'Right', 'is_correct' => true, 'sort_order' => 0,
            ]);
            QuestionOption::create([
                'question_id' => $question->id, 'label' => 'b',
                'option_text' => 'Wrong', 'is_correct' => false, 'sort_order' => 1,
            ]);
        }
    }

    private function pool(array $facets = []): QuestionPool
    {
        return QuestionPool::create(array_replace([
            'title' => 'UGC NET Paper 1 — PYQ',
            'slug' => 'ugcnet-p1-pyq',
            'exam_category' => 'UGC NET',
            'exam_code' => 'UGCNET',
            'paper' => 'P1',
            'source' => 'pyq',
            'is_active' => true,
            'created_by' => $this->admin->id,
        ], $facets));
    }

    private function grant(QuestionPool $pool): void
    {
        Entitlement::create([
            'user_id' => $this->student->id,
            'grantable_type' => QuestionPool::class,
            'grantable_id' => $pool->id,
            'source' => Entitlement::SOURCE_MANUAL,
            'starts_at' => now()->subDay(),
            'is_active' => true,
        ]);
    }

    public function test_a_pool_is_a_live_filter_not_a_frozen_list(): void
    {
        $pool = $this->pool();
        $this->assertSame(0, $pool->questions()->count());

        $this->bankQuestions(['exam_code' => 'UGCNET', 'paper' => 'P1', 'source' => 'pyq', 'year' => 2024], 5);
        $this->assertSame(5, $pool->questions()->count());

        // Import more of the same paper later — the pool covers it with no
        // re-sync, which is the whole reason it stores facets not ids.
        $this->bankQuestions(['exam_code' => 'UGCNET', 'paper' => 'P1', 'source' => 'pyq', 'year' => 2023], 3);
        $this->assertSame(8, $pool->questions()->count());

        // A different paper of the same exam stays out.
        $this->bankQuestions(['exam_code' => 'UGCNET', 'paper' => 'P2', 'source' => 'pyq', 'year' => 2024], 4);
        $this->assertSame(8, $pool->questions()->count());
    }

    public function test_a_pool_only_contains_questions_fit_to_serve(): void
    {
        $this->bankQuestions(['exam_code' => 'UGCNET', 'paper' => 'P1', 'source' => 'pyq', 'year' => 2024], 3);
        $pool = $this->pool();

        $this->assertSame(3, $pool->questions()->count());

        Question::query()->update(['status' => Question::STATUS_PENDING]);
        $this->assertSame(0, $pool->questions()->count(), 'unreviewed questions must not be practisable');

        Question::query()->update(['status' => Question::STATUS_APPROVED, 'is_active' => false]);
        $this->assertSame(0, $pool->questions()->count(), 'retired questions must not be practisable');
    }

    public function test_owning_a_pool_opens_practice_on_questions_in_no_test(): void
    {
        $this->bankQuestions(['exam_code' => 'UGCNET', 'paper' => 'P1', 'source' => 'pyq', 'year' => 2024], 12);

        // Without the entitlement the bank is invisible, exactly as before.
        $this->actingAs($this->student)
            ->getJson('/api/student/practice-tests/options')
            ->assertOk()
            ->assertJsonPath('total_available', 0);

        $this->grant($this->pool());

        $options = $this->actingAs($this->student)
            ->getJson('/api/student/practice-tests/options')
            ->assertOk();

        $this->assertSame(12, $options->json('total_available'));
        $this->assertSame('UGC NET', $options->json('exams.0.exam_name'));
        $this->assertSame(12, $options->json('source_counts.pyq'));
        $this->assertSame(2024, $options->json('years.0.year'));
    }

    public function test_a_pool_grants_only_its_own_slice(): void
    {
        $this->bankQuestions(['exam_code' => 'UGCNET', 'paper' => 'P1', 'source' => 'pyq', 'year' => 2024], 6);
        $this->bankQuestions(['exam_code' => 'UGCNET', 'paper' => 'P2', 'source' => 'pyq', 'year' => 2024], 9, 'Research');
        $this->bankQuestions(['exam_code' => 'SSCCGL', 'paper' => 'T1', 'source' => 'pyq', 'year' => 2024], 7, 'Quant');

        $this->grant($this->pool());

        $this->actingAs($this->student)
            ->getJson('/api/student/practice-tests/options')
            ->assertOk()
            ->assertJsonPath('total_available', 6);
    }

    public function test_a_student_can_build_a_practice_paper_from_a_pool(): void
    {
        $this->bankQuestions(['exam_code' => 'UGCNET', 'paper' => 'P1', 'source' => 'pyq', 'year' => 2024], 20);
        $this->grant($this->pool());

        $response = $this->actingAs($this->student)
            ->postJson('/api/student/practice-tests', [
                'exam_code' => 'UGCNET',
                'paper' => 'P1',
                'source' => 'pyq',
                'question_count' => 10,
                'duration_minutes' => 15,
            ])
            ->assertCreated();

        $test = \App\Models\Test::findOrFail($response->json('test.id'));
        $this->assertSame($this->student->id, $test->owner_id);
        $this->assertStringContainsString('UGC NET', $test->title);
        $this->assertSame(10, $test->sections()->first()->questions()->count());
    }

    public function test_taxonomy_narrowing_respects_the_pool_boundary(): void
    {
        $this->bankQuestions(['exam_code' => 'UGCNET', 'paper' => 'P1', 'source' => 'pyq', 'year' => 2024], 5);
        $this->bankQuestions(['exam_code' => 'SSCCGL', 'paper' => 'T1', 'source' => 'pyq', 'year' => 2024], 30, 'Quant');

        $this->grant($this->pool());

        // Asking for an exam they do not own returns nothing rather than
        // leaking it through the filter.
        $this->actingAs($this->student)
            ->postJson('/api/student/practice-tests/preview', ['exam_code' => 'SSCCGL'])
            ->assertOk()
            ->assertJsonPath('available', 0);
    }

    public function test_an_unbounded_pool_is_refused(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/api/admin/question-pools', [
                'title' => 'Everything',
                'exam_category' => 'Other',
            ])
            ->assertStatus(422);

        $this->assertSame(0, QuestionPool::count());
    }

    public function test_an_admin_can_size_a_pool_before_creating_it(): void
    {
        $this->bankQuestions(['exam_code' => 'UGCNET', 'paper' => 'P1', 'source' => 'pyq', 'year' => 2024], 4);

        $this->actingAs($this->admin)
            ->getJson('/api/admin/question-pools/preview?exam_code=UGCNET&paper=P1')
            ->assertOk()
            ->assertJsonPath('count', 4);

        $this->actingAs($this->admin)
            ->getJson('/api/admin/question-pools/preview')
            ->assertStatus(422);
    }

    public function test_pool_crud_reports_a_live_count(): void
    {
        $this->bankQuestions(['exam_code' => 'UGCNET', 'paper' => 'P1', 'source' => 'pyq', 'year' => 2024], 3);

        $created = $this->actingAs($this->admin)
            ->postJson('/api/admin/question-pools', [
                'title' => 'UGC NET Paper 1 — PYQ',
                'exam_category' => 'UGC NET',
                'exam_code' => 'UGCNET',
                'paper' => 'P1',
                'source' => 'pyq',
            ])
            ->assertCreated()
            ->assertJsonPath('pool.question_count', 3);

        $this->bankQuestions(['exam_code' => 'UGCNET', 'paper' => 'P1', 'source' => 'pyq', 'year' => 2023], 2);

        $this->actingAs($this->admin)
            ->getJson('/api/admin/question-pools/' . $created->json('pool.id'))
            ->assertOk()
            ->assertJsonPath('question_count', 5);
    }

    public function test_a_pool_can_be_sold_as_a_product(): void
    {
        $pool = $this->pool();

        $this->actingAs($this->admin)
            ->postJson('/api/admin/products', [
                'title' => 'UGC NET Paper 1 Question Bank',
                'type' => 'question_bank',
                'exam_category' => 'UGC NET',
                'price_paise' => 49900,
                'items' => [['kind' => 'question_pool', 'id' => $pool->id]],
            ])
            ->assertCreated();

        $this->assertDatabaseHas('product_items', [
            'grantable_type' => QuestionPool::class,
            'grantable_id' => $pool->id,
        ]);
    }

    public function test_a_student_cannot_manage_pools(): void
    {
        $this->actingAs($this->student)
            ->getJson('/api/admin/question-pools')
            ->assertForbidden();
    }
}
