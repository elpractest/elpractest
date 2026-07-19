<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TestSectionQuestion extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'test_section_id',
        'question_id',
        'sort_order',
    ];

    public function section(): BelongsTo
    {
        return $this->belongsTo(TestSection::class, 'test_section_id');
    }

    public function question(): BelongsTo
    {
        return $this->belongsTo(Question::class);
    }
}
