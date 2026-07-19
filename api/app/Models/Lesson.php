<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Lesson extends Model
{
    protected $fillable = [
        'module_id',
        'title',
        'video_provider',
        'video_id',
        'duration_seconds',
        'sort_order',
        'is_free_preview',
    ];

    protected function casts(): array
    {
        return [
            'is_free_preview' => 'boolean',
        ];
    }

    public function module(): BelongsTo
    {
        return $this->belongsTo(CourseModule::class, 'module_id');
    }

    public function progress(): HasMany
    {
        return $this->hasMany(LessonProgress::class);
    }

    public function scopeFreePreview($query)
    {
        return $query->where('is_free_preview', true);
    }
}
