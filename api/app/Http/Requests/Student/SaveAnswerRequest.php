<?php

namespace App\Http\Requests\Student;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * Validation for PUT student/tests/sessions/{session}/answers/{question}.
 *
 * The important rule is on `selected_option_id`: it must exist AND belong to the
 * question named in the route. Option ids are globally unique across the bank, so
 * an unscoped id lets a candidate answer question A with question B's correct
 * option. `TestAnswer::isCorrect()` also scopes by question_id — this is the
 * second lock, so a bad id never reaches storage in the first place.
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

        return [
            'selected_option_id' => [
                'nullable',
                'integer',
                Rule::exists('question_options', 'id')->where(
                    fn ($q) => $q->where('question_id', $questionId)
                ),
            ],
            'time_spent_seconds' => ['nullable', 'integer', 'min:0', 'max:86400'],
        ];
    }

    public function messages(): array
    {
        return [
            'selected_option_id.exists' => 'That option does not belong to this question.',
        ];
    }
}
