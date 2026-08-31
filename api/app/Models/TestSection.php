<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TestSection extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'test_id',
        'title',
        'sort_order',
        'duration_seconds',
        'cutoff_marks',
        'cutoff_percentage',
        'is_qualifying',
    ];

    protected function casts(): array
    {
        return [
            'cutoff_marks' => 'decimal:2',
            'cutoff_percentage' => 'decimal:2',
            'is_qualifying' => 'boolean',
        ];
    }

    /**
     * Sectional bar in absolute marks given the section maximum, or null when
     * the section has no bar. Absolute marks win over the percentage.
     */
    public function cutoffMarksFor(float $sectionMaxMarks): ?float
    {
        if ($this->cutoff_marks !== null) {
            return (float) $this->cutoff_marks;
        }
        if ($this->cutoff_percentage !== null) {
            return round($sectionMaxMarks * (float) $this->cutoff_percentage / 100, 2);
        }
        return null;
    }

    public function hasSectionalTiming(): bool
    {
        return $this->duration_seconds !== null && $this->duration_seconds > 0;
    }

    public function test(): BelongsTo
    {
        return $this->belongsTo(Test::class);
    }

    public function sectionQuestions(): HasMany
    {
        return $this->hasMany(TestSectionQuestion::class)->orderBy('sort_order');
    }

    /**
     * Get all questions for this section via the pivot model.
     */
    public function questions()
    {
        return $this->belongsToMany(Question::class, 'test_section_questions')
            ->withPivot('sort_order')
            ->orderByPivot('sort_order');
    }
}
