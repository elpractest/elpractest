<?php

namespace App\Services;

use App\Models\Question;
use App\Models\QuestionOption;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * The shared rules for turning one spreadsheet row into a scoreable question.
 *
 * Both ingestion doors need exactly the same answers to "does this row have a
 * usable answer key?" and "is this image fetchable?" — the bank importer
 * (App\Imports\QuestionImport) and the paper importer (PaperImportService).
 * Those answers live here once, because two copies of a validity rule is how
 * you end up with a paper that imports a question the bank would have rejected.
 */
class QuestionRowBuilder
{
    /** Letters a row may carry options under. */
    public const LABELS = ['a', 'b', 'c', 'd', 'e', 'f'];

    /**
     * Create the option rows for a question, enforcing that the key is
     * actually scoreable.
     *
     * @param  array<string, mixed>  $row  the raw spreadsheet row
     * @return int  how many options were created
     *
     * @throws \RuntimeException when the row cannot be scored
     */
    public function createOptions(Question $question, array $row, bool $downloadImages = true): int
    {
        if ($question->question_type === Question::TYPE_NUMERIC) {
            return 0; // no options at all for a numeric question
        }

        // Correct letters, pipe-separated for multi_select ("a|c"), a single
        // letter for single_choice — the same '|' convention exam_tags uses.
        $correctLetters = array_map(
            fn ($l) => strtolower(trim($l)),
            explode('|', (string) ($row['correct_option'] ?? '')),
        );

        $correctCount = 0;
        $optionCount = 0;

        foreach (self::LABELS as $label) {
            $text = isset($row["option_{$label}"]) ? trim((string) $row["option_{$label}"]) : '';

            // Reasoning figure-series options ("which figure completes the
            // series?") have nothing meaningful to put in the text column — a
            // downloaded image alone is enough to make the option real, same as
            // the admin single-question form.
            $imagePath = $downloadImages
                ? $this->downloadImage($row["option_{$label}_image_url"] ?? null, 'option_images')
                : null;

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

        $this->assertScoreable($question->question_type, $optionCount, $correctCount);

        return $optionCount;
    }

    /**
     * The same check, without writing anything — what a dry run needs.
     *
     * @throws \RuntimeException
     */
    public function assertRowScoreable(array $row, string $type): void
    {
        if ($type === Question::TYPE_NUMERIC) {
            if (!isset($row['numeric_answer']) || trim((string) $row['numeric_answer']) === '') {
                throw new \RuntimeException('A numeric question needs a numeric_answer.');
            }

            return;
        }

        $correctLetters = array_map(
            fn ($l) => strtolower(trim($l)),
            explode('|', (string) ($row['correct_option'] ?? '')),
        );

        $optionCount = 0;
        $correctCount = 0;

        foreach (self::LABELS as $label) {
            $hasText = trim((string) ($row["option_{$label}"] ?? '')) !== '';
            $hasImage = trim((string) ($row["option_{$label}_image_url"] ?? '')) !== '';

            if (!$hasText && !$hasImage) {
                continue;
            }

            $optionCount++;
            if (in_array($label, $correctLetters, true)) {
                $correctCount++;
            }
        }

        $this->assertScoreable($type, $optionCount, $correctCount);
    }

    /** @throws \RuntimeException */
    private function assertScoreable(string $type, int $optionCount, int $correctCount): void
    {
        if ($optionCount < 2) {
            throw new \RuntimeException(
                "At least two options (text and/or image) are required (found {$optionCount})."
            );
        }

        if ($type === Question::TYPE_SINGLE_CHOICE && $correctCount !== 1) {
            throw new \RuntimeException(
                "correct_option must name exactly one option (found {$correctCount})."
            );
        }

        if ($type === Question::TYPE_MULTI_SELECT && $correctCount < 1) {
            throw new \RuntimeException('correct_option must name at least one option.');
        }
    }

    /**
     * Best-effort fetch of a question or option image from a supplied URL.
     *
     * A bad or dead URL degrades to "it imports without that picture", never to
     * the row failing outright — text is the primary content, and an admin can
     * attach the image by hand afterward from the edit form. Treating a broken
     * image link as a hard failure would mean one stale URL in row 340 of a
     * 500-row file silently drops a perfectly good question with it. (An
     * image-only option with a dead URL and no text still fails, same as it
     * would via the admin form — see createOptions().)
     */
    public function downloadImage(?string $url, string $directory = 'question_images'): ?string
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
            // misbehaving URL cannot make a 500-row import balloon in size or
            // tie up the queue worker fetching something enormous.
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
}
