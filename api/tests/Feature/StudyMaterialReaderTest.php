<?php

namespace Tests\Feature;

use App\Models\Batch;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\MaterialAnnotation;
use App\Models\ReadingProgress;
use App\Models\StudyMaterial;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * The study-material shelf and the ebook reader behind it.
 *
 * Two things are worth pinning here and they are both about the gate. First,
 * every action re-asks — listing, metadata, the file stream and each write —
 * because a filtered listing plus an unchecked action is exactly the shape of
 * the test-start hole EntitlementService was written to close. Second, the PDF
 * itself is never reachable except through the gated stream: no public URL, and
 * `file_path` never leaves the server.
 */
class StudyMaterialReaderTest extends TestCase
{
    use RefreshDatabase;

    private User $enrolled;
    private User $outsider;
    private User $admin;
    private Course $course;
    private StudyMaterial $material;

    protected function setUp(): void
    {
        parent::setUp();

        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);

        Storage::fake(config('studymaterials.disk'));

        $this->enrolled = User::factory()->create();
        $this->enrolled->assignRole('student');

        $this->outsider = User::factory()->create();
        $this->outsider->assignRole('student');

        $this->admin = User::factory()->create();
        $this->admin->assignRole('admin');
        // The admin routes sit behind `2fa.verified`; enrolling the account is
        // what the other admin suites do to get past it.
        $this->admin->update([
            'google2fa_enabled' => true,
            'google2fa_secret' => 'B39XKJ2938JJD982',
        ]);

        $this->course = Course::create([
            'title' => 'SSC CGL Master Class',
            'description' => 'Course description',
            'exam_category' => 'SSC',
        ]);

        $batch = Batch::create(['course_id' => $this->course->id, 'name' => 'Batch A']);

        Enrollment::create([
            'user_id' => $this->enrolled->id,
            'course_id' => $this->course->id,
            'batch_id' => $batch->id,
            'enrolled_at' => now(),
            'is_active' => true,
        ]);

