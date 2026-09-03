<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A downloadable/readable PDF attached to a course — notes, a handout, a
 * previous-year paper booklet, a formula sheet.
 *
 * It hangs off a COURSE, not a lesson, because that is the unit access is
 * granted in (EntitlementService::hasCourse). `module_id` is an optional
 * grouping so a booklet can sit inside the module it belongs to in the
 * outline; a material with no module is a course-level resource.
 *
 * The file itself lives on the PRIVATE disk. It is never given a public URL:
 * the student reader streams it through
 * `GET /api/student/study-materials/{material}/file`, which re-checks the
 * entitlement on every request. Putting a paid PDF on the `public` disk would
 * make the entitlement decorative — the URL would be guessable and shareable.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('study_materials', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_id')->constrained()->cascadeOnDelete();
            $table->foreignId('module_id')->nullable()->constrained('course_modules')->nullOnDelete();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('subject')->nullable();          // filter chip in the materials list
            $table->string('file_path');                    // relative to the private disk
            $table->string('original_filename')->nullable(); // what the admin uploaded, for the UI
            $table->unsignedBigInteger('file_size')->default(0);
            $table->unsignedInteger('page_count')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_free_preview')->default(false);
            $table->boolean('is_published')->default(true);
            $table->timestamps();

            $table->index(['course_id', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('study_materials');
    }
};
