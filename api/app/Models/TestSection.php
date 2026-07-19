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
    ];

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
