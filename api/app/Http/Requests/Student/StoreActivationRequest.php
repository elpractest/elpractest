<?php

namespace App\Http\Requests\Student;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreActivationRequest extends FormRequest
{
    public function authorize(): bool
    {
        // §6: OTP verification is required before an activation request is accepted
        if ($this->user()->phone_verified_at === null) {
            abort(response()->json([
                'message' => 'Please verify your phone number first.',
                'phone_verified' => false,
            ], 403));
        }

        return true;
    }

    public function rules(): array
    {
        return [
            'batch_id' => ['required', 'exists:batches,id'],
            'payment_reference' => [
                'required',
                'string',
                'max:255',
                Rule::unique('activation_requests')->where(function ($query) {
                    return $query->whereIn('status', ['pending', 'approved']);
                }),
            ],
            'proof_document' => ['required', 'file', 'mimes:jpg,jpeg,png,pdf', 'max:4096'], // max 4MB
        ];
    }

    public function messages(): array
    {
        return [
            'payment_reference.unique' => 'An active or approved request with this payment reference already exists.',
        ];
    }
}
