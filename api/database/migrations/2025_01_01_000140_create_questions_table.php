<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('questions', function (Blueprint $table) {
            $table->id();
            $table->string('subject');
            $table->string('topic');
            $table->string('difficulty'); // easy, medium, hard
            $table->json('exam_tags')->nullable(); // ["SSC CGL", "SBI PO"]
            $table->text('question_text'); // supports KaTeX
            $table->text('explanation')->nullable();
            $table->decimal('marks', 5, 2)->default(1.00);
            $table->decimal('negative_marks', 5, 2)->default(0.00);
            $table->boolean('is_active')->default(true);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['subject', 'topic']);
            $table->index('difficulty');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('questions');
    }
};
