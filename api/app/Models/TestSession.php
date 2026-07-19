<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Facades\DB;

class TestSession extends Model
{
    protected $fillable = [
        'user_id',
        'test_id',
        'started_at',
        'duration_seconds',
        'submitted_at',
        'is_auto_submitted',
        'current_section_index',
        'section_started_at',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'submitted_at' => 'datetime',
            'is_auto_submitted' => 'boolean',
            'current_section_index' => 'integer',
            'section_started_at' => 'datetime',
        ];
    }

    // ── Relationships ──────────────────────────────────────────────

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function test(): BelongsTo
    {
        return $this->belongsTo(Test::class);
    }

    public function answers(): HasMany
    {
        return $this->hasMany(TestAnswer::class);
    }

    public function analytic(): HasOne
    {
        return $this->hasOne(TestAnalytic::class);
    }

    // ── Helpers ────────────────────────────────────────────────────

    /**
     * Reconcile section and global timing. Auto-advances expired sections.
     * This handles cases where client disconnects or fails to call advanceSection.
     */
    public function reconcileSectionTiming(): void
    {
        if ($this->submitted_at !== null) {
            return;
        }

        // 1. Check global timer first
        if ($this->duration_seconds !== null && $this->duration_seconds > 0) {
            $globalExpiry = $this->started_at->copy()->addSeconds($this->duration_seconds);
            if (now()->greaterThanOrEqualTo($globalExpiry)) {
                $this->update([
                    'submitted_at' => $globalExpiry,
                    'is_auto_submitted' => true,
                ]);
                return;
            }
        }

        // 2. Check sectional timers
        $sections = $this->test->sections;
        if ($sections->isEmpty()) {
            return;
        }

        $hasSectionalTiming = $sections->contains(fn($s) => $s->hasSectionalTiming());
        if (!$hasSectionalTiming) {
            return;
        }

        $currentSection = $sections->get($this->current_section_index);
        if (!$currentSection || !$currentSection->hasSectionalTiming()) {
            return;
        }

        $sectionStart = $this->section_started_at ?? $this->started_at;
        $sectionDuration = $currentSection->duration_seconds;
        $sectionExpiry = $sectionStart->copy()->addSeconds($sectionDuration);

        while (now()->greaterThanOrEqualTo($sectionExpiry)) {
            // Current section has expired. Can we advance to next?
            if ($this->current_section_index < $sections->count() - 1) {
                $this->current_section_index++;
                $this->section_started_at = $sectionExpiry;
                $currentSection = $sections->get($this->current_section_index);
                
                if ($currentSection && $currentSection->hasSectionalTiming()) {
                    $sectionDuration = $currentSection->duration_seconds;
                    $sectionExpiry = $this->section_started_at->copy()->addSeconds($sectionDuration);
                } else {
                    break;
                }
            } else {
                // Last section expired. Submit the test.
                $this->submitted_at = $sectionExpiry;
                $this->is_auto_submitted = true;
                break;
            }
        }

        if ($this->isDirty()) {
            $this->save();
        }
    }

    /**
     * Server-authoritative time remaining in seconds.
     * Returns 0 if time has expired or session is submitted.
     */
    public function timeRemainingSeconds(): ?int
    {
        if ($this->submitted_at !== null) {
            return 0;
        }

        if ($this->duration_seconds === null || $this->duration_seconds <= 0) {
            return null; // practice / untimed test
        }

        $elapsed = now()->diffInSeconds($this->started_at);
        $remaining = $this->duration_seconds - $elapsed;

        return max(0, (int) $remaining);
    }

    /**
     * Server-authoritative section time remaining.
     */
    public function sectionTimeRemainingSeconds(): ?int
    {
        if ($this->submitted_at !== null) {
            return 0;
        }

        $sections = $this->test->sections;
        if ($sections->isEmpty()) {
            return null;
        }

        $currentSection = $sections->get($this->current_section_index);
        if (!$currentSection || !$currentSection->hasSectionalTiming()) {
            return null; // section not timed
        }

        $sectionStart = $this->section_started_at ?? $this->started_at;
        $elapsed = now()->diffInSeconds($sectionStart);
        $remaining = $currentSection->duration_seconds - $elapsed;

        return max(0, (int) $remaining);
    }

    /**
     * Check if the session has expired (server time).
     */
    public function hasExpired(): bool
    {
        if ($this->submitted_at !== null) {
            return true;
        }

        $remaining = $this->timeRemainingSeconds();
        if ($remaining !== null && $remaining <= 0) {
            return true;
        }

        return false;
    }

    /**
     * Check if this session is currently in progress.
     */
    public function isInProgress(): bool
    {
        if ($this->submitted_at !== null) {
            return false;
        }

        // Reconcile timing first to ensure state is accurate
        $this->reconcileSectionTiming();

        return $this->submitted_at === null;
    }

    /**
     * Check if the session is expired for writes.
     */
    public function isExpiredForWrite(): bool
    {
        $this->reconcileSectionTiming();
        return $this->submitted_at !== null;
    }

    /**
     * Get the batch-scoped rank and percentile for this session.
     */
    public function getRankAndPercentile(): array
    {
        $analytic = $this->analytic;
        if (!$analytic) {
            return [
                'rank' => 1,
                'percentile' => 100.00,
            ];
        }

        $test = $this->test;

        // Fetch user enrollment to identify batch
        $enrollment = Enrollment::where('user_id', $this->user_id)
            ->where('course_id', $test->course_id)
            ->active()
            ->first();

        $batchId = $enrollment?->batch_id ?? $test->batch_id;

        // Unified batch-scoped percentile/rank query (SQLite & MySQL 8 compatible)
        $scoresQuery = DB::table('test_analytics as ta')
            ->join('test_sessions as ts', 'ta.test_session_id', '=', 'ts.id')
            ->join('enrollments as e', function ($join) use ($test) {
                $join->on('ts.user_id', '=', 'e.user_id')
                     ->where('e.course_id', '=', $test->course_id)
                     ->where('e.is_active', '=', 1);
            })
            ->where('ts.test_id', $test->id)
            ->whereNotNull('ts.submitted_at')
            ->select(
                'ts.id as session_id',
                'ta.total_score',
                'e.batch_id',
                DB::raw('RANK() OVER (PARTITION BY e.batch_id ORDER BY ta.total_score DESC) as cohort_rank'),
                DB::raw('(1 - PERCENT_RANK() OVER (PARTITION BY e.batch_id ORDER BY ta.total_score DESC)) * 100 as cohort_percentile')
            );

        $ranking = DB::table(DB::raw("({$scoresQuery->toSql()}) as ranked"))
            ->mergeBindings($scoresQuery)
            ->where('session_id', $this->id)
            ->first();

        // Safe fallback in case of no cohort data
        $rank = $ranking ? (int)$ranking->cohort_rank : 1;
        $percentile = $ranking ? (float)$ranking->cohort_percentile : 100.00;

        return [
            'rank' => $rank,
            'percentile' => $percentile,
        ];
    }
}
