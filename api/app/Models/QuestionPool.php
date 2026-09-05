<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * A named slice of the question bank a student can be entitled to.
 *
 * It stores a FILTER, never a list of ids: "UGC NET Paper 1, previous-year,
 * English" keeps meaning the right thing as more of that paper is imported,
 * with nothing to re-sync and no way for the pool to drift out of date.
 */
class QuestionPool extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'title',
        'slug',
        'description',
        'exam_code',
        'paper',
        'source',
        'year',
        'shift',
        'medium',
        'exam_category',
        'is_active',
        'sort_order',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'year' => 'integer',
        ];
    }

    /** The facets this pool matches on. Nulls are dropped: blank means "any". */
    public function facets(): array
    {
        return array_filter([
            'exam_code' => $this->exam_code,
            'paper' => $this->paper,
            'source' => $this->source,
            'year' => $this->year,
            'shift' => $this->shift,
            'medium' => $this->medium,
        ], fn ($v) => $v !== null && $v !== '');
    }

    /**
     * The questions in this pool, right now.
     *
     * Usable only — an unapproved or retired question is not something to hand
     * a paying student for practice, the same bar a published test has to clear.
     */
    public function questions(): Builder
    {
        return Question::query()->usable()->matchingFacets($this->facets());
    }

    /**
     * A pool with no facets at all would silently match the ENTIRE bank, which
     * is never what someone meant to sell. Guarded at the controller too; this
     * is here so the check has one definition.
     */
    public function isUnbounded(): bool
    {
        return $this->facets() === [];
    }

    public function entitlements(): MorphMany
    {
        return $this->morphMany(Entitlement::class, 'grantable');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
