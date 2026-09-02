<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TestAnalytic extends Model
{
    protected $fillable = [
        'test_session_id',
        'total_score',
        'max_score',
        'correct_count',
        'incorrect_count',
        'unanswered_count',
        'accuracy_percentage',
        'total_time_seconds',
        'subject_breakdown',
        'topic_breakdown',
        'merit_score',
        'normalized_score',
        'is_qualified',
        'section_breakdown',
    ];

    protected function casts(): array
    {
        return [
            'total_score' => 'decimal:2',
            'max_score' => 'decimal:2',
            'accuracy_percentage' => 'decimal:2',
            'subject_breakdown' => 'array',
            'topic_breakdown' => 'array',
            'section_breakdown' => 'array',
            'merit_score' => 'decimal:2',
            'normalized_score' => 'decimal:2',
            'is_qualified' => 'boolean',
        ];
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(TestSession::class, 'test_session_id');
    }
}
