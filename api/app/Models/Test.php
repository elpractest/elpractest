<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Test extends Model
{
    protected $fillable = [
        'title',
        'course_id',
        'batch_id',
        'test_series_id',
        'series_sort_order',
        'category',
        'is_free',
        'type',
        'duration_seconds',
        'max_attempts',
        'total_marks',
        'instructions',
        'is_published',
        'available_from',
        'available_until',
        'created_by',
        'cutoff_marks',
        'cutoff_percentage',
        'shuffle_questions',
        'shuffle_options',
        'shift_group',
        'shift_label',
        'normalization_method',
    ];

    protected function casts(): array
    {
        return [
            'total_marks' => 'decimal:2',
            'max_attempts' => 'integer',
            'series_sort_order' => 'integer',
            'is_free' => 'boolean',
            'is_published' => 'boolean',
            'available_from' => 'datetime',
            'available_until' => 'datetime',
            'cutoff_marks' => 'decimal:2',
            'cutoff_percentage' => 'decimal:2',
            'shuffle_questions' => 'boolean',
            'shuffle_options' => 'boolean',
        ];
    }

    // ── Relationships ──────────────────────────────────────────────

    public function testSeries(): BelongsTo
    {
        return $this->belongsTo(TestSeries::class, 'test_series_id');
    }

    public function assignments(): \Illuminate\Database\Eloquent\Relations\MorphMany
    {
        return $this->morphMany(Assignment::class, 'assignable');
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(Batch::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function sections(): HasMany
    {
        return $this->hasMany(TestSection::class)->orderBy('sort_order');
    }

    public function sessions(): HasMany
    {
        return $this->hasMany(TestSession::class);
    }

    // ── Scopes ─────────────────────────────────────────────────────

    public function scopePublished($query)
    {
        return $query->where('is_published', true);
    }

    public function scopeAvailable($query)
    {
        return $query->where('is_published', true)
            ->where(function ($q) {
                $q->whereNull('available_from')
                  ->orWhere('available_from', '<=', now());
            })
            ->where(function ($q) {
                $q->whereNull('available_until')
                  ->orWhere('available_until', '>=', now());
            });
    }

    // ── Helpers ────────────────────────────────────────────────────

    /**
     * Check if this test is timed (mock tests have a duration, practice may not).
     */
    public function isTimed(): bool
    {
        return $this->duration_seconds !== null && $this->duration_seconds > 0;
    }

    /** Any sectional timer set means the paper runs section-by-section. */
    public function hasSectionalTiming(): bool
    {
        return $this->sections->contains(fn ($s) => $s->hasSectionalTiming());
    }

    /**
     * Overall qualifying bar in absolute marks, or null when there is none.
     * Absolute marks take precedence over the percentage when both are set.
     */
    public function overallCutoffMarks(): ?float
    {
        if ($this->cutoff_marks !== null) {
            return (float) $this->cutoff_marks;
        }
        if ($this->cutoff_percentage !== null && $this->total_marks !== null) {
            return round((float) $this->total_marks * (float) $this->cutoff_percentage / 100, 2);
        }
        return null;
    }

    /** Sibling sittings of the same exam, for cross-shift normalisation. */
    public function shiftSiblings()
    {
        if (!$this->shift_group) {
            return static::query()->whereRaw('1 = 0');
        }
        return static::query()->where('shift_group', $this->shift_group);
    }
}
