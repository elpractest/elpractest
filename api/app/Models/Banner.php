<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

/**
 * Home promo banner. Managed by the super-admin panel; surfaced to students
 * (and the marketing site / mobile apps) through the public read endpoint.
 */
class Banner extends Model
{
    protected $fillable = [
        'title',
        'subtitle',
        'kicker',
        'cta_label',
        'cta_url',
        'image_path',
        'exam_category',
        'is_active',
        'sort_order',
        'starts_at',
        'ends_at',
    ];

    protected $appends = ['image_url'];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
        ];
    }

    public function getImageUrlAttribute(): ?string
    {
        return $this->image_path ? Storage::disk('public')->url($this->image_path) : null;
    }

    /**
     * Active = flagged active AND inside its optional scheduling window.
     */
    public function scopeActive($query)
    {
        $now = now();
        return $query->where('is_active', true)
            ->where(fn ($q) => $q->whereNull('starts_at')->orWhere('starts_at', '<=', $now))
            ->where(fn ($q) => $q->whereNull('ends_at')->orWhere('ends_at', '>=', $now));
    }

    public function scopeOrdered($query)
    {
        return $query->orderBy('sort_order')->orderBy('id');
    }
}
