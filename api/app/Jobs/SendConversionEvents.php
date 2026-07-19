<?php

namespace App\Jobs;

use App\Models\Payment;
use App\Services\ConversionTrackingService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendConversionEvents implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The number of times the job may be attempted.
     */
    public int $tries = 3;

    /**
     * The number of seconds to wait before retrying the job.
     */
    public array $backoff = [10, 30, 60];

    /**
     * Create a new job instance.
     */
    public function __construct(public Payment $payment)
    {
        $this->onQueue('default');
    }

    /**
     * Execute the job.
     */
    public function handle(ConversionTrackingService $trackerService): void
    {
        $trackerService->sendMetaPurchaseEvent($this->payment);
        $trackerService->sendGa4PurchaseEvent($this->payment);
    }
}
