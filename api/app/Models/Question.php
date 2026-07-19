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
    ];

    protected function casts(): array
    {
        return [
            'exam_tags' => 'array',
            'marks' => 'decimal:2',
            'negative_marks' => 'decimal:2',
            'is_active' => 'boolean',
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
}
