<?php

namespace App\Console\Commands;

use App\Jobs\ComputeTestAnalytics;
use App\Models\TestSession;
use Illuminate\Console\Command;

class AutoSubmitExpiredTests extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'test:auto-submit';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Find and auto-submit all expired test sessions';

    /**
     * Execute the console command.
     */
    public function handle(): int
    {
        $this->info('Checking for expired test sessions...');

        $activeSessions = TestSession::whereNull('submitted_at')->get();
        $submittedCount = 0;

        foreach ($activeSessions as $session) {
            $session->reconcileSectionTiming();
            
            // If it got submitted after reconciliation
            if ($session->submitted_at !== null) {
                $this->info("Auto-submitted expired session ID: {$session->id} for user ID: {$session->user_id}");
                ComputeTestAnalytics::dispatch($session);
                $submittedCount++;
            }
        }

        $this->info("Auto-submit process complete. {$submittedCount} session(s) submitted.");

        return Command::SUCCESS;
    }
}
