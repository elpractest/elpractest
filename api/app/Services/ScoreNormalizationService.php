<?php

namespace App\Services;

use App\Models\Test;
use App\Models\TestAnalytic;
use Illuminate\Support\Facades\DB;

/**
 * Cross-shift score normalisation.
 *
 * When one exam runs as several sittings ("shifts") on different papers, raw
 * marks are not comparable: a candidate who sat a harder shift is penalised by
 * the paper, not by ability. SSC, RRB and several state bodies therefore publish
 * NORMALISED marks. Tests that share a `shift_group` are treated as one exam;
 * `shift_label` identifies the sitting.
 *
 * Two methods, both standard psychometric practice, selected per test via
 * `tests.normalization_method`:
 *
 *   equipercentile (default, recommended)
 *     Map a candidate to their percentile WITHIN their own shift, then read off
 *     the score at that same percentile in the POOLED distribution of all shifts.
 *     Distribution-free: it does not assume the marks are normally shaped, which
 *     they rarely are once negative marking bunches the lower tail.
 *
 *   zscore (linear)
 *     normalised = pooled_mean + (raw - shift_mean) / shift_sd * pooled_sd
 *     Cheaper and easier to explain, but it only corrects the mean and spread,
 *     so it distorts a skewed distribution.
 *
 * NOTE ON EXAM-BODY FORMULAE: individual bodies publish their own algebra (and
 * revise it). Both methods here are the general forms those formulae specialise;
 * if you must reproduce one exactly, add it as a third `normalization_method`
 * rather than bending these.
 *
 * Every public computation method is pure and static so it can be unit-tested
 * against known distributions with no database.
 */
class ScoreNormalizationService
{
    public const METHOD_NONE = 'none';
    public const METHOD_EQUIPERCENTILE = 'equipercentile';
    public const METHOD_ZSCORE = 'zscore';

    /**
     * Percentile rank of $value within $population, 0..100.
     *
     * Uses the mid-rank convention: everything strictly below counts fully, ties
     * count half. That is what keeps tied candidates on the SAME normalised mark
     * instead of arbitrarily splitting them, which would create a ranking
     * difference the exam never measured.
     *
     * @param  float[]  $population  need not be sorted
     */
    public static function percentileRank(array $population, float $value): float
    {
        $n = count($population);
        if ($n === 0) {
            return 0.0;
        }

        $below = 0;
        $equal = 0;
        foreach ($population as $p) {
            // Cast before comparing. The population arrives from the database as
            // decimal strings or ints while $value is a float, and PHP's `===`
            // is false across types - which would silently count every tie as
            // "not equal" and split tied candidates apart.
            $p = (float) $p;
            if ($p < $value) {
                $below++;
            } elseif ($p === $value) {
                $equal++;
            }
        }

        return (($below + 0.5 * $equal) / $n) * 100;
    }

    /**
     * Score standing at percentile $p (0..100) of $population, with linear
     * interpolation between neighbouring order statistics.
     *
     * @param  float[]  $population  need not be sorted
     */
    public static function quantile(array $population, float $p): float
    {
        $n = count($population);
        if ($n === 0) {
            return 0.0;
        }
        if ($n === 1) {
            return (float) $population[0];
        }

        $sorted = $population;
        sort($sorted, SORT_NUMERIC);

        $p = max(0.0, min(100.0, $p));
        $pos = ($p / 100) * ($n - 1);
        $lo = (int) floor($pos);
        $hi = (int) ceil($pos);

        if ($lo === $hi) {
            return (float) $sorted[$lo];
        }

        $frac = $pos - $lo;
        return (float) $sorted[$lo] + $frac * ((float) $sorted[$hi] - (float) $sorted[$lo]);
    }

    /** Arithmetic mean; 0.0 for an empty set. */
    public static function mean(array $xs): float
    {
        $n = count($xs);
        return $n === 0 ? 0.0 : array_sum($xs) / $n;
    }

