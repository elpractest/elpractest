<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Question extends Model
{
    protected $fillable = [
        'subject',
        'topic',
        'difficulty',
        'exam_tags',
        'question_text',
        'explanation',
        'marks',
        'negative_marks',
        'is_active',
        'created_by',
        'status',
        'reviewed_by',
        'reviewed_at',
        'review_note',
        'difficulty_index',
        'discrimination_index',
        'stats_sample_size',
        'stats_computed_at',
        'question_type',
        'numeric_answer',
        'numeric_tolerance',
        'passage_id',
    ];

    /** Formats real SSC/Banking/RRB papers actually use. */
    public const TYPE_SINGLE_CHOICE = 'single_choice';
    public const TYPE_MULTI_SELECT = 'multi_select';
    public const TYPE_NUMERIC = 'numeric';

    public const QUESTION_TYPES = [
        self::TYPE_SINGLE_CHOICE,
        self::TYPE_MULTI_SELECT,
        self::TYPE_NUMERIC,
    ];

    /** Review states. Only APPROVED questions may enter a published test. */
    public const STATUS_DRAFT = 'draft';
    public const STATUS_PENDING = 'pending_review';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_RETIRED = 'retired';

    public const STATUSES = [
        self::STATUS_DRAFT,
        self::STATUS_PENDING,
        self::STATUS_APPROVED,
        self::STATUS_REJECTED,
        self::STATUS_RETIRED,
    ];

    /** Below this many attempts, item statistics are too noisy to act on. */
    public const MIN_STATS_SAMPLE = 30;

    protected function casts(): array
    {
        return [
            'exam_tags' => 'array',
            'marks' => 'decimal:2',
            'negative_marks' => 'decimal:2',
            'is_active' => 'boolean',
            'reviewed_at' => 'datetime',
            'stats_computed_at' => 'datetime',
            'difficulty_index' => 'float',
            'discrimination_index' => 'float',
            'stats_sample_size' => 'integer',
            'numeric_answer' => 'decimal:4',
            'numeric_tolerance' => 'decimal:4',
        ];
    }

    public function options(): HasMany
    {
        return $this->hasMany(QuestionOption::class)->orderBy('sort_order');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function passage(): BelongsTo
    {
        return $this->belongsTo(Passage::class);
    }

    /**
     * Get the correct option(s) for this question.
     */
    public function correctOptions(): HasMany
    {
        return $this->hasMany(QuestionOption::class)->where('is_correct', true);
    }

    // ── Scopes ─────────────────────────────────────────────────────

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeBySubject($query, string $subject)
    {
        return $query->where('subject', $subject);
    }

    public function scopeByTopic($query, string $topic)
    {
        return $query->where('topic', $topic);
    }

    public function scopeByDifficulty($query, string $difficulty)
    {
        return $query->where('difficulty', $difficulty);
    }

    /** Cleared review. The only questions allowed into a published test. */
    public function scopeApproved($query)
    {
        return $query->where('status', self::STATUS_APPROVED);
    }

    public function scopeByStatus($query, string $status)
    {
        return $query->where('status', $status);
    }

    /** Usable in a live test: approved AND still active. */
    public function scopeUsable($query)
    {
        return $query->where('status', self::STATUS_APPROVED)->where('is_active', true);
    }

    public function reviewedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    /**
     * Item-analysis health flags derived from the cached statistics.
     *
     * A NEGATIVE discrimination index means the candidates who scored well
     * overall were MORE likely to get this one wrong. In practice that is almost
     * always a wrong answer key or an ambiguous stem, so it is surfaced for
     * review rather than left to quietly mis-score every paper it appears in.
     */
    public function itemFlags(): array
    {
        if ((int) $this->stats_sample_size < self::MIN_STATS_SAMPLE) {
            return ['insufficient_data'];
        }

        $flags = [];
        $d = $this->discrimination_index;
        $p = $this->difficulty_index;

        if ($d !== null && $d < 0) {
            $flags[] = 'negative_discrimination';
        } elseif ($d !== null && $d < 0.15) {
            $flags[] = 'weak_discrimination';
        }
        if ($p !== null && $p > 0.95) {
            $flags[] = 'too_easy';
        }
        if ($p !== null && $p < 0.15) {
            $flags[] = 'too_hard';
        }

        return $flags;
    }
}
