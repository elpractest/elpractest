<?php

namespace App\Console\Commands;

use App\Models\Batch;
use App\Models\Course;
use App\Models\Enrollment;
use App\Models\Question;
use App\Models\QuestionOption;
use App\Models\Test;
use App\Models\TestSection;
use App\Models\TestSectionQuestion;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Seeds the fixtures `tests/Load/mock-day-start.js` needs: N enrolled
 * candidates and one published full-length paper.
 *
 * Refuses to run in production. It creates users with a known shared password
 * and a published test — harmless on a scratch stack, a genuine security hole
 * on a live one.
 */
class SeedMockLoadTest extends Command
{
    protected $signature = 'load:seed-mock
                            {--candidates=500 : How many load candidates to create}
                            {--questions=100 : Questions on the paper}
                            {--password=LoadTest!2026 : Shared password for the load users}';

    protected $description = 'Seed candidates + a full-length paper for the mock-day load test (non-production only)';

    public function handle(): int
    {
        if (app()->environment('production')) {
            $this->error('Refusing to run in production — this seeds users with a shared, known password.');

            return self::FAILURE;
        }

        $candidates = (int) $this->option('candidates');
        $questionCount = (int) $this->option('questions');
        $password = Hash::make($this->option('password'));

        $course = Course::firstOrCreate(
            ['slug' => 'load-test-course'],
            ['title' => 'Load Test Course', 'exam_category' => 'SSC', 'is_published' => true],
        );
        $batch = Batch::firstOrCreate(
            ['course_id' => $course->id, 'name' => 'Load Test Batch'],
            ['is_active' => true],
        );

        $test = Test::where('title', 'Load Test Mock')->first();

        if (! $test) {
            // Built without the factory on purpose: the production image
            // installs composer --no-dev, so fakerphp is absent there and a
            // factory call fatals. This command has to run against that image.
            $author = User::first() ?? User::create([
                'name' => 'Load Test Author',
                'email' => 'load-author@load.test',
                'password' => $password,
                'email_verified_at' => now(),
            ]);

            $test = Test::create([
                'title' => 'Load Test Mock',
                'course_id' => $course->id,
                'batch_id' => $batch->id,
                'type' => 'mock',
                'duration_seconds' => 3600,
                'total_marks' => $questionCount,
                'is_published' => true,
                'created_by' => $author->id,
            ]);

            $section = TestSection::create([
                'test_id' => $test->id, 'title' => 'General', 'sort_order' => 0,
            ]);

            $this->info("Building a {$questionCount}-question paper…");
            $bar = $this->output->createProgressBar($questionCount);

            for ($i = 0; $i < $questionCount; $i++) {
                $question = Question::create([
                    'subject' => 'Quant', 'topic' => 'Load', 'difficulty' => 'medium',
                    'question_text' => "Load question {$i}?", 'marks' => 1, 'negative_marks' => 0.25,
                    'status' => Question::STATUS_APPROVED,
                ]);

                foreach (['a', 'b', 'c', 'd'] as $k => $label) {
                    QuestionOption::create([
                        'question_id' => $question->id, 'label' => $label,
                        'option_text' => "Option {$label}", 'is_correct' => $k === 0, 'sort_order' => $k,
                    ]);
                }

                TestSectionQuestion::create([
                    'test_section_id' => $section->id, 'question_id' => $question->id, 'sort_order' => $i,
                ]);
                $bar->advance();
            }

            $bar->finish();
            $this->newLine();
        }

        $this->info("Seeding {$candidates} candidates…");
        $bar = $this->output->createProgressBar($candidates);
        $tokens = [];

        for ($i = 1; $i <= $candidates; $i++) {
            $email = "load-{$i}@load.test";

            $user = User::where('email', $email)->first();
            if (! $user) {
                $user = User::create([
                    'name' => "Load Candidate {$i}",
                    'email' => $email,
                    'password' => $password,
                    'email_verified_at' => now(),
                ]);
                $user->assignRole('student');
            }

            Enrollment::firstOrCreate(
                ['user_id' => $user->id, 'course_id' => $course->id, 'batch_id' => $batch->id],
                ['enrolled_at' => now(), 'is_active' => true],
            );

            // A bearer token per candidate, so the load script can hit the
            // endpoint under test directly. Logging in 500 times from one
            // machine only measures the login limiter (which keys on IP) —
            // real candidates arrive already signed in, from 500 addresses.
            $user->tokens()->delete();
            $tokens[] = $user->createToken('load-test')->plainTextToken;

            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);

        $tokenFile = storage_path('app/load-tokens.json');
        file_put_contents($tokenFile, json_encode($tokens));

        $this->info('Ready.');
        $this->line("  TEST_ID={$test->id}");
        $this->line("  CANDIDATES={$candidates}");
        $this->line("  Tokens: {$tokenFile}");

        return self::SUCCESS;
    }

    /** Remove everything this command created. */
    public function cleanup(): void
    {
        DB::table('users')->where('email', 'like', 'load-%@load.test')->delete();
    }
}
