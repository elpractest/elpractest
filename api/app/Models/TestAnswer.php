<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TestAnswer extends Model
{
    protected $fillable = [
        'test_session_id',
        'question_id',
        'selected_option_id',
        'is_marked_for_review',
        'is_visited',
        'time_spent_seconds',
        'answered_at',
    ];

    protected function casts(): array
    {
        return [
            'is_marked_for_review' => 'boolean',
            'is_visited' => 'boolean',
            'answered_at' => 'datetime',
        ];
    }

    // ── Relationships ──────────────────────────────────────────────

    public function session(): BelongsTo
    {
        return $this->belongsTo(TestSession::class, 'test_session_id');
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(Question::class);
    }

    public function selectedOption(): BelongsTo
    {
        return $this->belongsTo(QuestionOption::class, 'selected_option_id');
    }

    // ── Helpers ────────────────────────────────────────────────────

    /**
     * Check if this answer is correct.
     *
     * The option must be BOTH correct AND belong to this row's question. Scoping
     * by question_id is not optional: option ids are globally unique across the
     * whole bank, so without it any correct option id from any other question
     * scores as correct here (an unvalidated `selected_option_id` on the save
     * endpoint made that reachable from the client).
     */
    public function isCorrect(): bool
    {
        if ($this->selected_option_id === null) {
            return false;
        }

        return QuestionOption::where('id', $this->selected_option_id)
            ->where('question_id', $this->question_id)
            ->where('is_correct', true)
            ->exists();
    }

    /**
     * Check if the question was attempted (an option was selected).
     */
    public function isAttempted(): bool
    {
        return $this->selected_option_id !== null;
    }
}
