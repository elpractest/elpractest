<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreStudyMaterialRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        // The file is required on create and optional on update — an admin
        // fixing a typo in a title should not have to re-upload 30 MB.
        // Keyed off the route parameter, not the verb: the update route is a
        // POST too (PHP does not populate $_FILES for a PUT body), so
        // isMethod('put') would have made the file mandatory on every edit.
        $isUpdate = $this->route('material') !== null;

        return [
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:2000'],
            'subject' => ['nullable', 'string', 'max:100'],
            'module_id' => [
                'nullable',
                // Scoped to the course being written to, so a material cannot be
                // filed under a module belonging to a different course.
                Rule::exists('course_modules', 'id')->where('course_id', $this->courseId()),
            ],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:9999'],
            'is_free_preview' => ['nullable', 'boolean'],
            'is_published' => ['nullable', 'boolean'],
            'file' => [
                $isUpdate ? 'nullable' : 'required',
                'file',
                'mimes:pdf',
                // `mimes` reads the client extension; mimetypes checks the
                // sniffed type. Both, because either alone is bypassable.
                'mimetypes:application/pdf',
                'max:'.config('studymaterials.max_upload_kb'),
            ],
            'page_count' => ['nullable', 'integer', 'min:1', 'max:20000'],
        ];
    }

    public function messages(): array
    {
        $mb = round(((int) config('studymaterials.max_upload_kb')) / 1024);

        return [
            'file.mimes' => 'Study material must be a PDF.',
            'file.mimetypes' => 'Study material must be a PDF.',
            'file.max' => "The PDF must be {$mb} MB or smaller — compress it before uploading.",
        ];
    }

    /**
     * The course this request writes into: the route parameter on create, and
     * the material's own course on update.
     */
    private function courseId(): ?int
    {
        $course = $this->route('course');
        if ($course) {
            return is_object($course) ? $course->id : (int) $course;
        }

        $material = $this->route('material');

        return is_object($material) ? $material->course_id : null;
    }
}
