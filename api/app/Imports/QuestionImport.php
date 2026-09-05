<?php

namespace App\Imports;

use App\Models\Question;
use App\Models\QuestionOption;
use App\Services\QuestionCodeService;
use App\Services\QuestionRowBuilder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Maatwebsite\Excel\Concerns\Importable;
use Maatwebsite\Excel\Concerns\OnEachRow;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Concerns\WithValidation;
use Maatwebsite\Excel\Concerns\SkipsOnFailure;
use Maatwebsite\Excel\Concerns\WithCustomCsvSettings;
use Maatwebsite\Excel\Validators\Failure;
use Maatwebsite\Excel\Row;

class QuestionImport implements OnEachRow, WithHeadingRow, WithValidation, SkipsOnFailure, WithCustomCsvSettings
{
    use Importable;

    private array $errors = [];
    private int $importedCount = 0;
    private ?int $createdBy = null;
    private string $status;
    private array $facets = [];
    private QuestionCodeService $codes;
    private QuestionRowBuilder $rows;

    /**
     * Imported questions land in review by default.
     *
     * A CSV is the easiest way to put a wrong answer key in front of thousands
     * of candidates at once, and it is the one authoring path with no human
     * looking at each row. So bulk import feeds the review queue rather than
     * going live; pass 'approved' explicitly to skip that.
     */
    public function __construct(
        ?int $createdBy = null,
        string $status = Question::STATUS_PENDING,
        array $facets = [],
    ) {
        $this->createdBy = $createdBy;
        $this->status = $status;
        $this->facets = $facets;
        $this->codes = app(QuestionCodeService::class);
        $this->rows = app(QuestionRowBuilder::class);
    }

    /**
     * Resolve a row's taxonomy: upload-level facets, overridden per row only
     * where the row actually says something.
     *
     * The facets ride the UPLOAD because a file is almost always one paper in
     * one medium — repeating "UGCNET,P1,pyq,2024,2,en" on 200 rows is both
     * tedious and the likeliest place for classification to drift. The override
     * columns exist for the genuinely mixed file.
     */
    private function facetsFor(array $row): array
    {
        $merged = $this->facets;

        foreach (['exam_code', 'paper', 'source', 'year', 'shift', 'medium', 'serial'] as $key) {
            if (isset($row[$key]) && trim((string) $row[$key]) !== '') {
                $merged[$key] = trim((string) $row[$key]);
            }
        }

        return $this->codes->resolve($merged);
    }

    /**
     * A row can put a wrong answer key in front of thousands of candidates with
     * no human looking at it — so beyond the field-level `rules()` below, every
     * row also gets a cross-field sanity check (does the type actually have a
     * scoreable key?) here, inside the same transaction. A failure rolls that
     * one row back and reports it, exactly like a `rules()` failure would,
     * without aborting the rest of the file.
     */
    public function onRow(Row $row)
    {
        $rowNumber = $row->getRowIndex();
        $data = $row->toArray();

        // Trim keys to avoid issues with whitespace in headers
        $cleanedData = [];
        foreach ($data as $key => $value) {
            $cleanedData[trim($key)] = $value;
        }

        try {
            DB::transaction(function () use ($cleanedData) {
                $examTags = !empty($cleanedData['exam_tags'])
                    ? array_map('trim', explode('|', $cleanedData['exam_tags']))
                    : [];

                $type = strtolower(trim($cleanedData['question_type'] ?? '')) ?: Question::TYPE_SINGLE_CHOICE;
                if (!in_array($type, Question::QUESTION_TYPES, true)) {
                    throw new \RuntimeException("Unknown question_type '{$type}'.");
                }

                // Taxonomy first: a row that cannot be filed is rejected before
                // anything is written, so a typo'd exam code costs one row
                // rather than leaving an unfindable question in the bank.
                $taxonomy = $this->facetsFor($cleanedData);

                // The unique index would catch this anyway, but a raw
                // constraint violation says nothing useful. Re-uploading the
                // same paper is the single most likely operator mistake, and
                // the fix is to know WHICH question already exists.
                if ($this->codes->isTaken($taxonomy['question_code'])) {
                    throw new \RuntimeException(
                        "Duplicate: {$taxonomy['question_code']} is already in the bank."
                    );
                }

                $question = Question::create($taxonomy + [
                    'subject' => trim($cleanedData['subject']),
                    'topic' => trim($cleanedData['topic']),
                    'difficulty' => strtolower(trim($cleanedData['difficulty'])),
                    'exam_tags' => $examTags,
                    'question_text' => trim($cleanedData['question_text']),
                    'image_path' => $this->rows->downloadImage($cleanedData['question_image_url'] ?? null),
                    'explanation' => isset($cleanedData['explanation']) ? trim($cleanedData['explanation']) : null,
                    'marks' => (float) $cleanedData['marks'],
                    'negative_marks' => (float) $cleanedData['negative_marks'],
                    'is_active' => true,
                    'created_by' => $this->createdBy,
                    'status' => $this->status,
                    'question_type' => $type,
                    'numeric_answer' => $type === Question::TYPE_NUMERIC ? (float) $cleanedData['numeric_answer'] : null,
                    'numeric_tolerance' => isset($cleanedData['numeric_tolerance']) && $cleanedData['numeric_tolerance'] !== ''
                        ? (float) $cleanedData['numeric_tolerance']
                        : 0,
                    // Attaches a bulk-imported question to a Data
                    // Interpretation / comprehension set an admin already
                    // built by hand (see PassageController) — the table or
                    // chart itself is authored once in the UI; the dozens
                    // of questions that read it come in through here.
                    'passage_id' => !empty($cleanedData['passage_id']) ? (int) $cleanedData['passage_id'] : null,
                ]);

                // Option shape, the answer-key checks and image fetching are
                // shared with the paper importer — see QuestionRowBuilder.
                $this->rows->createOptions($question, $cleanedData);
            });
        } catch (\Throwable $e) {
            $this->errors[] = [
                'row' => $rowNumber,
                'field' => 'General',
                'message' => $e->getMessage(),
            ];

            return;
        }

        $this->importedCount++;
    }

