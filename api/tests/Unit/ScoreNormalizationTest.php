<?php

namespace Tests\Unit;

use App\Services\ScoreNormalizationService as N;
use PHPUnit\Framework\TestCase;

/**
 * Cross-shift normalisation maths. Pure functions, no database, so these assert
 * the statistics themselves rather than the plumbing around them.
 */
class ScoreNormalizationTest extends TestCase
{
    // ── percentile rank ─────────────────────────────────────────────────────

    public function test_percentile_rank_uses_mid_rank_for_ties(): void
    {
        // 10 sits below, and itself is the only one equal: (1 + 0.5) / 3 * 100
        $this->assertEqualsWithDelta(50.0, N::percentileRank([10, 20, 30], 20), 0.001);

        // Tied candidates land on the SAME percentile - they must not be split
        // by a difference the exam never measured.
        $this->assertEqualsWithDelta(50.0, N::percentileRank([10, 20, 20, 30], 20), 0.001);
    }

    public function test_percentile_rank_at_the_extremes(): void
    {
        $this->assertEqualsWithDelta(10.0, N::percentileRank([1, 2, 3, 4, 5], 1), 0.001);
        $this->assertEqualsWithDelta(90.0, N::percentileRank([1, 2, 3, 4, 5], 5), 0.001);
        $this->assertSame(0.0, N::percentileRank([], 5));
    }

    // ── quantile ────────────────────────────────────────────────────────────

    public function test_quantile_interpolates_between_order_statistics(): void
    {
        $pop = [0, 10, 20, 30, 40];
        $this->assertEqualsWithDelta(0.0, N::quantile($pop, 0), 0.001);
        $this->assertEqualsWithDelta(20.0, N::quantile($pop, 50), 0.001);
        $this->assertEqualsWithDelta(40.0, N::quantile($pop, 100), 0.001);
        // 25th percentile falls between 10 and 20
        $this->assertEqualsWithDelta(10.0, N::quantile($pop, 25), 0.001);
        $this->assertEqualsWithDelta(15.0, N::quantile($pop, 37.5), 0.001);
    }

    public function test_quantile_handles_degenerate_populations(): void
    {
        $this->assertSame(0.0, N::quantile([], 50));
        $this->assertSame(7.0, N::quantile([7], 99));
    }

    // ── equipercentile ──────────────────────────────────────────────────────

    /**
     * The control case. When every shift has the same distribution, normalising
     * must be a near no-op - otherwise the method is inventing an adjustment
     * where there is no difficulty difference to correct.
     */
    public function test_identical_shifts_leave_scores_effectively_unchanged(): void
    {
        $shift = [10, 20, 30, 40, 50];
        $pooled = array_merge($shift, $shift);

        foreach ($shift as $raw) {
            $this->assertEqualsWithDelta($raw, N::equipercentile($shift, $pooled, $raw), 1.0);
        }
    }

    /**
     * The case normalisation exists for: a candidate who topped a HARD shift
     * must be pulled UP toward what the same standing was worth in the easy one.
     */
    public function test_a_hard_shift_is_compensated_upward(): void
    {
        $hard = [10, 20, 30, 40, 50];
        $easy = [50, 60, 70, 80, 90];
        $pooled = array_merge($hard, $easy);

        $topOfHard = N::equipercentile($hard, $pooled, 50);
        $this->assertGreaterThan(50, $topOfHard, 'topping the hard shift must be worth more than its raw 50');

        $topOfEasy = N::equipercentile($easy, $pooled, 90);
        $this->assertLessThan(90, $topOfEasy, 'and topping the easy shift must not be worth its full raw 90');
    }

    public function test_equipercentile_is_monotonic_within_a_shift(): void
    {
        $shift = [12, 25, 25, 41, 58, 66];
        $pooled = array_merge($shift, [30, 44, 51, 70, 88]);

        $previous = -INF;
        foreach ([12, 25, 41, 58, 66] as $raw) {
            $n = N::equipercentile($shift, $pooled, $raw);
            $this->assertGreaterThanOrEqual($previous, $n, 'a higher raw score can never normalise lower');
            $previous = $n;
        }
    }

    // ── z-score ─────────────────────────────────────────────────────────────

    public function test_zscore_maps_a_shift_onto_the_pooled_mean_and_spread(): void
    {
        $hard = [10, 20, 30, 40, 50];   // mean 30
        $easy = [50, 60, 70, 80, 90];   // mean 70
        $pooled = array_merge($hard, $easy);

        // The mean of the hard shift maps to the pooled mean.
        $this->assertEqualsWithDelta(N::mean($pooled), N::zscore($hard, $pooled, 30), 0.01);
        // A candidate one SD above their shift lands one pooled SD above it.
        $oneSdUp = 30 + N::stdDev($hard);
        $this->assertEqualsWithDelta(
            N::mean($pooled) + N::stdDev($pooled),
            N::zscore($hard, $pooled, $oneSdUp),
            0.01
        );
    }

    /**
     * A shift where everyone scored identically carries no information about
     * spread. Dividing by that zero SD would be an infinity, so the only
     * defensible answer is the pooled mean.
     */
    public function test_zscore_survives_a_zero_variance_shift(): void
    {
        $flat = [40, 40, 40];
        $pooled = [10, 20, 30, 40, 50];

        $this->assertEqualsWithDelta(N::mean($pooled), N::zscore($flat, $pooled, 40), 0.01);
        $this->assertIsFloat(N::zscore($flat, $pooled, 40));
    }

    public function test_empty_populations_return_the_raw_score_untouched(): void
    {
        $this->assertSame(42.0, N::equipercentile([], [], 42.0));
        $this->assertSame(42.0, N::zscore([], [], 42.0));
    }

    // ── descriptive helpers ─────────────────────────────────────────────────

    public function test_mean_and_standard_deviation(): void
    {
        $this->assertSame(0.0, N::mean([]));
        $this->assertEqualsWithDelta(3.0, N::mean([1, 2, 3, 4, 5]), 0.001);
        $this->assertSame(0.0, N::stdDev([7]), 'a single value has no spread');
        $this->assertEqualsWithDelta(sqrt(2), N::stdDev([1, 2, 3, 4, 5]), 0.001);
    }
}
