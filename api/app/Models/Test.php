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
}
