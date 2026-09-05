<?php

namespace App\Jobs;

use App\Imports\QuestionImport;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;

class ImportQuestionsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        private readonly string $tempFilePath,
        private readonly string $jobUuid,
        private readonly ?int $createdBy,
        private readonly string $status = \App\Models\Question::STATUS_PENDING,
        /**
         * Exam / paper / source / year / shift / medium, chosen once on the
         * upload form rather than retyped into all 200 rows. A row may still
         * override any of them with its own column; see QuestionImport.
         *
         * @var array<string, mixed>
         */
        private readonly array $facets = [],
    ) {}

    public function handle(): void
    {
        $filePath = storage_path('app/private/' . $this->tempFilePath);
        
        // In Laravel 11/12, storage local private dir might be where files are saved by default.
        // Let's fallback to app/ or private/ app/private depending on file existence.
        if (!file_exists($filePath)) {
            $filePath = storage_path('app/' . $this->tempFilePath);
        }

        if (!file_exists($filePath)) {
            Cache::put("import_status_{$this->jobUuid}", [
                'status' => 'failed',
                'imported' => 0,
                'errors' => [['row' => 0, 'field' => 'file', 'message' => 'Uploaded file could not be found.']],
            ], 3600);
            return;
        }

        // BOM stripping: check if file starts with UTF-8 BOM (\xEF\xBB\xBF)
        $content = file_get_contents($filePath);
        $bom = pack('H*', 'EFBBBF');
        if (str_starts_with($content, $bom)) {
            $content = substr($content, 3);
            file_put_contents($filePath, $content);
        }

        Cache::put("import_status_{$this->jobUuid}", [
            'status' => 'processing',
            'imported' => 0,
            'errors' => [],
        ], 3600);

        try {
            $import = new QuestionImport($this->createdBy, $this->status, $this->facets);
            $import->import($filePath);

            Cache::put("import_status_{$this->jobUuid}", [
                'status' => 'complete',
                'imported' => $import->getImportedCount(),
                'errors' => $import->getErrors(),
            ], 3600);
        } catch (\Exception $e) {
            Cache::put("import_status_{$this->jobUuid}", [
                'status' => 'failed',
                'imported' => 0,
                'errors' => [['row' => 0, 'field' => 'system', 'message' => $e->getMessage()]],
            ], 3600);
        } finally {
            if (file_exists($filePath)) {
                @unlink($filePath);
            }
        }
    }
}
