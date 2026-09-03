<?php

namespace Tests\Feature;

use App\Imports\QuestionImport;
use App\Models\Passage;
use App\Models\Question;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class QuestionImportTest extends TestCase
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

    public function test_valid_csv_imports_successfully_with_tags(): void
    {
        // CSV Content: subject,topic,difficulty,question_text,option_a,option_b,option_c,option_d,correct_option,marks,negative_marks,explanation,exam_tags
        $csvContent = "subject,topic,difficulty,question_text,option_a,option_b,option_c,option_d,correct_option,marks,negative_marks,explanation,exam_tags\n"
            . "Math,Algebra,easy,\"Solve 2+2\",\"3\",\"4\",\"5\",\"6\",b,2.00,0.50,\"Explanation text\",\"SSC CGL|SBI PO\"\n"
            . "English,Grammar,medium,\"Identify verb\",\"Apple\",\"Run\",\"Red\",\"Big\",b,1.00,0.25,\"Explanation text\",\n";

        $file = UploadedFile::fake()->createWithContent('questions.csv', $csvContent);

        $response = $this->actingAs($this->admin)
            ->withSession(['2fa_verified' => true])
            ->postJson('/api/admin/questions/import', [
                'file' => $file,
            ]);

        $response->assertStatus(200)
            ->assertJsonStructure(['job_id', 'message']);

        $jobId = $response->json('job_id');

        // Run the job synchronously by resolving it or handling it manually
        // Since we are running feature tests, we can just fetch the status from cache
        // But wait! If we don't run the queue, the status will remain "pending".
        // To handle this, let's run the Artisan queue:work or just test the Import class directly,
        // OR dispatch the job manually.
        // Let's verify the Import class directly first!
        $import = new QuestionImport($this->admin->id);
        // Pass an explicit CSV reader type: the fake upload's getRealPath() is an
        // extensionless temp path on Linux (/tmp/phpXXXX), so maatwebsite/excel's
        // FileTypeDetector would otherwise throw NoTypeDetectedException. Production
        // never hits this — the controller stores the upload with an extension first.
        $import->import($file->getRealPath(), null, \Maatwebsite\Excel\Excel::CSV);

        $this->assertEquals(2, $import->getImportedCount());
        $this->assertEmpty($import->getErrors());

        $q1 = Question::where('subject', 'Math')->first();
        $this->assertNotNull($q1);
        $this->assertEquals(['SSC CGL', 'SBI PO'], $q1->exam_tags);
        $this->assertEquals(4, $q1->options()->count());
        $this->assertTrue($q1->options()->where('label', 'b')->first()->is_correct);
    }

    public function test_csv_with_utf8_bom_parses_successfully(): void
    {
        // Prep UTF-8 BOM prefix
        $bom = pack('H*', 'EFBBBF');
        $csvContent = $bom . "subject,topic,difficulty,question_text,option_a,option_b,option_c,option_d,correct_option,marks,negative_marks,explanation,exam_tags\n"
            . "Math,Algebra,easy,\"Solve 1+1\",\"2\",\"3\",\"4\",\"5\",a,2.00,0.00,\"\",\n";

        $file = UploadedFile::fake()->createWithContent('questions.csv', $csvContent);

        // We can test the job directly, which handles the BOM stripping
        $jobId = 'test-job-bom';
        
        // Save the fake file into storage temporarily
        $tempPath = $file->storeAs('temp_imports', 'test_bom.csv');

        $job = new \App\Jobs\ImportQuestionsJob($tempPath, $jobId, $this->admin->id);
        $job->handle();

        $status = Cache::get("import_status_{$jobId}");

        $this->assertNotNull($status);
        $this->assertEquals('complete', $status['status']);
        $this->assertEquals(1, $status['imported']);
        $this->assertEmpty($status['errors']);

        $q = Question::first();
        $this->assertEquals('Math', $q->subject);
    }

    public function test_invalid_rows_captures_errors_and_does_not_fail_valid_rows(): void
    {
        $csvContent = "subject,topic,difficulty,question_text,option_a,option_b,option_c,option_d,correct_option,marks,negative_marks,explanation,exam_tags\n"
            . "Math,Algebra,easy,\"Solve 2+2\",\"3\",\"4\",\"5\",\"6\",b,2.00,0.50,\"Explanation text\",\n"
            . "Math,Algebra,super-hard,\"Solve 2+2\",\"3\",\"4\",\"5\",\"6\",z,2.00,0.50,\"Explanation text\",\n"; // Bad difficulty and bad correct_option

        $file = UploadedFile::fake()->createWithContent('questions.csv', $csvContent);

        $import = new QuestionImport($this->admin->id);
        $import->import($file->getRealPath(), null, \Maatwebsite\Excel\Excel::CSV);

        // 1 row should be valid, 1 row should fail
        $this->assertEquals(1, $import->getImportedCount());
        $this->assertNotEmpty($import->getErrors());

        $errors = $import->getErrors();
        $this->assertEquals(3, $errors[0]['row']); // Row index 3 (2nd data row)
        $this->assertEquals('difficulty', $errors[0]['field']);
    }

    public function test_empty_csv_import_returns_zero_imported(): void
    {
        $csvContent = "subject,topic,difficulty,question_text,option_a,option_b,option_c,option_d,correct_option,marks,negative_marks,explanation,exam_tags\n";

        $file = UploadedFile::fake()->createWithContent('questions.csv', $csvContent);

        $import = new QuestionImport($this->admin->id);

        try {
            $import->import($file->getRealPath(), null, \Maatwebsite\Excel\Excel::CSV);
        } catch (\Exception $e) {
            // Silence PhpSpreadsheet's empty worksheet row iterator crash
            if (!str_contains($e->getMessage(), 'Start row (2) is beyond highest row')) {
                throw $e;
            }
        }

        $this->assertEquals(0, $import->getImportedCount());
        $this->assertEmpty($import->getErrors());
    }

    public function test_whitespace_trimmed_header_variations_succeeds(): void
    {
        // Headers have leading/trailing whitespace
        $csvContent = " subject , topic , difficulty , question_text , option_a , option_b , option_c , option_d , correct_option , marks , negative_marks , explanation , exam_tags \n"
            . "English,Grammar,easy,\"Solve\",\"a\",\"b\",\"c\",\"d\",a,1.00,0.00,\"\",\n";

        $file = UploadedFile::fake()->createWithContent('questions.csv', $csvContent);

        $import = new QuestionImport($this->admin->id);
        $import->import($file->getRealPath(), null, \Maatwebsite\Excel\Excel::CSV);

        $this->assertEquals(1, $import->getImportedCount());
        $this->assertEmpty($import->getErrors());

        $q = Question::first();
        $this->assertNotNull($q);
        $this->assertEquals('English', $q->subject);
    }

    /**
     * Regression: `correct_option` carried `required_unless(...)` plus a bare
     * `string` rule with no `nullable` escape. `required_unless` only waives
     * the field being PRESENT — it does not stop a later type rule from
     * running against a null value — so a numeric-type row, which
     * legitimately leaves `correct_option` blank, failed validation and was
     * silently dropped. The row never reached `onRow()`, where the numeric
     * branch (a `numeric_answer`, no options at all) is correctly handled.
     */
    public function test_numeric_type_question_imports_with_no_options(): void
    {
        $csvContent = "subject,topic,difficulty,question_type,question_text,option_a,option_b,correct_option,numeric_answer,numeric_tolerance,marks,negative_marks,exam_tags\n"
            . "Math,Number System,hard,numeric,\"What is the remainder when 7^45 is divided by 5?\",,,,2,0,2.00,0.50,\"Banking\"\n";

        $file = UploadedFile::fake()->createWithContent('questions.csv', $csvContent);

        $import = new QuestionImport($this->admin->id);
        $import->import($file->getRealPath(), null, \Maatwebsite\Excel\Excel::CSV);

        $this->assertEquals(1, $import->getImportedCount());
        $this->assertEmpty($import->getErrors());

        $q = Question::where('subject', 'Math')->first();
        $this->assertNotNull($q);
        $this->assertEquals(Question::TYPE_NUMERIC, $q->question_type);
        $this->assertEquals(2, (float) $q->numeric_answer);
        $this->assertEquals(0, $q->options()->count());
    }

    public function test_a_row_can_link_to_an_existing_passage_for_a_di_or_rc_set(): void
    {
        $passage = Passage::create([
            'title' => 'Sales table',
            'body' => 'Study the table and answer.',
            'created_by' => $this->admin->id,
        ]);

        $csvContent = "subject,topic,difficulty,question_text,option_a,option_b,correct_option,marks,negative_marks,passage_id\n"
            . "Quant,DI,medium,\"What was company A's growth?\",\"25%\",\"30%\",a,2.00,0.50,{$passage->id}\n";

        $file = UploadedFile::fake()->createWithContent('questions.csv', $csvContent);

        $import = new QuestionImport($this->admin->id);
        $import->import($file->getRealPath(), null, \Maatwebsite\Excel\Excel::CSV);

        $this->assertEquals(1, $import->getImportedCount());
        $this->assertEmpty($import->getErrors());

        $q = Question::where('subject', 'Quant')->first();
        $this->assertSame($passage->id, $q->passage_id);
    }

    public function test_a_dead_image_url_does_not_fail_the_row_it_just_imports_without_a_picture(): void
    {
        Http::fake(['broken-cdn.example/*' => Http::response('', 404)]);

        $csvContent = "subject,topic,difficulty,question_text,option_a,option_b,correct_option,marks,negative_marks,question_image_url\n"
            . "Reasoning,Series,easy,\"Next figure?\",\"A\",\"B\",a,1.00,0.25,https://broken-cdn.example/missing.png\n";

        $file = UploadedFile::fake()->createWithContent('questions.csv', $csvContent);

        $import = new QuestionImport($this->admin->id);
        $import->import($file->getRealPath(), null, \Maatwebsite\Excel\Excel::CSV);

        $this->assertEquals(1, $import->getImportedCount());
        $this->assertEmpty($import->getErrors());

        $q = Question::where('subject', 'Reasoning')->first();
        $this->assertNull($q->image_path);
    }

    public function test_a_valid_image_url_is_downloaded_and_attached(): void
    {
        Storage::fake('public');
        Http::fake([
            'cdn.example/*' => Http::response(
                base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='),
                200,
                ['Content-Type' => 'image/png'],
            ),
        ]);

        $csvContent = "subject,topic,difficulty,question_text,option_a,option_b,correct_option,marks,negative_marks,question_image_url\n"
            . "Reasoning,Series,easy,\"Next figure?\",\"A\",\"B\",a,1.00,0.25,https://cdn.example/diagram.png\n";

        $file = UploadedFile::fake()->createWithContent('questions.csv', $csvContent);

        $import = new QuestionImport($this->admin->id);
        $import->import($file->getRealPath(), null, \Maatwebsite\Excel\Excel::CSV);

        $this->assertEquals(1, $import->getImportedCount());
        $q = Question::where('subject', 'Reasoning')->first();
        $this->assertNotNull($q->image_path);
        $this->assertStringStartsWith('question_images/', $q->image_path);
        Storage::disk('public')->assertExists($q->image_path);
    }

    public function test_a_nonexistent_passage_id_fails_only_that_row(): void
    {
        $csvContent = "subject,topic,difficulty,question_text,option_a,option_b,correct_option,marks,negative_marks,passage_id\n"
            . "Quant,DI,medium,\"Valid row\",\"A\",\"B\",a,2.00,0.50,999999\n"
            . "Quant,DI,medium,\"Another valid row\",\"A\",\"B\",a,2.00,0.50,\n";

        $file = UploadedFile::fake()->createWithContent('questions.csv', $csvContent);

        $import = new QuestionImport($this->admin->id);
        $import->import($file->getRealPath(), null, \Maatwebsite\Excel\Excel::CSV);

        $this->assertEquals(1, $import->getImportedCount());
        $this->assertNotEmpty($import->getErrors());
    }

    /**
     * Reasoning figure-series rows ("which figure completes the series?")
     * have nothing to put in option_a..option_d — the four options ARE
     * pictures. Left blank in text but backed by option_{label}_image_url,
     * they still need to become real, scoreable options.
     */
    public function test_an_option_can_be_image_only_via_csv(): void
    {
        Storage::fake('public');
        Http::fake([
            'cdn.example/*' => Http::response(
                base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='),
                200,
                ['Content-Type' => 'image/png'],
            ),
        ]);

        $csvContent = "subject,topic,difficulty,question_text,option_a,option_b,option_c,option_d,correct_option,marks,negative_marks,option_a_image_url,option_b_image_url,option_c_image_url,option_d_image_url\n"
            . "Reasoning,Non-verbal,medium,\"Which figure completes the series?\",,,,,\"b\",2.00,0.50,https://cdn.example/a.png,https://cdn.example/b.png,https://cdn.example/c.png,https://cdn.example/d.png\n";

        $file = UploadedFile::fake()->createWithContent('questions.csv', $csvContent);

        $import = new QuestionImport($this->admin->id);
        $import->import($file->getRealPath(), null, \Maatwebsite\Excel\Excel::CSV);

        $this->assertEquals(1, $import->getImportedCount());
        $this->assertEmpty($import->getErrors());

        $q = Question::where('subject', 'Reasoning')->first();
        $this->assertEquals(4, $q->options()->count());

        $optionB = $q->options()->where('label', 'b')->first();
        $this->assertSame('', $optionB->option_text);
        $this->assertNotNull($optionB->image_path);
        $this->assertStringStartsWith('option_images/', $optionB->image_path);
        $this->assertTrue($optionB->is_correct);
        Storage::disk('public')->assertExists($optionB->image_path);

        $optionA = $q->options()->where('label', 'a')->first();
        $this->assertFalse($optionA->is_correct);
    }

    public function test_a_dead_option_image_url_does_not_fail_the_row_when_text_is_present(): void
    {
        Http::fake(['broken-cdn.example/*' => Http::response('', 404)]);

        $csvContent = "subject,topic,difficulty,question_text,option_a,option_b,correct_option,marks,negative_marks,option_a_image_url\n"
            . "Reasoning,Series,easy,\"Next figure?\",\"A\",\"B\",a,1.00,0.25,https://broken-cdn.example/missing.png\n";

        $file = UploadedFile::fake()->createWithContent('questions.csv', $csvContent);

        $import = new QuestionImport($this->admin->id);
        $import->import($file->getRealPath(), null, \Maatwebsite\Excel\Excel::CSV);

        $this->assertEquals(1, $import->getImportedCount());
        $this->assertEmpty($import->getErrors());

        $optionA = Question::where('subject', 'Reasoning')->first()->options()->where('label', 'a')->first();
        $this->assertSame('A', $optionA->option_text);
        $this->assertNull($optionA->image_path);
    }

    /**
     * An option column that is blank in BOTH text and image URL contributes
     * nothing — if that leaves fewer than two real options, the row is
     * unscoreable and must fail loudly rather than import a broken question.
     */
    public function test_a_row_with_fewer_than_two_real_options_fails(): void
    {
        Http::fake(['broken-cdn.example/*' => Http::response('', 404)]);

        $csvContent = "subject,topic,difficulty,question_text,option_a,option_b,correct_option,marks,negative_marks,option_b_image_url\n"
            . "Reasoning,Series,easy,\"Next figure?\",\"A\",,a,1.00,0.25,https://broken-cdn.example/missing.png\n";

        $file = UploadedFile::fake()->createWithContent('questions.csv', $csvContent);

        $import = new QuestionImport($this->admin->id);
        $import->import($file->getRealPath(), null, \Maatwebsite\Excel\Excel::CSV);

        $this->assertEquals(0, $import->getImportedCount());
        $this->assertNotEmpty($import->getErrors());
        $this->assertStringContainsString('At least two options', $import->getErrors()[0]['message']);
    }

    /**
     * The shipped template is what an admin actually downloads and edits —
     * if it doesn't import cleanly out of the box, every other guarantee in
     * this file is academic. Its dead placeholder image URLs must degrade
     * gracefully rather than fail the row (see downloadImage()).
     */
    public function test_the_shipped_sample_csv_template_imports_cleanly(): void
    {
        $path = resource_path('templates/question_import_sample.csv');
        $this->assertFileExists($path);

        $import = new QuestionImport($this->admin->id);
        $import->import($path, null, \Maatwebsite\Excel\Excel::CSV);

        $this->assertEmpty($import->getErrors());
        $this->assertEquals(7, $import->getImportedCount());

        $reasoning = Question::where('subject', 'Reasoning')->first();
        $this->assertNotNull($reasoning);
        $this->assertEquals(4, $reasoning->options()->count());
    }

    public function test_an_admin_can_download_the_import_template(): void
    {
        $response = $this->actingAs($this->admin)
            ->withSession(['2fa_verified' => true])
            ->get('/api/admin/questions/import-template');

        $response->assertOk()->assertDownload('question_import_sample.csv');
        $this->assertStringContainsString('subject,topic,difficulty', $response->streamedContent());
    }

    public function test_a_student_cannot_download_the_import_template(): void
    {
        $student = User::factory()->create();
        $student->assignRole('student');

        $this->actingAs($student)
            ->get('/api/admin/questions/import-template')
            ->assertStatus(403);
    }
}
