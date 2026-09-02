<?php

namespace App\Imports;

use App\Models\Question;
use App\Models\QuestionOption;
use Illuminate\Support\Facades\DB;
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
                foreach (range('a', 'f') as $label) {
                    $column = "option_{$label}";
                    if (!isset($cleanedData[$column]) || trim((string) $cleanedData[$column]) === '') {
                        continue;
                    }

                    $isCorrect = in_array($label, $correctLetters, true);
                    if ($isCorrect) {
                        $correctCount++;
                    }

                    QuestionOption::create([
                        'question_id' => $question->id,
                        'label' => $label,
                        'option_text' => trim((string) $cleanedData[$column]),
                        'is_correct' => $isCorrect,
                        'sort_order' => ord($label) - ord('a'),
                    ]);
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
            'option_a' => ['required_unless:question_type,numeric,NUMERIC'],
            'option_b' => ['required_unless:question_type,numeric,NUMERIC'],
            'correct_option' => ['required_unless:question_type,numeric,NUMERIC', 'string'],
            'numeric_answer' => ['required_if:question_type,numeric,NUMERIC', 'nullable', 'numeric'],
            'numeric_tolerance' => ['nullable', 'numeric', 'min:0'],
            'marks' => ['required', 'numeric', 'min:0'],
            'negative_marks' => ['required', 'numeric', 'min:0'],
            'explanation' => ['nullable'],
            'exam_tags' => ['nullable', 'string'],
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
