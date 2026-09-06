<?php

namespace App\Services;

use App\Models\Passage;
use App\Models\Question;
use App\Models\Test;
use App\Models\TestSection;
use App\Models\TestSectionQuestion;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Door B: one upload becomes one finished paper AND N classified questions.
 *
 * The bank importer (Door A) exists to accumulate an asset. This exists to
 * publish an exam-faithful paper fast. Before it, a test was assembled by
 * clicking questions one at a time out of a searchable list — a hundred
 * selections for a hundred-question mock, with no CSV path to a test at all.
 *
 * Both doors write to the same `questions` table on purpose. A separate store
 * for series questions would have been quicker to build and would have cost
 * three things: item analytics (difficulty/discrimination are computed from
 * real sessions and matter most on the most-answered questions), the practice
 * pool's entitlement anchor, and a second importer to maintain forever. See
 * docs/QUESTION-BANK-REDESIGN.md.
 *
 * Everything here runs twice: once as a dry run that writes nothing and returns
 * a report, then — if the operator accepts it — once for real inside a single
 * transaction. That is not belt-and-braces. This is the one importer that
 * writes to two subsystems at once, so a bad file without a dry run is a bad
 * file in two places.
 */
class PaperImportService
{
    public function __construct(
        private readonly QuestionCodeService $codes,
        private readonly QuestionRowBuilder $rows,
    ) {}

