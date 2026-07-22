<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Batch extends Model
{
    protected $fillable = [
        'course_id',
        'name',
        'starts_at',
        'ends_at',
        'max_students',
        'is_active',
        'price_paise',
    ];

    protected function casts(): array
    {
        return [
            'starts_at' => 'date',
            'ends_at' => 'date',
            'is_active' => 'boolean',
        ];
    }

    public function getPriceInRupeesAttribute(): ?float
    {
        return $this->price_paise === null ? null : $this->price_paise / 100;
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    public function enrollments(): HasMany
    {
        return $this->hasMany(Enrollment::class);
    }

    public function activationRequests(): HasMany
    {
        return $this->hasMany(ActivationRequest::class);
    }

    public function activationCodes(): HasMany
    {
        return $this->hasMany(ActivationCode::class);
    }

    public function tests(): HasMany
    {
        return $this->hasMany(Test::class);
    }

    public function assignments(): HasMany
    {
        return $this->hasMany(Assignment::class);
    }

    // ── Scopes ─────────────────────────────────────────────────────

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Check if the batch has capacity for more students.
     */
    public function hasCapacity(): bool
    {
        if ($this->max_students === null) {
            return true;
        }

        return $this->enrollments()->where('is_active', true)->count() < $this->max_students;
    }
}
