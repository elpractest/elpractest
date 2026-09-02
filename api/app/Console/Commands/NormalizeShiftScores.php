<?php

namespace App\Console\Commands;

use App\Models\Test;
use App\Services\ScoreNormalizationService;
use Illuminate\Console\Command;

/**
 * Compute normalised marks for one shift group, or for every group that has one.
 *
 * Deliberately NOT scheduled: normalisation is only meaningful once every shift
 * of an exam has finished, and running it early would publish a normalised mark
 * computed against half a cohort. The owner runs it when the exam window closes.
 */
class NormalizeShiftScores extends Command
{
    protected $signature = 'practest:normalize {--group= : Only this shift_group}';

    protected $description = 'Compute cross-shift normalised scores for a completed exam';

    public function handle(ScoreNormalizationService $service): int
    {
        $groups = $this->option('group')
            ? [$this->option('group')]
            : Test::whereNotNull('shift_group')
                ->where('normalization_method', '!=', ScoreNormalizationService::METHOD_NONE)
                ->distinct()
                ->pluck('shift_group')
                ->all();

        if ($groups === []) {
            $this->warn('No shift groups configured for normalisation.');
            return Command::SUCCESS;
        }

        foreach ($groups as $group) {
            $result = $service->normalizeShiftGroup($group);
            $this->info(sprintf(
                'Group "%s": method=%s, tests=%d, sessions normalised=%d',
                $group,
                $result['method'],
                $result['tests'],
                $result['sessions'],
            ));
        }

        return Command::SUCCESS;
    }
}
