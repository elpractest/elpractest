<?php

namespace Tests\Feature;

use App\Models\Passage;
use App\Models\Question;
use App\Models\QuestionOption;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * Image-based and table-based MCQ support: a question's own diagram, an
 * option that is itself an image (reasoning figure-series questions), and a
 * passage carrying a shared chart/image or a Data Interpretation table.
 *
 * The update path is worth its own attention here: options are replaced
 * wholesale on every save (delete + recreate, see QuestionController), which
 * means "leave this option's image alone" is not something PHP can infer
 * from an absent upload — the untouched image's path has to come back from
 * the client explicitly, or it is lost. These pin that it survives.
 */
class QuestionImageSupportTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);

        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');
        $this->admin->update(['google2fa_enabled' => true, 'google2fa_secret' => 'B39XKJ2938JJD982']);

        Storage::fake('public');
    }

    public function test_a_question_can_be_created_with_its_own_diagram(): void
    {
        $response = $this->actingAs($this->admin)
            ->post('/api/admin/questions', [
                'subject' => 'Reasoning',
                'topic' => 'Series',
                'difficulty' => 'medium',
                'question_text' => 'Study the figure and find the next term.',
                'image' => UploadedFile::fake()->image('series.png'),
                'marks' => 2,
                'negative_marks' => 0.5,
                'options' => [
                    ['label' => 'a', 'option_text' => '10', 'is_correct' => true],
                    ['label' => 'b', 'option_text' => '11', 'is_correct' => false],
                ],
            ]);

        $response->assertCreated();
        $question = Question::find($response->json('question.id'));

        Storage::disk('public')->assertExists($question->image_path);
        $this->assertStringStartsWith('question_images/', $question->image_path);
        $this->assertNotNull($question->image_url);
    }

    public function test_an_option_can_be_image_only_with_no_text(): void
    {
        $response = $this->actingAs($this->admin)
            ->post('/api/admin/questions', [
                'subject' => 'Reasoning',
                'topic' => 'Non-verbal',
                'difficulty' => 'medium',
                'question_text' => 'Which figure completes the series?',
                'marks' => 2,
                'negative_marks' => 0.5,
                'options' => [
                    ['label' => 'a', 'image' => UploadedFile::fake()->image('a.png'), 'is_correct' => true],
                    ['label' => 'b', 'image' => UploadedFile::fake()->image('b.png'), 'is_correct' => false],
                ],
            ]);

        $response->assertCreated();
        $question = Question::find($response->json('question.id'))->load('options');

        $optionA = $question->options->firstWhere('label', 'a');
        $this->assertSame('', $optionA->option_text);
        $this->assertNotNull($optionA->image_path);
        Storage::disk('public')->assertExists($optionA->image_path);
    }

    public function test_an_option_with_neither_text_nor_image_is_rejected(): void
    {
        $this->actingAs($this->admin)
            ->post('/api/admin/questions', [
                'subject' => 'Reasoning',
                'topic' => 'Series',
                'difficulty' => 'easy',
                'question_text' => 'Next term?',
                'marks' => 1,
                'negative_marks' => 0,
                'options' => [
                    ['label' => 'a', 'option_text' => '10', 'is_correct' => true],
                    ['label' => 'b', 'is_correct' => false],
                ],
            ], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('options');
    }

    public function test_replacing_the_question_image_deletes_the_old_file(): void
    {
        $question = $this->makeQuestion();
        $oldPath = $question->image_path;
        Storage::disk('public')->assertExists($oldPath);

        $this->actingAs($this->admin)
            ->post("/api/admin/questions/{$question->id}", [
                '_method' => 'PUT',
                'question_text' => $question->question_text,
                'image' => UploadedFile::fake()->image('new.png'),
                'options' => [
                    ['label' => 'a', 'option_text' => '10', 'is_correct' => true],
                    ['label' => 'b', 'option_text' => '11', 'is_correct' => false],
                ],
            ])
            ->assertOk();

        $question->refresh();
        Storage::disk('public')->assertMissing($oldPath);
        Storage::disk('public')->assertExists($question->image_path);
        $this->assertNotSame($oldPath, $question->image_path);
    }

    public function test_an_untouched_option_image_survives_an_edit_when_its_path_is_sent_back(): void
    {
        $question = $this->makeQuestion();
        $optionA = $question->options()->where('label', 'a')->first();
        $originalPath = $optionA->image_path;

        $this->actingAs($this->admin)
            ->post("/api/admin/questions/{$question->id}", [
                '_method' => 'PUT',
                'question_text' => $question->question_text,
                'options' => [
                    // Same image, carried forward by path — no new upload.
                    ['label' => 'a', 'option_text' => '10', 'image_path' => $originalPath, 'is_correct' => true],
                    ['label' => 'b', 'option_text' => '11', 'is_correct' => false],
                ],
            ])
            ->assertOk();

        Storage::disk('public')->assertExists($originalPath);
        $newOptionA = $question->fresh()->options()->where('label', 'a')->first();
        $this->assertSame($originalPath, $newOptionA->image_path);
    }

    public function test_an_option_image_dropped_on_edit_is_deleted_from_disk(): void
    {
        $question = $this->makeQuestion();
        $optionA = $question->options()->where('label', 'a')->first();
        $originalPath = $optionA->image_path;

        $this->actingAs($this->admin)
            ->post("/api/admin/questions/{$question->id}", [
                '_method' => 'PUT',
                'question_text' => $question->question_text,
                'options' => [
                    // No image_path this time — the picture was removed.
                    ['label' => 'a', 'option_text' => '10 (text now)', 'is_correct' => true],
                    ['label' => 'b', 'option_text' => '11', 'is_correct' => false],
                ],
            ])
            ->assertOk();

        Storage::disk('public')->assertMissing($originalPath);
    }

    public function test_removing_a_question_image_deletes_it_from_disk(): void
    {
        $question = $this->makeQuestion();
        $path = $question->image_path;
        Storage::disk('public')->assertExists($path);

        $this->actingAs($this->admin)
            ->post("/api/admin/questions/{$question->id}", [
                '_method' => 'PUT',
                'question_text' => $question->question_text,
                'remove_image' => true,
                'options' => [
                    ['label' => 'a', 'option_text' => '10', 'is_correct' => true],
                    ['label' => 'b', 'option_text' => '11', 'is_correct' => false],
                ],
            ])
            ->assertOk();

        Storage::disk('public')->assertMissing($path);
        $this->assertNull($question->fresh()->image_path);
    }

    public function test_a_passage_can_carry_a_data_interpretation_table_and_image(): void
    {
        $response = $this->actingAs($this->admin)
            ->post('/api/admin/passages', [
                'title' => 'Company sales 2020-2024',
                'body' => 'Study the following table and answer the questions that follow.',
                'image' => UploadedFile::fake()->image('chart.png'),
                'table' => [
                    'headers' => ['Company', '2023', '2024'],
                    'rows' => [
                        ['A', '120', '150'],
                        ['B', '90', '95'],
                    ],
                ],
            ]);

        $response->assertCreated();
        $passage = Passage::find($response->json('passage.id'));

        $this->assertNotNull($passage->image_path);
        Storage::disk('public')->assertExists($passage->image_path);
        $this->assertSame(['Company', '2023', '2024'], $passage->table_data['headers']);
        $this->assertCount(2, $passage->table_data['rows']);
    }

    public function test_a_table_with_only_blank_cells_is_stored_as_no_table(): void
    {
        $response = $this->actingAs($this->admin)
            ->post('/api/admin/passages', [
                'body' => 'Read the passage below.',
                'table' => [
                    'headers' => ['', ''],
                    'rows' => [['', '']],
                ],
            ]);

        $response->assertCreated();
        $passage = Passage::find($response->json('passage.id'));
        $this->assertNull($passage->table_data);
    }

    public function test_removing_a_passage_image_deletes_it_from_disk(): void
    {
        $passage = Passage::create([
            'body' => 'Study the chart below.',
            'image_path' => UploadedFile::fake()->image('chart.png')->store('passage_images', 'public'),
            'created_by' => $this->admin->id,
        ]);
        $path = $passage->image_path;
        Storage::disk('public')->assertExists($path);

        $this->actingAs($this->admin)
            ->post("/api/admin/passages/{$passage->id}", [
                '_method' => 'PUT',
                'remove_image' => true,
            ])
            ->assertOk();

        Storage::disk('public')->assertMissing($path);
        $this->assertNull($passage->fresh()->image_path);
    }

    public function test_a_student_cannot_reach_the_admin_passage_endpoints(): void
    {
        $student = User::factory()->create();
        $student->assignRole('student');

        $this->actingAs($student)
            ->postJson('/api/admin/passages', ['body' => 'x'])
            ->assertStatus(403);
    }

    private function makeQuestion(): Question
    {
        $response = $this->actingAs($this->admin)
            ->post('/api/admin/questions', [
                'subject' => 'Reasoning',
                'topic' => 'Series',
                'difficulty' => 'medium',
                'question_text' => 'Find the next term.',
                'image' => UploadedFile::fake()->image('q.png'),
                'marks' => 2,
                'negative_marks' => 0.5,
                'options' => [
                    ['label' => 'a', 'option_text' => '10', 'image' => UploadedFile::fake()->image('a.png'), 'is_correct' => true],
                    ['label' => 'b', 'option_text' => '11', 'is_correct' => false],
                ],
            ]);

        return Question::find($response->json('question.id'))->load('options');
    }
}
