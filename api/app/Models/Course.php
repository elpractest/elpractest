<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class Course extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'title',
        'slug',
        'description',
        'short_description',
        'exam_category',
        'mode',
        'syllabus',
        'faq',
        'is_published',
        'sort_order',
        'thumbnail_path',
        'banner_image_path',
    ];

    protected $appends = [
        'thumbnail_url',
        'banner_url',
    ];

    public function getThumbnailUrlAttribute(): ?string
    {
        return $this->thumbnail_path ? \Illuminate\Support\Facades\Storage::disk('public')->url($this->thumbnail_path) : null;
    }

    public function getBannerUrlAttribute(): ?string
    {
        return $this->banner_image_path ? \Illuminate\Support\Facades\Storage::disk('public')->url($this->banner_image_path) : null;
    }

    protected function casts(): array
    {
        return [
            'syllabus' => 'array',
            'faq' => 'array',
            'is_published' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Course $course) {
            if (empty($course->slug)) {
                $course->slug = Str::slug($course->title);
            }
        });
    }

    // ── Relationships ──────────────────────────────────────────────

    public function modules(): HasMany
    {
        return $this->hasMany(CourseModule::class)->orderBy('sort_order');
    }

    public function batches(): HasMany
    {
        return $this->hasMany(Batch::class);
    }

    public function enrollments(): HasMany
    {
        return $this->hasMany(Enrollment::class);
    }

    public function activationCodes(): HasMany
    {
        return $this->hasMany(ActivationCode::class);
    }

    public function tests(): HasMany
    {
        return $this->hasMany(Test::class);
    }

    public function lessons(): \Illuminate\Database\Eloquent\Relations\HasManyThrough
    {
        return $this->hasManyThrough(Lesson::class, CourseModule::class, 'course_id', 'module_id');
    }

    // ── Scopes ─────────────────────────────────────────────────────

    public function scopePublished($query)
    {
        return $query->where('is_published', true);
    }

    public function scopeByExamCategory($query, string $category)
    {
        return $query->where('exam_category', $category);
    }
}