    /** Population standard deviation; 0.0 for fewer than two values. */
    public static function stdDev(array $xs): float
    {
        $n = count($xs);
        if ($n < 2) {
            return 0.0;
        }
        $m = self::mean($xs);
        $sum = 0.0;
        foreach ($xs as $x) {
            $sum += ($x - $m) ** 2;
        }
        return sqrt($sum / $n);
    }

    /**
     * Equipercentile-normalise one raw score.
     *
     * @param  float[]  $shiftScores   every raw score in the candidate own shift
     * @param  float[]  $pooledScores  every raw score across all shifts
     */
    public static function equipercentile(array $shiftScores, array $pooledScores, float $raw): float
    {
        if ($shiftScores === [] || $pooledScores === []) {
            return $raw;
        }
        $p = self::percentileRank($shiftScores, $raw);
        return round(self::quantile($pooledScores, $p), 2);
    }

    /**
     * Linear (z-score) normalisation of one raw score.
     *
     * @param  float[]  $shiftScores
     * @param  float[]  $pooledScores
     */
    public static function zscore(array $shiftScores, array $pooledScores, float $raw): float
    {
        if ($shiftScores === [] || $pooledScores === []) {
            return $raw;
        }

        $shiftSd = self::stdDev($shiftScores);
        $pooledMean = self::mean($pooledScores);

        // A shift where everyone scored the same carries no information about
        // spread, so the only defensible mapping is the pooled mean.
        if ($shiftSd == 0.0) {
            return round($pooledMean, 2);
        }

        $z = ($raw - self::mean($shiftScores)) / $shiftSd;
        return round($pooledMean + $z * self::stdDev($pooledScores), 2);
    }

    /**
     * Normalise every submitted session across one shift group and persist the
     * result to `test_analytics.normalized_score`.
     *
     * Raw marks are never overwritten: normalisation is an additional column, so
     * it can be recomputed or discarded without losing the underlying score.
     *
     * @return array{tests: int, sessions: int, method: string}
     */
    public function normalizeShiftGroup(string $shiftGroup): array
    {
        $tests = Test::where('shift_group', $shiftGroup)->get();
        if ($tests->isEmpty()) {
            return ['tests' => 0, 'sessions' => 0, 'method' => self::METHOD_NONE];
        }

        // The method is a property of the exam, so the group agrees on one. The
        // first non-'none' value wins; a group with none set is a no-op.
        $method = self::METHOD_NONE;
        foreach ($tests as $t) {
            if ($t->normalization_method && $t->normalization_method !== self::METHOD_NONE) {
                $method = $t->normalization_method;
                break;
            }
        }
        if ($method === self::METHOD_NONE) {
            return ['tests' => $tests->count(), 'sessions' => 0, 'method' => self::METHOD_NONE];
        }

        // Merit score is the normalisation input when the paper has qualifying
        // sections, because those marks are excluded from the merit list anyway.
        $rows = DB::table('test_analytics as ta')
            ->join('test_sessions as ts', 'ta.test_session_id', '=', 'ts.id')
            ->whereIn('ts.test_id', $tests->pluck('id'))
            ->whereNotNull('ts.submitted_at')
            ->select('ta.id as analytic_id', 'ts.test_id', 'ta.total_score', 'ta.merit_score')
            ->get();

        if ($rows->isEmpty()) {
            return ['tests' => $tests->count(), 'sessions' => 0, 'method' => $method];
        }

        $scoreOf = fn ($r) => (float) ($r->merit_score ?? $r->total_score);

        $pooled = $rows->map($scoreOf)->all();
        $byTest = $rows->groupBy('test_id')->map(fn ($g) => $g->map($scoreOf)->all());

        $updated = 0;
        foreach ($rows as $r) {
            $raw = $scoreOf($r);
            $shift = $byTest[$r->test_id];

            $normalized = $method === self::METHOD_ZSCORE
                ? self::zscore($shift, $pooled, $raw)
                : self::equipercentile($shift, $pooled, $raw);

            TestAnalytic::where('id', $r->analytic_id)->update(['normalized_score' => $normalized]);
            $updated++;
        }

        return ['tests' => $tests->count(), 'sessions' => $updated, 'method' => $method];
    }
}
