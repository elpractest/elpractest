<?php

namespace App\Services;

use App\Models\Question;

/**
 * Derives a question's human-readable code from its taxonomy columns.
 *
 *     UGCNET-P1-PY-2024-S2-EN-001
 *
 * exam / paper / source / year / shift / medium / serial-within-the-paper.
 *
 * The code is a PROJECTION, never the identity. Filtering, counting and pool
 * matching all run against the indexed columns; this string exists so a human
 * can read, cite and search for one item, and so the unique index has something
 * meaningful to collide on when the same file is uploaded twice.
 *
 * Nothing ever parses it back — the columns are always there — so the format
 * can gain a segment later without breaking any reader.
 */
class QuestionCodeService
{
    /** A question with no exam is unclassified and simply has no code. */
    public function build(array $facets): ?string
    {
        $examCode = $this->clean($facets['exam_code'] ?? null);
        if ($examCode === null) {
            return null;
        }

        $sourceKey = strtolower((string) ($facets['source'] ?? Question::SOURCE_MOCK));
        $sourceCode = config("exams.sources.{$sourceKey}.code", 'MK');

        $segments = [strtoupper($examCode)];

        if ($paper = $this->clean($facets['paper'] ?? null)) {
            $segments[] = strtoupper($paper);
        }

        $segments[] = $sourceCode;

        if (!empty($facets['year'])) {
            $segments[] = (string) ((int) $facets['year']);
        }

        // S-prefixed so a shift can never be read as the year beside it.
        if (($shift = $this->clean($facets['shift'] ?? null)) !== null) {
            $segments[] = 'S' . strtoupper($shift);
        }

        $segments[] = strtoupper((string) ($facets['medium'] ?? Question::MEDIUM_DEFAULT));
        $segments[] = str_pad((string) ((int) ($facets['serial'] ?? 0)), 3, '0', STR_PAD_LEFT);

        return implode('-', $segments);
    }

    /**
     * The next free position within a paper.
     *
     * A PYQ supplies its own serial — it is the real question number printed on
     * the paper, and renumbering it would destroy the one thing that makes the
     * code citable. Everything else gets the next slot in its group.
     *
     * Imports run their rows sequentially inside one job, so there is no
     * concurrency here in practice; the unique index on question_code is the
     * backstop if that ever stops being true.
     */
    public function nextSerial(array $facets): int
    {
        $max = Question::query()
            ->where('exam_code', $this->clean($facets['exam_code'] ?? null))
            ->where('source', strtolower((string) ($facets['source'] ?? Question::SOURCE_MOCK)))
            ->where('medium', strtolower((string) ($facets['medium'] ?? Question::MEDIUM_DEFAULT)))
            ->when(
                $this->clean($facets['paper'] ?? null),
                fn ($q, $paper) => $q->where('paper', $paper),
                fn ($q) => $q->whereNull('paper'),
            )
            ->when(
                !empty($facets['year']),
                fn ($q) => $q->where('year', (int) $facets['year']),
                fn ($q) => $q->whereNull('year'),
            )
            ->when(
                $this->clean($facets['shift'] ?? null),
                fn ($q, $shift) => $q->where('shift', $shift),
                fn ($q) => $q->whereNull('shift'),
            )
            ->max('serial');

        return ((int) $max) + 1;
    }

    /**
     * Normalise and validate a facet set, resolving the serial and the code.
     *
     * Returns the columns ready to write. Throws on anything the registry does
     * not recognise, because a silently mis-filed question is worse than a
     * rejected row: it is invisible to the very filter that would have found it.
     *
     * @throws \InvalidArgumentException
     */
    public function resolve(array $facets): array
    {
        $examCode = $this->clean($facets['exam_code'] ?? null);

        if ($examCode === null) {
            // Unclassified is allowed — that is every question written before
            // this taxonomy, and any hand-authored one-off after it.
            return [
                'exam_code' => null,
                'paper' => null,
                'source' => $this->validSource($facets['source'] ?? null),
                'year' => null,
                'shift' => null,
                'medium' => $this->validMedium($facets['medium'] ?? null),
                'serial' => null,
                'question_code' => null,
            ];
        }

        $examCode = strtoupper($examCode);
        $registry = config('exams.registry', []);

        if (!isset($registry[$examCode])) {
            throw new \InvalidArgumentException("Unknown exam_code '{$examCode}'.");
        }

        $paper = $this->clean($facets['paper'] ?? null);
        if ($paper !== null) {
            $paper = strtoupper($paper);
            $this->assertFits('paper', $paper, 16);
            $allowed = $registry[$examCode]['papers'] ?? [];
            if ($allowed !== [] && !in_array($paper, $allowed, true)) {
                throw new \InvalidArgumentException(
                    "Exam '{$examCode}' has no paper '{$paper}' (expected: " . implode(', ', $allowed) . ').'
                );
            }
        }

        $year = !empty($facets['year']) ? (int) $facets['year'] : null;
        if ($year !== null && ($year < 1950 || $year > (int) date('Y') + 1)) {
            throw new \InvalidArgumentException("Implausible year '{$year}'.");
        }

        $shift = $this->clean($facets['shift'] ?? null);
        if ($shift !== null) {
            $this->assertFits('shift', $shift, 16);
        }

        $resolved = [
            'exam_code' => $examCode,
            'paper' => $paper,
            'source' => $this->validSource($facets['source'] ?? null),
            'year' => $year,
            'shift' => $shift,
            'medium' => $this->validMedium($facets['medium'] ?? null),
        ];

        $resolved['serial'] = !empty($facets['serial'])
            ? (int) $facets['serial']
            : $this->nextSerial($resolved);

        $resolved['question_code'] = $this->build($resolved);

        return $resolved;
    }

    /** Does this code already belong to a question? */
    public function isTaken(?string $code, ?int $ignoreId = null): bool
    {
        if ($code === null) {
            return false;
        }

        return Question::query()
            ->where('question_code', $code)
            ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
            ->exists();
    }

    private function validSource(?string $source): string
    {
        $source = strtolower(trim((string) $source)) ?: Question::SOURCE_MOCK;

        if (!array_key_exists($source, config('exams.sources', []))) {
            throw new \InvalidArgumentException("Unknown source '{$source}'.");
        }

        return $source;
    }

    private function validMedium(?string $medium): string
    {
        $medium = strtolower(trim((string) $medium)) ?: Question::MEDIUM_DEFAULT;

        if (!array_key_exists($medium, config('exams.mediums', []))) {
            throw new \InvalidArgumentException("Unknown medium '{$medium}'.");
        }

        return $medium;
    }

    /**
     * Column widths are enforced here rather than as `max:` validation rules,
     * because a CSV reader hands back "2" as an int and `max:16` against an int
     * means "at most sixteen", not "at most sixteen characters".
     */
    private function assertFits(string $field, string $value, int $limit): void
    {
        if (mb_strlen($value) > $limit) {
            throw new \InvalidArgumentException(
                "The {$field} '{$value}' is longer than {$limit} characters."
            );
        }
    }

    private function clean(?string $value): ?string
    {
        $value = trim((string) $value);

        return $value === '' ? null : $value;
    }
}
