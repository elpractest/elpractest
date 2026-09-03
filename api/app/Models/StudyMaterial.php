<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StudyMaterial extends Model
{
    protected $fillable = [
        'course_id',
        'module_id',
        'title',
        'description',
        'subject',
        'file_path',
        'original_filename',
        'file_size',
        'page_count',
        'sort_order',
        'is_free_preview',
        'is_published',
    ];

    /**
     * `file_path` is the one field that must never reach the browser: it is the
     * key into the private disk, and a student who knows it learns nothing they
     * can use but everything an attacker would want to guess with. The file is
     * only ever reachable through the gated stream endpoint.
     */
    protected $hidden = ['file_path'];

    protected function casts(): array
    {
        return [
            'is_free_preview' => 'boolean',
            'is_published' => 'boolean',
            'file_size' => 'integer',
            'page_count' => 'integer',
        ];
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    public function module(): BelongsTo
    {
        return $this->belongsTo(CourseModule::class, 'module_id');
    }

    public function readingProgress(): HasMany
    {
        return $this->hasMany(ReadingProgress::class);
    }

    public function annotations(): HasMany
    {
        return $this->hasMany(MaterialAnnotation::class);
    }

    public function scopePublished($query)
    {
        return $query->where('is_published', true);
    }
}
