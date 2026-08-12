<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * A single embedded chunk of course content that Vajini can retrieve. See the
 * create_vajini_chunks migration for why the vector lives in a JSON column and
 * retrieval is done in PHP rather than in a vector database.
 */
class VajiniChunk extends Model
{
    protected $fillable = [
        'source_type',
        'source_id',
        'title',
        'content',
        'content_hash',
        'embedding',
    ];

    protected function casts(): array
    {
        return [
            'embedding' => 'array',
        ];
    }
}
