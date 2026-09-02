<?php

namespace App\Console\Commands;

use App\Jobs\FanOutTestReminder;
use App\Models\Test;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Reminds enrolled candidates shortly before a scheduled mock opens.
 *
 * Runs on the scheduler every few minutes and looks for published tests whose
 * `available_from` falls inside the next window. Claiming is done with a
 * conditional UPDATE rather than a read-then-write, so two overlapping runs
 * cannot both send the same cohort the same reminder.
 */
class RemindUpcomingTests extends Command
{
    protected $signature = 'tests:remind-upcoming
                            {--minutes=60 : How far ahead to look}
                            {--window=15 : Width of the window, in minutes}';

    protected $description = 'Notify enrolled students about a scheduled mock that is about to open';

    public function handle(): int
    {
        $minutes = (int) $this->option('minutes');
        $window = (int) $this->option('window');

        $from = now()->addMinutes($minutes - $window);
        $until = now()->addMinutes($minutes);

        $tests = Test::query()
            ->where('is_published', true)
            ->whereNull('reminder_sent_at')
            ->whereNotNull('available_from')
            ->whereBetween('available_from', [$from, $until])
            ->whereNotNull('course_id')
            ->get();

        if ($tests->isEmpty()) {
            $this->info('No upcoming tests to remind about.');

            return self::SUCCESS;
        }

        foreach ($tests as $test) {
            // Claim it first. The conditional update returns 0 rows if another
            // run already took this test, and only the winner dispatches — so
            // a cohort can never be messaged twice.
            $claimed = DB::table('tests')
                ->where('id', $test->id)
                ->whereNull('reminder_sent_at')
                ->update(['reminder_sent_at' => now()]);

            if ($claimed === 0) {
                continue;
            }

            $minutesUntil = max(1, (int) round(now()->diffInMinutes($test->available_from, false)));

            FanOutTestReminder::dispatch(
                $test->id,
                $test->title,
                $test->course_id,
                $test->batch_id,
                $minutesUntil,
            );

            $this->info("Reminder queued for '{$test->title}' (opens in {$minutesUntil} min).");
        }

        return self::SUCCESS;
    }
}