    public function rules(): array
    {
        return [
            'subject' => ['required', 'string'],
            'topic' => ['required', 'string'],
            'difficulty' => ['required', 'string', 'in:easy,medium,hard,EASY,MEDIUM,HARD'],
            'question_text' => ['required', 'string'],
            // Omit the column entirely and every row behaves exactly as before
            // (single_choice, option_a-d + correct_option required below).
            'question_type' => ['nullable', 'string', 'in:single_choice,multi_select,numeric,SINGLE_CHOICE,MULTI_SELECT,NUMERIC'],
            // Not `required`: an option can now be image-only (see
            // option_{a..f}_image_url below), so a blank text cell is not by
            // itself invalid. onRow() enforces "at least two real options"
            // (text and/or image) after both columns are read together,
            // which a field-level rule can't do since it only sees one
            // column at a time.
            'option_a' => ['nullable'],
            'option_b' => ['nullable'],
            'option_c' => ['nullable'],
            'option_d' => ['nullable'],
            'option_e' => ['nullable'],
            'option_f' => ['nullable'],
            // `required_unless` only controls whether the field must be
            // PRESENT; it does not make a following type rule skip a null
            // value. Without `nullable`, a numeric-type row — which
            // legitimately leaves this blank, per onRow() below — failed
            // the `string` rule against that null and was rejected outright.
            // A CSV was the one bulk path into the question bank, and this
            // meant `numeric` never actually worked through it despite the
            // rest of the file being built to support it.
            'correct_option' => ['required_unless:question_type,numeric,NUMERIC', 'nullable', 'string'],
            'numeric_answer' => ['required_if:question_type,numeric,NUMERIC', 'nullable', 'numeric'],
            'numeric_tolerance' => ['nullable', 'numeric', 'min:0'],
            'marks' => ['required', 'numeric', 'min:0'],
            'negative_marks' => ['required', 'numeric', 'min:0'],
            'explanation' => ['nullable'],
            'exam_tags' => ['nullable', 'string'],
            // A spreadsheet cell cannot carry a binary upload — an image
            // column has to be a URL the import fetches, unlike the admin
            // form where the file itself is attached to the request.
            // Reasoning figure-series sets (four image-only options per row,
            // repeated for dozens of questions) are exactly the kind of
            // content a coaching institute already has as a folder of
            // hosted images and a spreadsheet — worth the six extra columns
            // most other rows will just leave blank.
            'question_image_url' => ['nullable', 'url', 'max:2048'],
            'option_a_image_url' => ['nullable', 'url', 'max:2048'],
            'option_b_image_url' => ['nullable', 'url', 'max:2048'],
            'option_c_image_url' => ['nullable', 'url', 'max:2048'],
            'option_d_image_url' => ['nullable', 'url', 'max:2048'],
            'option_e_image_url' => ['nullable', 'url', 'max:2048'],
            'option_f_image_url' => ['nullable', 'url', 'max:2048'],
            'passage_id' => ['nullable', 'integer', 'exists:passages,id'],

            // Per-row taxonomy OVERRIDES. Normally blank: the upload form
            // carries these once for the whole file. Only shape is checked
            // here — QuestionCodeService::resolve() is what actually validates
            // a value against the exam registry, because that check needs the
            // other facets in hand (a paper is only valid for its own exam).
            // Deliberately shape-free. A spreadsheet reader types a shift of
            // "2" as an INTEGER, which fails `string`, and `max:16` on that
            // same value silently changes meaning from "16 characters" to
            // "not more than 16". Both length and vocabulary are checked in
            // QuestionCodeService::resolve(), where the value has already been
            // cast and the other facets are in hand.
            'exam_code' => ['nullable'],
            'paper' => ['nullable'],
            'source' => ['nullable'],
            'year' => ['nullable', 'integer'],
            'shift' => ['nullable'],
            'medium' => ['nullable'],
            'serial' => ['nullable', 'integer', 'min:1'],
        ];
    }

    public function onFailure(Failure ...$failures)
    {
        foreach ($failures as $failure) {
            $this->errors[] = [
                'row' => $failure->row(),
                'field' => $failure->attribute(),
                'message' => $failure->errors()[0] ?? 'Validation failed',
            ];
        }
    }

    public function getErrors(): array
    {
        return $this->errors;
    }

    public function getImportedCount(): int
    {
        return $this->importedCount;
    }

    public function getCsvSettings(): array
    {
        return [
            'input_encoding' => 'UTF-8',
        ];
    }
}
