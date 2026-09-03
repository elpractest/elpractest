<?php

namespace App\Imports;

use App\Models\Question;
use App\Models\QuestionOption;
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

    /**
     * Imported questions land in review by default.
     *
     * A CSV is the easiest way to put a wrong answer key in front of thousands
     * of candidates at once, and it is the one authoring path with no human
     * looking at each row. So bulk import feeds the review queue rather than
     * going live; pass 'approved' explicitly to skip that.
     */
    public function __construct(?int $createdBy = null, string $status = Question::STATUS_PENDING)
    {
        $this->createdBy = $createdBy;
        $this->status = $status;
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

                $question = Question::create([
                    'subject' => trim($cleanedData['subject']),
                    'topic' => trim($cleanedData['topic']),
                    'difficulty' => strtolower(trim($cleanedData['difficulty'])),
                    'exam_tags' => $examTags,
                    'question_text' => trim($cleanedData['question_text']),
                    'image_path' => $this->downloadImage($cleanedData['question_image_url'] ?? null),
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

                if ($type === Question::TYPE_NUMERIC) {
                    return; // no options at all for a numeric question
                }

                // Correct letters, pipe-separated for multi_select ("a|c"), a
                // single letter for single_choice — same '|' convention exam_tags
                // already uses in this file.
                $correctLetters = array_map(
                    fn ($l) => strtolower(trim($l)),
                    explode('|', (string) $cleanedData['correct_option'])
                );

                $correctCount = 0;
                $optionCount = 0;
                foreach (range('a', 'f') as $label) {
                    $text = isset($cleanedData["option_{$label}"]) ? trim((string) $cleanedData["option_{$label}"]) : '';
                    // Reasoning figure-series options ("which figure completes
                    // the series?") have nothing meaningful to put in the text
                    // column — a downloaded image alone is enough to make the
                    // option real, same as the admin single-question form.
                    $imagePath = $this->downloadImage($cleanedData["option_{$label}_image_url"] ?? null, 'option_images');

                    if ($text === '' && !$imagePath) {
                        continue;
                    }

                    $isCorrect = in_array($label, $correctLetters, true);
                    if ($isCorrect) {
                        $correctCount++;
                    }

                    QuestionOption::create([
                        'question_id' => $question->id,
                        'label' => $label,
                        'option_text' => $text,
                        'image_path' => $imagePath,
                        'is_correct' => $isCorrect,
                        'sort_order' => ord($label) - ord('a'),
                    ]);
                    $optionCount++;
                }

                if ($optionCount < 2) {
                    throw new \RuntimeException("At least two options (text and/or image) are required (found {$optionCount}).");
                }
                if ($type === Question::TYPE_SINGLE_CHOICE && $correctCount !== 1) {
                    throw new \RuntimeException("correct_option must name exactly one option (found {$correctCount}).");
                }
                if ($type === Question::TYPE_MULTI_SELECT && $correctCount < 1) {
                    throw new \RuntimeException('correct_option must name at least one option.');
                }
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
        ];
    }

    /**
     * Best-effort fetch of a question or option image from a CSV-supplied URL.
     *
     * A bad or dead URL degrades to "it imports without that picture", never
     * to the row failing outright — text is the primary content, and an
     * admin can attach the image by hand afterward from the edit form.
     * Treating a broken image link as a hard failure would mean one stale
     * URL in row 340 of a 500-row file silently drops a perfectly good
     * question along with it. (An image-only option with a dead URL and no
     * text still fails, same as it would via the admin form — see onRow().)
     */
    private function downloadImage(?string $url, string $directory = 'question_images'): ?string
    {
        $url = trim((string) $url);
        if ($url === '') {
            return null;
        }

        try {
            $response = Http::timeout(10)->get($url);
            if (!$response->successful()) {
                return null;
            }

            $contentType = $response->header('Content-Type', '');
            if (!str_starts_with($contentType, 'image/')) {
                return null;
            }

            $body = $response->body();
            // 6MB cap: generous for a diagram, small enough that one
            // misbehaving URL cannot make a 500-row import balloon in size
            // or tie up the queue worker fetching something enormous.
            if (strlen($body) === 0 || strlen($body) > 6 * 1024 * 1024) {
                return null;
            }

            $extension = match ($contentType) {
                'image/png' => 'png',
                'image/webp' => 'webp',
                default => 'jpg',
            };

            $path = $directory . '/' . Str::uuid() . '.' . $extension;
            Storage::disk('public')->put($path, $body);

            return $path;
        } catch (\Throwable $e) {
            return null;
        }
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
