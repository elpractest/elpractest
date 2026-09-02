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
        'selected_option_ids',
        'numeric_response',
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
            'selected_option_ids' => 'array',
            'numeric_response' => 'decimal:4',
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
     * Check if this answer is correct, dispatched by the question's type.
     * `ComputeTestAnalytics` never branches on type itself — this is the one
     * place that does, so every scoring/analytics consumer stays generic.
     *
     * single_choice: the option must be BOTH correct AND belong to this row's
     * question. Scoping by question_id is not optional: option ids are globally
     * unique across the whole bank, so without it any correct option id from any
     * other question scores as correct here (an unvalidated `selected_option_id`
     * on the save endpoint made that reachable from the client).
     */
    public function isCorrect(): bool
    {
        $question = $this->question;
        if (!$question) {
            return false;
        }

        return match ($question->question_type ?? Question::TYPE_SINGLE_CHOICE) {
            Question::TYPE_MULTI_SELECT => self::multiSelectMatches(
                $this->selected_option_ids,
                $question->correctOptions()->pluck('id')->map(fn ($i) => (int) $i)->all()
            ),
            Question::TYPE_NUMERIC => self::numericMatches(
                $this->numeric_response,
                $question->numeric_answer,
                $question->numeric_tolerance
            ),
            default => $this->selected_option_id !== null && QuestionOption::where('id', $this->selected_option_id)
                ->where('question_id', $this->question_id)
                ->where('is_correct', true)
                ->exists(),
        };
    }

    /**
     * Check if the question was attempted, per its type's notion of "answered".
     */
    public function isAttempted(): bool
    {
        return match ($this->question?->question_type ?? Question::TYPE_SINGLE_CHOICE) {
            Question::TYPE_MULTI_SELECT => is_array($this->selected_option_ids) && $this->selected_option_ids !== [],
            Question::TYPE_NUMERIC => $this->numeric_response !== null,
            default => $this->selected_option_id !== null,
        };
    }

    /**
     * Multi-select is graded all-or-nothing: the chosen set must exactly equal
     * the correct set. No partial credit — matches how SSC/RRB statement-based
     * questions are marked in practice, and keeps every consumer of isCorrect()
     * a plain boolean instead of needing a fractional-marks path.
     *
     * Shared with ItemAnalysisService, which works from raw DB rows rather than
     * hydrated models for bulk performance, so the comparison logic lives here
     * once instead of being duplicated.
     */
    public static function multiSelectMatches(?array $selectedOptionIds, array $correctOptionIds): bool
    {
        if ($selectedOptionIds === null || $selectedOptionIds === []) {
            return false;
        }

        $selected = array_unique(array_map('intval', $selectedOptionIds));
        sort($selected);
        $correct = array_unique(array_map('intval', $correctOptionIds));
        sort($correct);

        return $selected === $correct;
    }

    /**
     * Numeric answers match within the question's stated tolerance (0 = exact).
     * The tiny epsilon absorbs decimal-cast float rounding, not exam leniency.
     */
    public static function numericMatches($response, $answer, $tolerance): bool
    {
        if ($response === null || $answer === null) {
            return false;
        }

        $tolerance = $tolerance !== null ? (float) $tolerance : 0.0;

        return abs((float) $response - (float) $answer) <= $tolerance + 1e-9;
    }
}