    /**
     * Validate a paper without writing anything.
     *
     * @param  array<int, array<string, mixed>>  $rows
     * @return array{ok:bool, errors:array, summary:array, sections:array, duplicates:array, warnings:array}
     */
    public function dryRun(array $meta, array $rows): array
    {
        $errors = [];
        $warnings = [];
        $duplicates = [];
        $perSection = [];
        $namedSections = [];
        $seenCodes = [];
        $totalMarks = 0.0;

        $sectionTitles = array_map(fn ($s) => (string) $s['title'], $meta['sections'] ?? []);
        $passageRefs = array_map(fn ($p) => (string) $p['ref'], $meta['passages'] ?? []);

        if ($rows === []) {
            $errors[] = ['row' => 0, 'field' => 'file', 'message' => 'The paper has no question rows.'];
        }

        // Check the PAPER's own facets once, before touching a single row.
        //
        // These live in the meta block, so a typo there is one mistake, not one
        // per row — and reporting it per row buries every genuinely row-specific
        // problem under a hundred identical lines. Returning early also stops
        // the report claiming a section "has no rows" when its rows merely
        // failed this same check.
        try {
            $this->codes->resolve([
                'exam_code' => $meta['exam_code'] ?? null,
                'paper' => $meta['paper'] ?? null,
                'source' => $meta['source'] ?? null,
                'year' => $meta['year'] ?? null,
                'shift' => $meta['shift'] ?? null,
                'medium' => $meta['medium'] ?? null,
                'serial' => 1,
            ]);
        } catch (\InvalidArgumentException $e) {
            return [
                'ok' => false,
                'errors' => [['row' => 0, 'field' => 'meta', 'message' => $e->getMessage()]],
                'duplicates' => [],
                'warnings' => [],
                'summary' => [
                    'title' => $meta['title'] ?? null,
                    'questions' => 0,
                    'total_marks' => 0,
                    'sections' => count($sectionTitles),
                    'duration_minutes' => $meta['duration_minutes'] ?? null,
                ],
                'sections' => [],
            ];
        }

        foreach ($rows as $index => $row) {
            // +2: one for the header, one because humans count from 1.
            $rowNumber = $index + 2;
            $section = trim((string) ($row['section'] ?? ''));

            if ($section === '') {
                $errors[] = ['row' => $rowNumber, 'field' => 'section', 'message' => 'Every row must name a section.'];
                continue;
            }

            if (!in_array($section, $sectionTitles, true)) {
                $errors[] = [
                    'row' => $rowNumber,
                    'field' => 'section',
                    'message' => "Section '{$section}' is not declared in the meta file.",
                ];
                continue;
            }

            // Counted before the row's own checks, so "this section has no
            // rows" stays a statement about the FILE rather than a side effect
            // of those rows failing something unrelated.
            $namedSections[$section] = true;

            // Serial defaults to the row's position in the file, which is what
            // makes "one upload of a real paper" work without renumbering by
            // hand: row order IS question order on the paper.
            //
            // Deliberately checked BEFORE the row's content checks. A serial
            // collision is a fact about two rows' positions, independent of
            // whether either row's options are valid — so a row that is going
            // to fail for some other reason must still register its serial, or
            // the operator fixes the options, re-runs, and only then discovers
            // the duplicate. The dry run exists to say everything in one pass.
            try {
                $taxonomy = $this->codes->resolve($this->facetsFor($meta, $row, $index));
            } catch (\InvalidArgumentException $e) {
                $errors[] = ['row' => $rowNumber, 'field' => 'taxonomy', 'message' => $e->getMessage()];
                continue;
            }

            $code = $taxonomy['question_code'];

            if ($code !== null) {
                if (isset($seenCodes[$code])) {
                    $errors[] = [
                        'row' => $rowNumber,
                        'field' => 'serial',
                        'message' => "Row {$seenCodes[$code]} already uses {$code} in this same file.",
                    ];
                    continue;
                }
                $seenCodes[$code] = $rowNumber;

                if ($this->codes->isTaken($code)) {
                    $duplicates[] = ['row' => $rowNumber, 'question_code' => $code];
                }
            }

            if (trim((string) ($row['question_text'] ?? '')) === '') {
                $errors[] = ['row' => $rowNumber, 'field' => 'question_text', 'message' => 'Question text is required.'];
                continue;
            }

            $type = strtolower(trim((string) ($row['question_type'] ?? ''))) ?: Question::TYPE_SINGLE_CHOICE;
            if (!in_array($type, Question::QUESTION_TYPES, true)) {
                $errors[] = ['row' => $rowNumber, 'field' => 'question_type', 'message' => "Unknown question_type '{$type}'."];
                continue;
            }

            // Same answer-key rules the bank importer enforces.
            try {
                $this->rows->assertRowScoreable($row, $type);
            } catch (\RuntimeException $e) {
                $errors[] = ['row' => $rowNumber, 'field' => 'correct_option', 'message' => $e->getMessage()];
                continue;
            }

            $ref = trim((string) ($row['passage_ref'] ?? ''));
            if ($ref !== '' && !in_array($ref, $passageRefs, true)) {
                $errors[] = [
                    'row' => $rowNumber,
                    'field' => 'passage_ref',
                    'message' => "Passage '{$ref}' is not declared in the meta file.",
                ];
                continue;
            }

            $marks = $this->marksFor($meta, $row, $section);
            $totalMarks += $marks['marks'];

            $perSection[$section] = ($perSection[$section] ?? 0) + 1;
        }

        if ($duplicates !== []) {
            $errors[] = [
                'row' => 0,
                'field' => 'duplicates',
                'message' => count($duplicates) . ' question(s) are already in the bank. '
                    . 'Re-importing a paper that already exists would double it — change the shift, '
                    . 'year or medium if this is genuinely a different sitting.',
            ];
        }

        foreach ($sectionTitles as $title) {
            if (!isset($namedSections[$title])) {
                $warnings[] = "Section '{$title}' is declared in the meta file but has no rows.";
            }
        }

        // Publishing is gated on review (TestController::publish), so say so
        // here rather than letting it be discovered at publish time.
        if (!($meta['auto_approve'] ?? false)) {
            $warnings[] = 'Questions will land in the review queue, so the paper imports as a draft '
                . 'and cannot be published until they are approved.';
        }

        return [
            'ok' => $errors === [],
            'errors' => $errors,
            'duplicates' => $duplicates,
            'warnings' => $warnings,
            'summary' => [
                'title' => $meta['title'] ?? null,
                'questions' => array_sum($perSection),
                'total_marks' => round($totalMarks, 2),
                'sections' => count($sectionTitles),
                'duration_minutes' => $meta['duration_minutes'] ?? null,
            ],
            'sections' => $perSection,
        ];
    }

