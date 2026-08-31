<?php

namespace App\Console\Commands;

use App\Services\ItemAnalysisService;
use Illuminate\Console\Command;

/**
 * Recompute cached item statistics (difficulty + discrimination) for the bank.
 *
 * Scheduled nightly. The cached values on `questions` are only ever a cache -
 * this command rebuilds them from raw answers, so a corrected answer key or a
 * deleted session is reflected on the next run.
 */
class ComputeItemStatistics extends Command
{
    protected $signature = 'practest:item-stats {--question= : Only recompute this question id}';

    protected $description = 'Recompute difficulty and discrimination indices for the question bank';

    public function handle(ItemAnalysisService $service): int
    {
        $only = $this->option('question');
        $this->info($only ? "Recomputing item statistics for question {$only}..." : 'Recomputing item statistics...');

        $written = $service->recomputeAll($only ? (int) $only : null);

        $this->info("Item statistics updated for {$written} question(s).");

        return Command::SUCCESS;
    }
}
