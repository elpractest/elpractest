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

// Remind enrolled candidates about a scheduled mock about to open. Every five
// minutes with a 15-minute look-ahead window, so a reminder still goes out if
// one run is missed; the command claims each test with a conditional update,
// so overlapping runs cannot message the same cohort twice.
Schedule::command('tests:remind-upcoming')->everyFiveMinutes()->withoutOverlapping();
