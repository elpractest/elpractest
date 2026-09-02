<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Auto-submit expired tests every minute
Schedule::command('test:auto-submit')->everyMinute();

// Rebuild cached item statistics (difficulty + discrimination) from raw answers.
// Nightly and off-peak: it is a full-bank recompute, and nothing downstream
// needs it to be fresher than a day.
Schedule::command('practest:item-stats')->dailyAt('03:15');
