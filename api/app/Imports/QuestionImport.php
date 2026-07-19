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

    public function __construct(?int $createdBy = null)
    {
        $this->createdBy = $createdBy;
    }

    public function onRow(Row $row)
    {
        $rowNumber = $row->getRowIndex();
        $data = $row->toArray();

        // Trim keys to avoid issues with whitespace in headers
        $cleanedData = [];
        foreach ($data as $key => $value) {
            $cleanedData[trim($key)] = $value;
        }

        DB::transaction(function () use ($cleanedData) {
            $examTags = !empty($cleanedData['exam_tags']) 
                ? array_map('trim', explode('|', $cleanedData['exam_tags'])) 
                : [];

            $question = Question::create([
                'subject' => trim($cleanedData['subject']),
                'topic' => trim($cleanedData['topic']),
                'difficulty' => strtolower(trim($cleanedData['difficulty'])),
                'exam_tags' => $examTags,
                'question_text' => trim($cleanedData['question_text']),
                'explanation' => isset($cleanedData['explanation']) ? trim($cleanedData['explanation']) : null,
                'marks' => (float)$cleanedData['marks'],
                'negative_marks' => (float)$cleanedData['negative_marks'],
                'is_active' => true,
                'created_by' => $this->createdBy,
            ]);

            $correctOption = strtolower(trim($cleanedData['correct_option']));

            $options = [
                'a' => $cleanedData['option_a'],
                'b' => $cleanedData['option_b'],
                'c' => $cleanedData['option_c'],
                'd' => $cleanedData['option_d'],
            ];

            foreach ($options as $label => $text) {
                QuestionOption::create([
                    'question_id' => $question->id,
                    'label' => $label,
                    'option_text' => trim((string)$text),
                    'is_correct' => ($label === $correctOption),
                    'sort_order' => ord($label) - ord('a'),
                ]);
            }
        });

        $this->importedCount++;
    }

    public function rules(): array
    {
        return [
            'subject' => ['required', 'string'],
            'topic' => ['required', 'string'],
            'difficulty' => ['required', 'string', 'in:easy,medium,hard,EASY,MEDIUM,HARD'],
            'question_text' => ['required', 'string'],
            'option_a' => ['required'],
            'option_b' => ['required'],
            'option_c' => ['required'],
            'option_d' => ['required'],
            'correct_option' => ['required', 'string', 'in:a,b,c,d,A,B,C,D'],
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