    /**
     * Commit the paper. Assumes dryRun() passed — it re-runs it anyway.
     *
     * @return array{test:Test, imported:int}
     *
     * @throws \RuntimeException when the paper does not validate
     */
    public function commit(array $meta, array $rows, User $user): array
    {
        $report = $this->dryRun($meta, $rows);

        if (!$report['ok']) {
            throw new \RuntimeException('The paper did not validate.');
        }

        return DB::transaction(function () use ($meta, $rows, $user) {
            // Passages first: the questions that read them need the ids.
            $passageIds = [];
            foreach ($meta['passages'] ?? [] as $passage) {
                $created = Passage::create([
                    'title' => $passage['title'] ?? null,
                    'body' => $passage['body'] ?? '',
                    // A Data Interpretation table renders client-side as a real
                    // <table> rather than a picture — crisp at any zoom and
                    // free to store, so a DI set can come in with the paper.
                    'table_data' => $passage['table_data'] ?? null,
                    'image_path' => $this->rows->downloadImage($passage['image_url'] ?? null, 'passage_images'),
                    'created_by' => $user->id,
                ]);
                $passageIds[(string) $passage['ref']] = $created->id;
            }

            $status = ($meta['auto_approve'] ?? false)
                ? Question::STATUS_APPROVED
                : Question::STATUS_PENDING;

            $test = Test::create([
                'title' => $meta['title'],
                'course_id' => $meta['course_id'] ?? null,
                'batch_id' => $meta['batch_id'] ?? null,
                'test_series_id' => $meta['test_series_id'] ?? null,
                'type' => $meta['type'] ?? 'mock',
                // A previous-year paper is a `pyp`, which is what the student
                // test-series UI already filters on.
                'category' => $meta['category'] ?? (($meta['source'] ?? null) === Question::SOURCE_PYQ ? 'pyp' : 'full_mock'),
                'duration_seconds' => isset($meta['duration_minutes']) ? (int) $meta['duration_minutes'] * 60 : null,
                'max_attempts' => $meta['max_attempts'] ?? null,
                'total_marks' => 0, // summed from the rows below
                'instructions' => $meta['instructions'] ?? null,
                'is_published' => false, // always a draft; publishing is a separate, gated act
                'is_free' => (bool) ($meta['is_free'] ?? false),
                'available_from' => $meta['available_from'] ?? null,
                'available_until' => $meta['available_until'] ?? null,
                'created_by' => $user->id,
                'cutoff_marks' => $meta['cutoff_marks'] ?? null,
                'cutoff_percentage' => $meta['cutoff_percentage'] ?? null,
                'shuffle_questions' => (bool) ($meta['shuffle_questions'] ?? false),
                'shuffle_options' => (bool) ($meta['shuffle_options'] ?? false),
                // Shifts of one exam run share a group so the normalisation
                // that already exists on `tests` has something to work across.
                'shift_group' => $meta['shift_group'] ?? $this->defaultShiftGroup($meta),
                'shift_label' => $meta['shift_label'] ?? ($meta['shift'] ?? null),
                'normalization_method' => $meta['normalization_method'] ?? 'none',
            ]);

            $sections = [];
            foreach ($meta['sections'] as $index => $sectionMeta) {
                $sections[(string) $sectionMeta['title']] = TestSection::create([
                    'test_id' => $test->id,
                    'title' => $sectionMeta['title'],
                    'sort_order' => $index,
                    'duration_seconds' => isset($sectionMeta['duration_minutes'])
                        ? (int) $sectionMeta['duration_minutes'] * 60
                        : null,
                    'cutoff_marks' => $sectionMeta['cutoff_marks'] ?? null,
                    'cutoff_percentage' => $sectionMeta['cutoff_percentage'] ?? null,
                    'is_qualifying' => (bool) ($sectionMeta['is_qualifying'] ?? false),
                ]);
            }

            $totalMarks = 0.0;
            $positions = [];
            $imported = 0;

            foreach ($rows as $index => $row) {
                $sectionTitle = trim((string) $row['section']);
                $section = $sections[$sectionTitle];
                $type = strtolower(trim((string) ($row['question_type'] ?? ''))) ?: Question::TYPE_SINGLE_CHOICE;
                $taxonomy = $this->codes->resolve($this->facetsFor($meta, $row, $index));
                $marks = $this->marksFor($meta, $row, $sectionTitle);
                $ref = trim((string) ($row['passage_ref'] ?? ''));

                $question = Question::create($taxonomy + [
                    // Subject falls back to the section title: on a real paper
                    // the section IS the subject, and making an operator repeat
                    // it on all 100 rows is exactly the kind of busywork this
                    // door exists to remove.
                    'subject' => trim((string) ($row['subject'] ?? '')) ?: $sectionTitle,
                    'topic' => trim((string) ($row['topic'] ?? '')) ?: $sectionTitle,
                    'difficulty' => strtolower(trim((string) ($row['difficulty'] ?? ''))) ?: 'medium',
                    'exam_tags' => array_values(array_filter([
                        $taxonomy['exam_code'] ? config("exams.registry.{$taxonomy['exam_code']}.name") : null,
                    ])),
                    'question_text' => trim((string) $row['question_text']),
                    'image_path' => $this->rows->downloadImage($row['question_image_url'] ?? null),
                    'explanation' => trim((string) ($row['explanation'] ?? '')) ?: null,
                    'marks' => $marks['marks'],
                    'negative_marks' => $marks['negative_marks'],
                    'is_active' => true,
                    'created_by' => $user->id,
                    'status' => $status,
                    'question_type' => $type,
                    'numeric_answer' => $type === Question::TYPE_NUMERIC ? (float) $row['numeric_answer'] : null,
                    'numeric_tolerance' => trim((string) ($row['numeric_tolerance'] ?? '')) !== ''
                        ? (float) $row['numeric_tolerance']
                        : 0,
                    'passage_id' => $ref !== '' ? ($passageIds[$ref] ?? null) : null,
                ]);

                $this->rows->createOptions($question, $row);

                $positions[$section->id] = ($positions[$section->id] ?? -1) + 1;

                TestSectionQuestion::create([
                    'test_section_id' => $section->id,
                    'question_id' => $question->id,
                    'sort_order' => $positions[$section->id],
                ]);

                $totalMarks += $marks['marks'];
                $imported++;
            }

            $test->update(['total_marks' => round($totalMarks, 2)]);

            return ['test' => $test->fresh(), 'imported' => $imported];
        });
    }

