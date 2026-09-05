<?php

namespace Tests\Feature;

use App\Models\Course;
use App\Models\Question;
use App\Models\Test;
use App\Models\TestSeries;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

/**
 * Door B — a whole paper in one upload.
 *
 * The thing under test is not really "does a CSV parse". It is that one upload
 * lands in TWO subsystems consistently: N classified questions in the bank, and
 * a test whose sections and question order match the file. So most of these
 * assert on both sides of that at once.
 */
class PaperImportTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private TestSeries $series;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);

        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');
        $this->admin->update(['google2fa_enabled' => true]);

        $course = Course::create([
            'title' => 'UGC NET Paper 1',
            'slug' => 'ugc-net-paper-1',
            'exam_category' => 'UGC NET',
        ]);
        $this->series = TestSeries::create([
            'title' => 'UGC NET Paper 1 — PYQ',
            'slug' => 'ugc-net-p1-pyq',
            'exam_category' => 'UGC NET',
            'course_id' => $course->id,
            'is_published' => false,
            'created_by' => $this->admin->id,
        ]);
    }

    private function meta(array $overrides = []): array
    {
        return array_replace([
            'title' => 'UGC NET 2024 Paper 1 — Shift 2',
            'test_series_id' => $this->series->id,
            'type' => 'mock',
            'duration_minutes' => 60,
            'exam_code' => 'UGCNET',
            'paper' => 'P1',
            'source' => 'pyq',
            'year' => 2024,
            'shift' => '2',
            'medium' => 'en',
            'marks' => 2,
            'negative_marks' => 0,
            'sections' => [
                ['title' => 'Teaching Aptitude'],
                ['title' => 'Research Aptitude'],
            ],
        ], $overrides);
    }

    private function csv(?string $content = null): UploadedFile
    {
        $content ??= "section,question_text,option_a,option_b,option_c,option_d,correct_option\n"
            . "Teaching Aptitude,\"Learner-centred method?\",Lecture,Demonstration,Problem-solving,Dictation,c\n"
            . "Teaching Aptitude,\"Formative evaluation aims to?\",Grade,Improve teaching,Rank,Certify,b\n"
            . "Research Aptitude,\"Research must be?\",Anecdotal,Systematic,Random,Secret,b\n";

        return UploadedFile::fake()->createWithContent('paper.csv', $content);
    }

    private function importPaper(array $meta, UploadedFile $file, bool $dryRun = false)
    {
        return $this->actingAs($this->admin)->post('/api/admin/tests/import-paper', [
            'file' => $file,
            'meta' => json_encode($meta),
            'dry_run' => $dryRun ? '1' : '0',
        ]);
    }

    public function test_a_dry_run_reports_without_creating_anything(): void
    {
        $response = $this->importPaper($this->meta(), $this->csv(), dryRun: true);

        $response->assertOk()
            ->assertJsonPath('dry_run', true)
            ->assertJsonPath('ok', true)
            ->assertJsonPath('summary.questions', 3)
            ->assertJsonPath('summary.total_marks', 6)
            ->assertJsonPath('sections.Teaching Aptitude', 2)
            ->assertJsonPath('sections.Research Aptitude', 1);

        $this->assertSame(0, Question::count());
        $this->assertSame(0, Test::count());
    }

    public function test_one_upload_creates_the_paper_and_classifies_every_question(): void
    {
        $response = $this->importPaper($this->meta(), $this->csv());

        $response->assertCreated()->assertJsonPath('imported', 3);

        $test = Test::firstOrFail();
        $this->assertSame('UGC NET 2024 Paper 1 — Shift 2', $test->title);
        $this->assertSame($this->series->id, $test->test_series_id);
        $this->assertSame(3600, $test->duration_seconds);
        $this->assertEquals(6, (float) $test->total_marks);
        // A PYQ is a `pyp`, derived rather than asked for.
        $this->assertSame('pyp', $test->category);
        // Never publishes itself.
        $this->assertFalse((bool) $test->is_published);

        // Sections in meta order, questions in file order within each.
        $sections = $test->sections()->orderBy('sort_order')->get();
        $this->assertCount(2, $sections);
        $this->assertSame('Teaching Aptitude', $sections[0]->title);
        $this->assertSame(2, $sections[0]->questions()->count());
        $this->assertSame(1, $sections[1]->questions()->count());

        // And the bank gained three classified questions.
        $this->assertSame(3, Question::count());
        $codes = Question::orderBy('serial')->pluck('question_code')->all();
        $this->assertSame([
            'UGCNET-P1-PY-2024-S2-EN-001',
            'UGCNET-P1-PY-2024-S2-EN-002',
            'UGCNET-P1-PY-2024-S2-EN-003',
        ], $codes);

        // Subject falls back to the section title rather than being retyped.
        $this->assertSame('Teaching Aptitude', Question::where('serial', 1)->first()->subject);
    }

    public function test_the_two_shifts_of_one_paper_do_not_collide(): void
    {
        $this->importPaper($this->meta(), $this->csv())->assertCreated();

        // The exact case a packed code loses: same exam, paper, year, medium
        // and question numbers — a different sitting.
        $this->importPaper($this->meta(['shift' => '1', 'title' => 'UGC NET 2024 Paper 1 — Shift 1']), $this->csv())
            ->assertCreated();

        $this->assertSame(6, Question::count());
        $this->assertSame(3, Question::where('shift', '1')->count());
        $this->assertSame(3, Question::where('shift', '2')->count());
        $this->assertSame(6, Question::distinct()->count('question_code'));

        // Both sittings share a shift group, which is what cross-shift
        // normalisation keys on.
        $this->assertSame(['UGCNET-P1-2024'], Test::distinct()->pluck('shift_group')->all());
    }

    public function test_reimporting_the_same_paper_is_refused_rather_than_doubling_it(): void
    {
        $this->importPaper($this->meta(), $this->csv())->assertCreated();

        $response = $this->importPaper($this->meta(), $this->csv());

        $response->assertStatus(422)->assertJsonPath('ok', false);
        $this->assertCount(3, $response->json('duplicates'));
        $this->assertStringContainsString('already in the bank', $response->json('errors.0.message'));

        // Nothing was written the second time.
        $this->assertSame(3, Question::count());
        $this->assertSame(1, Test::count());
    }

    public function test_an_unscoped_paper_is_refused_because_it_would_be_world_readable(): void
    {
        $meta = $this->meta();
        unset($meta['test_series_id']);

        $this->importPaper($meta, $this->csv())
            ->assertStatus(422)
            ->assertJsonValidationErrors('test_series_id');

        $this->assertSame(0, Test::count());
    }

    public function test_a_row_naming_an_undeclared_section_fails_the_paper(): void
    {
        $csv = $this->csv(
            "section,question_text,option_a,option_b,option_c,option_d,correct_option\n"
            . "Teaching Aptitude,\"Fine row\",A,B,C,D,a\n"
            . "General Awareness,\"Undeclared section\",A,B,C,D,a\n"
        );

        $response = $this->importPaper($this->meta(), $csv, dryRun: true);

        $response->assertOk()->assertJsonPath('ok', false);
        $this->assertStringContainsString(
            "Section 'General Awareness' is not declared",
            collect($response->json('errors'))->pluck('message')->implode(' ')
        );
    }

    public function test_a_row_with_no_scoreable_key_fails_the_paper(): void
    {
        $csv = $this->csv(
            "section,question_text,option_a,option_b,option_c,option_d,correct_option\n"
            . "Teaching Aptitude,\"Two correct on a single choice\",A,B,C,D,a|b\n"
        );

        $response = $this->importPaper($this->meta(), $csv, dryRun: true);

        $response->assertOk()->assertJsonPath('ok', false);
        $this->assertStringContainsString(
            'exactly one option',
            collect($response->json('errors'))->pluck('message')->implode(' ')
        );
    }

    public function test_an_unknown_paper_for_the_exam_is_rejected(): void
    {
        $this->importPaper($this->meta(['paper' => 'P9']), $this->csv(), dryRun: true)
            ->assertOk()
            ->assertJsonPath('ok', false);
    }

    public function test_inline_passages_are_created_and_linked(): void
    {
        $csv = $this->csv(
            "section,question_text,option_a,option_b,option_c,option_d,correct_option,passage_ref\n"
            . "Teaching Aptitude,\"Growth from the table?\",25%,30%,20%,35%,a,DI1\n"
        );

        $meta = $this->meta([
            'sections' => [['title' => 'Teaching Aptitude']],
            'passages' => [[
                'ref' => 'DI1',
                'title' => 'Enrolment',
                'body' => 'Enrolment over three years.',
                'table_data' => ['headers' => ['Year', 'A'], 'rows' => [['2024', '150']]],
            ]],
        ]);

        $this->importPaper($meta, $csv)->assertCreated();

        $question = Question::firstOrFail();
        $this->assertNotNull($question->passage_id);
        $this->assertSame('Enrolment', $question->passage->title);
        $this->assertSame(['Year', 'A'], $question->passage->table_data['headers']);
    }

    public function test_a_row_referencing_an_undeclared_passage_fails(): void
    {
        $csv = $this->csv(
            "section,question_text,option_a,option_b,option_c,option_d,correct_option,passage_ref\n"
            . "Teaching Aptitude,\"Reads a passage\",A,B,C,D,a,NOPE\n"
        );

        $this->importPaper($this->meta(), $csv, dryRun: true)
            ->assertOk()
            ->assertJsonPath('ok', false);
    }

    public function test_imported_questions_need_review_before_the_paper_can_publish(): void
    {
        $this->importPaper($this->meta(), $this->csv())->assertCreated();

        $this->assertSame(3, Question::where('status', Question::STATUS_PENDING)->count());

        $test = Test::firstOrFail();
        $this->actingAs($this->admin)
            ->postJson("/api/admin/tests/{$test->id}/publish")
            ->assertStatus(422)
            ->assertJsonPath('unapproved_questions.0.status', Question::STATUS_PENDING);
    }

    public function test_auto_approve_lets_a_proofed_paper_publish_immediately(): void
    {
        $this->importPaper($this->meta(['auto_approve' => true]), $this->csv())->assertCreated();

        $this->assertSame(3, Question::where('status', Question::STATUS_APPROVED)->count());

        $test = Test::firstOrFail();
        $this->actingAs($this->admin)
            ->postJson("/api/admin/tests/{$test->id}/publish")
            ->assertOk();
    }

    public function test_marks_fall_back_from_row_to_section_to_paper(): void
    {
        $csv = $this->csv(
            "section,question_text,option_a,option_b,option_c,option_d,correct_option,marks,negative_marks\n"
            . "Teaching Aptitude,\"Paper default\",A,B,C,D,a,,\n"
            . "Research Aptitude,\"Section default\",A,B,C,D,a,,\n"
            . "Research Aptitude,\"Row override\",A,B,C,D,a,5,1.5\n"
        );

        $meta = $this->meta([
            'marks' => 2,
            'negative_marks' => 0.5,
            'sections' => [
                ['title' => 'Teaching Aptitude'],
                ['title' => 'Research Aptitude', 'marks' => 3, 'negative_marks' => 1],
            ],
        ]);

        $this->importPaper($meta, $csv)->assertCreated();

        $this->assertEquals(2, (float) Question::where('question_text', 'Paper default')->first()->marks);
        $this->assertEquals(3, (float) Question::where('question_text', 'Section default')->first()->marks);
        $this->assertEquals(5, (float) Question::where('question_text', 'Row override')->first()->marks);
        $this->assertEquals(1.5, (float) Question::where('question_text', 'Row override')->first()->negative_marks);
        $this->assertEquals(10, (float) Test::firstOrFail()->total_marks);
    }

    public function test_a_duplicate_serial_inside_one_file_is_caught(): void
    {
        $csv = $this->csv(
            "section,serial,question_text,option_a,option_b,option_c,option_d,correct_option\n"
            . "Teaching Aptitude,1,\"First\",A,B,C,D,a\n"
            . "Teaching Aptitude,1,\"Same serial\",A,B,C,D,a\n"
        );

        $response = $this->importPaper($this->meta(), $csv, dryRun: true);

        $response->assertOk()->assertJsonPath('ok', false);
        $this->assertStringContainsString(
            'already uses',
            collect($response->json('errors'))->pluck('message')->implode(' ')
        );
    }

    public function test_a_student_cannot_import_a_paper(): void
    {
        $student = User::factory()->create();
        $student->assignRole('student');

        $this->actingAs($student)
            ->post('/api/admin/tests/import-paper', [
                'file' => $this->csv(),
                'meta' => json_encode($this->meta()),
            ])
            ->assertForbidden();
    }

    public function test_the_shipped_paper_template_imports_cleanly(): void
    {
        $csvPath = resource_path('templates/paper_import_sample.csv');
        $metaPath = resource_path('templates/paper_import_meta.json');

        $this->assertFileExists($csvPath);
        $this->assertFileExists($metaPath);

        $meta = json_decode(file_get_contents($metaPath), true);
        $meta['test_series_id'] = $this->series->id;

        $file = UploadedFile::fake()->createWithContent('paper.csv', file_get_contents($csvPath));

        $response = $this->importPaper($meta, $file);

        $response->assertCreated()->assertJsonPath('imported', 5);
        $this->assertSame(3, Test::firstOrFail()->sections()->count());
        // The template's DI rows share one inline passage.
        $this->assertSame(2, Question::whereNotNull('passage_id')->count());
    }
}
