<?php

namespace App\Http\Requests\Student;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validation for PUT student/tests/sessions/{session}/answers/{question}.
 *
 * The important rule, on every option-id field: it must exist AND belong to the
 * question named in the route. Option ids are globally unique across the bank, so
 * an unscoped id lets a candidate answer question A with question B's correct
 * option. `TestAnswer::isCorrect()` also scopes by question_id — this is the
 * second lock, so a bad id never reaches storage in the first place.
 *
 * All three answer fields are accepted regardless of question type — the
 * controller only persists whichever one matches the question, so this stays a
 * plain validator rather than needing a type-conditional shape.
 */
class SaveAnswerRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // ownership is enforced in the controller against the session
    }

    public function rules(): array
    {
        $questionId = $this->route('question');
        $existsOnThisQuestion = fn () => Rule::exists('question_options', 'id')->where(
            fn ($q) => $q->where('question_id', $questionId)
        );

        return [
            'selected_option_id' => ['nullable', 'integer', $existsOnThisQuestion()],
            'selected_option_ids' => ['nullable', 'array'],
            'selected_option_ids.*' => ['integer', $existsOnThisQuestion()],
            'numeric_response' => ['nullable', 'numeric'],
            'time_spent_seconds' => ['nullable', 'integer', 'min:0', 'max:86400'],
        ];
    }

    public function messages(): array
    {
        return [
            'selected_option_id.exists' => 'That option does not belong to this question.',
            'selected_option_ids.*.exists' => 'One of those options does not belong to this question.',
        ];
    }
}
