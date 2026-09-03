<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A student's own marks on a study material: a highlight over a run of text,
 * or a note anchored to it.
 *
 * `rects` holds the selection geometry in PAGE-NORMALISED coordinates
 * (0..1 of page width/height, top-left origin) rather than pixels. The reader
 * renders the same PDF at whatever zoom, device pixel ratio and page width the
 * screen gives it, so a pixel rectangle saved on a phone would land in the
 * wrong place on a laptop. Normalised, the overlay just multiplies by the
 * rendered viewport.
 *
 * Private per student. There is deliberately no sharing rail — everything here
 * is scoped by user_id, and the controller filters on auth()->id() rather than
 * trusting an id from the request.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('material_annotations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('study_material_id')->constrained()->cascadeOnDelete();
            $table->string('type', 16)->default('highlight');  // highlight | note
            $table->string('color', 16)->default('yellow');    // yellow|green|blue|pink|purple
            $table->unsignedInteger('page');
            $table->text('selected_text')->nullable();
            $table->text('note')->nullable();
            $table->json('rects')->nullable();                 // [{x,y,w,h}, ...] normalised 0..1
            $table->timestamps();

            $table->index(['study_material_id', 'user_id', 'page']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('material_annotations');
    }
};