        $this->material = $this->makeMaterial();
    }

    private function makeMaterial(array $overrides = []): StudyMaterial
    {
        $path = config('studymaterials.directory').'/quant-formulae.pdf';
        Storage::disk(config('studymaterials.disk'))->put($path, '%PDF-1.4 fake');

        return StudyMaterial::create(array_merge([
            'course_id' => $this->course->id,
            'title' => 'Quantitative Aptitude — Formula Booklet',
            'subject' => 'Quantitative Aptitude',
            'file_path' => $path,
            'original_filename' => 'quant-formulae.pdf',
            'file_size' => 13,
            'page_count' => 40,
        ], $overrides));
    }

    // ── Access ────────────────────────────────────────────────────────────

    public function test_an_enrolled_student_sees_the_material_on_their_shelf(): void
    {
        $this->actingAs($this->enrolled)
            ->getJson('/api/student/study-materials')
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('materials.0.title', 'Quantitative Aptitude — Formula Booklet');
    }

    public function test_an_unenrolled_student_sees_an_empty_shelf(): void
    {
        $this->actingAs($this->outsider)
            ->getJson('/api/student/study-materials')
            ->assertOk()
            ->assertJsonPath('total', 0);
    }

    public function test_an_unenrolled_student_cannot_open_the_material_by_guessing_its_id(): void
    {
        $this->actingAs($this->outsider)
            ->getJson("/api/student/study-materials/{$this->material->id}")
            ->assertStatus(403);
    }

    public function test_an_unenrolled_student_cannot_stream_the_file(): void
    {
        $this->actingAs($this->outsider)
            ->get("/api/student/study-materials/{$this->material->id}/file")
            ->assertStatus(403);
    }

    public function test_an_enrolled_student_streams_the_file_inline_as_a_pdf(): void
    {
        $response = $this->actingAs($this->enrolled)
            ->get("/api/student/study-materials/{$this->material->id}/file")
            ->assertOk();

        $this->assertSame('application/pdf', $response->headers->get('Content-Type'));
        $this->assertStringStartsWith('inline;', (string) $response->headers->get('Content-Disposition'));
    }

    public function test_a_free_preview_material_is_open_to_any_signed_in_student(): void
    {
        $preview = $this->makeMaterial(['title' => 'Sample chapter', 'is_free_preview' => true]);

        $this->actingAs($this->outsider)
            ->getJson("/api/student/study-materials/{$preview->id}")
            ->assertOk();
    }

    public function test_an_unpublished_material_is_closed_even_to_an_enrolled_student(): void
    {
        $draft = $this->makeMaterial(['title' => 'Draft', 'is_published' => false]);

        $this->actingAs($this->enrolled)
            ->getJson("/api/student/study-materials/{$draft->id}")
            ->assertStatus(403);
    }

    public function test_the_storage_path_is_never_sent_to_the_client(): void
    {
        $this->actingAs($this->enrolled)
            ->getJson("/api/student/study-materials/{$this->material->id}")
            ->assertOk()
            ->assertJsonMissingPath('material.file_path');
    }

    // ── Reading position ──────────────────────────────────────────────────

    public function test_reading_position_is_saved_and_returned_on_the_next_open(): void
    {
        $this->actingAs($this->enrolled)
            ->patchJson("/api/student/study-materials/{$this->material->id}/progress", [
                'current_page' => 24,
                'percent_complete' => 60,
                'seconds_read' => 300,
                'bookmarks' => [3, 24, 3],
            ])
            ->assertOk()
            ->assertJsonPath('progress.current_page', 24)
            ->assertJsonPath('progress.bookmarks', [3, 24]);   // deduped and sorted

        $this->actingAs($this->enrolled)
            ->getJson("/api/student/study-materials/{$this->material->id}")
            ->assertOk()
            ->assertJsonPath('progress.current_page', 24)
            ->assertJsonPath('progress.percent_complete', 60);
    }

    public function test_seconds_read_accumulates_across_syncs_rather_than_overwriting(): void
    {
        $url = "/api/student/study-materials/{$this->material->id}/progress";

        $this->actingAs($this->enrolled)->patchJson($url, ['current_page' => 2, 'seconds_read' => 120]);
        $this->actingAs($this->enrolled)->patchJson($url, ['current_page' => 5, 'seconds_read' => 90])
            ->assertJsonPath('progress.seconds_read', 210);
    }

    public function test_flipping_back_moves_the_page_but_never_lowers_percent_complete(): void
    {
        $url = "/api/student/study-materials/{$this->material->id}/progress";

        $this->actingAs($this->enrolled)->patchJson($url, ['current_page' => 30, 'percent_complete' => 75]);

        $this->actingAs($this->enrolled)
            ->patchJson($url, ['current_page' => 4, 'percent_complete' => 10])
            ->assertOk()
            ->assertJsonPath('progress.current_page', 4)
            ->assertJsonPath('progress.percent_complete', 75);
    }

    public function test_an_unenrolled_student_cannot_write_progress(): void
    {
        $this->actingAs($this->outsider)
            ->patchJson("/api/student/study-materials/{$this->material->id}/progress", ['current_page' => 2])
            ->assertStatus(403);

        $this->assertDatabaseCount('reading_progress', 0);
    }

    public function test_progress_is_one_row_per_student_and_material(): void
    {
        $url = "/api/student/study-materials/{$this->material->id}/progress";

        $this->actingAs($this->enrolled)->patchJson($url, ['current_page' => 2]);
        $this->actingAs($this->enrolled)->patchJson($url, ['current_page' => 9]);

        $this->assertDatabaseCount('reading_progress', 1);
        $this->assertSame(9, ReadingProgress::first()->current_page);
    }

    // ── Highlights and notes ──────────────────────────────────────────────

    public function test_a_student_can_highlight_a_passage_and_read_it_back(): void
    {
        $this->actingAs($this->enrolled)
            ->postJson("/api/student/study-materials/{$this->material->id}/annotations", [
                'type' => 'highlight',
                'color' => 'green',
                'page' => 12,
                'selected_text' => 'compound interest is charged on the accumulated amount',
                'rects' => [['x' => 0.1, 'y' => 0.2, 'w' => 0.5, 'h' => 0.02]],
            ])
            ->assertCreated()
            ->assertJsonPath('annotation.color', 'green');

        $this->actingAs($this->enrolled)
            ->getJson("/api/student/study-materials/{$this->material->id}/annotations")
            ->assertOk()
            ->assertJsonCount(1, 'annotations')
            ->assertJsonPath('annotations.0.page', 12);
    }

    public function test_an_unenrolled_student_cannot_annotate(): void
    {
        $this->actingAs($this->outsider)
            ->postJson("/api/student/study-materials/{$this->material->id}/annotations", [
                'type' => 'highlight',
                'page' => 1,
            ])
            ->assertStatus(403);
    }

    public function test_annotations_are_private_to_their_author(): void
    {
        $preview = $this->makeMaterial(['title' => 'Sample chapter', 'is_free_preview' => true]);

        $mine = MaterialAnnotation::create([
            'user_id' => $this->enrolled->id,
            'study_material_id' => $preview->id,
            'type' => 'note',
            'page' => 3,
            'note' => 'revise before the mock',
        ]);

        // The outsider may open this material (it is a free preview) but must
        // not see, edit or delete somebody else's marks on it.
        $this->actingAs($this->outsider)
            ->getJson("/api/student/study-materials/{$preview->id}/annotations")
            ->assertOk()
            ->assertJsonCount(0, 'annotations');

        $this->actingAs($this->outsider)
            ->putJson("/api/student/annotations/{$mine->id}", ['note' => 'tampered'])
            ->assertStatus(404);

        $this->actingAs($this->outsider)
            ->deleteJson("/api/student/annotations/{$mine->id}")
            ->assertStatus(404);

        $this->assertDatabaseHas('material_annotations', ['id' => $mine->id, 'note' => 'revise before the mock']);
    }

    public function test_a_student_can_edit_and_delete_their_own_note(): void
    {
        $note = MaterialAnnotation::create([
            'user_id' => $this->enrolled->id,
            'study_material_id' => $this->material->id,
            'type' => 'note',
            'page' => 3,
            'note' => 'first draft',
        ]);

        $this->actingAs($this->enrolled)
            ->putJson("/api/student/annotations/{$note->id}", ['note' => 'revised', 'color' => 'pink'])
            ->assertOk()
            ->assertJsonPath('annotation.note', 'revised')
            ->assertJsonPath('annotation.color', 'pink');

        $this->actingAs($this->enrolled)
            ->deleteJson("/api/student/annotations/{$note->id}")
            ->assertOk();

        $this->assertDatabaseCount('material_annotations', 0);
    }

    public function test_an_unknown_highlight_colour_is_rejected(): void
    {
        $this->actingAs($this->enrolled)
            ->postJson("/api/student/study-materials/{$this->material->id}/annotations", [
                'type' => 'highlight',
                'color' => 'chartreuse',
                'page' => 1,
            ])
            ->assertStatus(422);
    }

    // ── Admin upload ──────────────────────────────────────────────────────

    public function test_an_admin_uploads_a_pdf_onto_the_private_disk(): void
    {
        $file = UploadedFile::fake()->create('notes.pdf', 200, 'application/pdf');

        $response = $this->actingAs($this->admin)
            ->post("/api/admin/courses/{$this->course->id}/study-materials", [
                'title' => 'Polity notes',
                'subject' => 'Polity',
                'file' => $file,
            ])
            ->assertCreated();

        $material = StudyMaterial::find($response->json('material.id'));

        Storage::disk(config('studymaterials.disk'))->assertExists($material->file_path);
        $this->assertStringStartsWith(config('studymaterials.directory').'/', $material->file_path);
        $this->assertSame('notes.pdf', $material->original_filename);
    }

    public function test_a_non_pdf_upload_is_rejected(): void
    {
        $this->actingAs($this->admin)
            ->post("/api/admin/courses/{$this->course->id}/study-materials", [
                'title' => 'Not a booklet',
                'file' => UploadedFile::fake()->image('cheatsheet.png'),
            ], ['Accept' => 'application/json'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('file');
    }

    public function test_a_student_cannot_reach_the_admin_upload_endpoint(): void
    {
        $this->actingAs($this->enrolled)
            ->post("/api/admin/courses/{$this->course->id}/study-materials", [
                'title' => 'Mine now',
                'file' => UploadedFile::fake()->create('x.pdf', 10, 'application/pdf'),
            ])
            ->assertStatus(403);
    }

    public function test_deleting_a_material_removes_its_file_and_its_readers_marks(): void
    {
        MaterialAnnotation::create([
            'user_id' => $this->enrolled->id,
            'study_material_id' => $this->material->id,
            'type' => 'highlight',
            'page' => 1,
        ]);

        $path = $this->material->file_path;

        $this->actingAs($this->admin)
            ->deleteJson("/api/admin/study-materials/{$this->material->id}")
            ->assertOk();

        Storage::disk(config('studymaterials.disk'))->assertMissing($path);
        $this->assertDatabaseCount('material_annotations', 0);
    }
}
