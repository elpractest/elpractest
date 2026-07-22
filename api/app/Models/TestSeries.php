<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class TestSeries extends Model
{
    use HasFactory, SoftDeletes;

    protected $table = 'test_series';

    protected $fillable = [
        'title',
        'slug',
        'description',
        'exam_category',
        'course_id',
        'is_published',
        'sort_order',
        'created_by',
    ];

    protected $casts = [
        'is_published' => 'boolean',
        'sort_order' => 'integer',
    ];

    protected $appends = [
        'total_tests',
        'free_tests_count',
    ];

    public function tests(): HasMany
    {
        return $this->hasMany(Test::class, 'test_series_id')->orderBy('series_sort_order');
    }

    public function course(): BelongsTo
    {
        return $this->belongsTo(Course::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function assignments(): MorphMany
    {
        return $this->morphMany(Assignment::class, 'assignable');
    }

    public function getTotalTestsAttribute(): int
    {
        return $this->tests()->count();
    }

    public function getFreeTestsCountAttribute(): int
    {
        return $this->tests()->where('is_free', true)->count();
    }
}