    /**
     * Facets for one row: the paper's, overridden only where the row speaks.
     *
     * @param  int  $index  zero-based row position, the serial fallback
     */
    private function facetsFor(array $meta, array $row, int $index): array
    {
        $facets = [
            'exam_code' => $meta['exam_code'] ?? null,
            'paper' => $meta['paper'] ?? null,
            'source' => $meta['source'] ?? Question::SOURCE_MOCK,
            'year' => $meta['year'] ?? null,
            'shift' => $meta['shift'] ?? null,
            'medium' => $meta['medium'] ?? Question::MEDIUM_DEFAULT,
        ];

        $serial = trim((string) ($row['serial'] ?? ''));
        $facets['serial'] = $serial !== '' ? (int) $serial : $index + 1;

        return $facets;
    }

    /**
     * Marks for a row: its own, else its section's default, else the paper's.
     *
     * Marks stay per-QUESTION in storage because real papers vary them by
     * section; the defaults exist so nobody retypes "2, 0.5" a hundred times.
     *
     * @return array{marks:float, negative_marks:float}
     */
    private function marksFor(array $meta, array $row, string $sectionTitle): array
    {
        $section = collect($meta['sections'] ?? [])
            ->firstWhere('title', $sectionTitle) ?? [];

        $pick = function (string $key, float $fallback) use ($row, $section, $meta) {
            foreach ([$row[$key] ?? null, $section[$key] ?? null, $meta[$key] ?? null] as $candidate) {
                if ($candidate !== null && trim((string) $candidate) !== '') {
                    return (float) $candidate;
                }
            }

            return $fallback;
        };

        return [
            'marks' => $pick('marks', 1.0),
            'negative_marks' => $pick('negative_marks', 0.0),
        ];
    }

    /**
     * Shifts of one exam run belong to one group, so cross-shift normalisation
     * has something to key on. Derived rather than asked for, because an
     * operator uploading shift 2 should not have to remember what they typed
     * when they uploaded shift 1.
     */
    private function defaultShiftGroup(array $meta): ?string
    {
        if (empty($meta['exam_code']) || empty($meta['year'])) {
            return null;
        }

        return implode('-', array_filter([
            strtoupper((string) $meta['exam_code']),
            $meta['paper'] ?? null,
            (string) $meta['year'],
        ]));
    }
}
