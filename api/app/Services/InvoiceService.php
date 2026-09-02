<?php

namespace App\Services;

use App\Models\Invoice;
use App\Models\Payment;
use App\Models\Setting;
use Illuminate\Support\Facades\DB;

/**
 * Issues one invoice per captured payment.
 *
 * Two things here are legal requirements rather than preferences:
 *
 *  1. NUMBERING is sequential and gap-free within an Indian financial year
 *     (Apr-Mar). The next sequence is read under a row lock inside the same
 *     transaction that writes the invoice, and the table carries a unique
 *     index on (financial_year, sequence) as the final backstop — so two
 *     payments captured in the same instant cannot share a number.
 *
 *  2. Only a GST-REGISTERED seller may issue a document titled "Tax Invoice".
 *     With no GSTIN configured this issues a plain payment receipt with no tax
 *     lines, which is the correct document for the many coaching institutes
 *     that are below the registration threshold.
 *
 * GST is treated as INCLUSIVE in the charged amount, matching Indian retail
 * convention (the listed price is what the student actually pays), so the
 * taxable value is back-calculated rather than added on top.
 *
 * Place of supply is assumed intra-state (CGST + SGST). The platform holds no
 * buyer state, and a coaching institute's students are overwhelmingly in its
 * own state; an inter-state (IGST) split would need a buyer state on file, so
 * the column exists but is left at zero rather than being guessed.
 */
class InvoiceService
{
    /**
     * Issue the invoice for a paid payment, or return the existing one.
     * Safe to call more than once — the payment_id unique index and the
     * pre-check make this idempotent, which matters because both the
     * client verify call and the Razorpay webhook reach it.
     */
    public function issueFor(Payment $payment): ?Invoice
    {
        if ($payment->status !== 'paid') {
            return null;
        }

        // A fully-discounted (₹0) enrolment gets no invoice: burning a
        // sequential number on a zero-value record just makes the GST return
        // harder to read, and there is no consideration to document.
        if ((int) $payment->amount <= 0) {
            return null;
        }

        if ($existing = Invoice::where('payment_id', $payment->id)->first()) {
            return $existing;
        }

        $settings = $this->settings();
        $gstin = trim((string) ($settings['invoice_gstin'] ?? ''));
        $isTaxInvoice = $gstin !== '';

        $total = (int) $payment->amount;
        $rate = $isTaxInvoice ? (float) ($settings['invoice_gst_rate'] ?? 0) : 0.0;

        // Inclusive-of-tax back-calculation.
        $taxable = $rate > 0 ? (int) round($total * 100 / (100 + $rate)) : $total;
        $tax = $total - $taxable;
        // Split evenly; any odd paise goes to CGST so the two halves still sum
        // to the exact tax charged.
        $sgst = intdiv($tax, 2);
        $cgst = $tax - $sgst;

        $payment->loadMissing(['user', 'course', 'batch']);

        $description = trim(sprintf(
            '%s%s',
            $payment->course?->title ?? 'Course enrolment',
            $payment->batch?->name ? ' — ' . $payment->batch->name : ''
        ));

        // The unique (financial_year, sequence) index is the real guarantee; on
        // the rare occasion two captures land in the same instant and both read
        // the same maximum, the loser retries with the next number instead of
        // surfacing a failure.
        for ($attempt = 1; ; $attempt++) {
            try {
                return $this->createNumbered($payment, $settings, $gstin, $isTaxInvoice, $total, $taxable, $rate, $cgst, $sgst, $description);
            } catch (\Illuminate\Database\UniqueConstraintViolationException $e) {
                if ($attempt >= 3) {
                    throw $e;
                }
            }
        }
    }

    /** One numbered-invoice write attempt. */
    private function createNumbered(Payment $payment, array $settings, string $gstin, bool $isTaxInvoice, int $total, int $taxable, float $rate, int $cgst, int $sgst, string $description): Invoice
    {
        return DB::transaction(function () use ($payment, $settings, $gstin, $isTaxInvoice, $total, $taxable, $rate, $cgst, $sgst, $description) {
            $financialYear = $this->financialYear();
            $sequence = $this->nextSequence($financialYear);

            $prefix = trim((string) ($settings['invoice_number_prefix'] ?? 'INV')) ?: 'INV';

            return Invoice::create([
                'payment_id' => $payment->id,
                'user_id' => $payment->user_id,
                'invoice_number' => sprintf('%s/%s/%04d', $prefix, $financialYear, $sequence),
                'financial_year' => $financialYear,
                'sequence' => $sequence,
                'issued_at' => now(),

                'seller_name' => trim((string) ($settings['invoice_seller_name'] ?? ''))
                    ?: (string) ($settings['site_name'] ?? 'Practest'),
                'seller_address' => $settings['invoice_seller_address'] ?? null,
                'seller_gstin' => $gstin ?: null,
                'seller_state' => $settings['invoice_seller_state'] ?? null,
                'sac_code' => $isTaxInvoice ? ($settings['invoice_sac_code'] ?? null) : null,

                'buyer_name' => $payment->user?->name ?? 'Student',
                'buyer_email' => $payment->user?->email,

                'description' => $description !== '' ? $description : 'Course enrolment',

                'total_paise' => $total,
                'taxable_paise' => $taxable,
                'gst_rate' => $rate,
                'cgst_paise' => $cgst,
                'sgst_paise' => $sgst,
                'igst_paise' => 0,
                'is_tax_invoice' => $isTaxInvoice,
            ]);
        });
    }

    /** Indian financial year for today, e.g. "2026-27" for 2026-04-01..2027-03-31. */
    public function financialYear(?\DateTimeInterface $at = null): string
    {
        $date = $at ? \Illuminate\Support\Carbon::parse($at) : now();
        $startYear = $date->month >= 4 ? $date->year : $date->year - 1;

        return sprintf('%d-%02d', $startYear, ($startYear + 1) % 100);
    }

    /**
     * Next sequence in the year, read under a lock so concurrent captures
     * cannot both read the same maximum.
     */
    private function nextSequence(string $financialYear): int
    {
        $max = Invoice::where('financial_year', $financialYear)
            ->lockForUpdate()
            ->max('sequence');

        return ((int) $max) + 1;
    }

    /** @return array<string, string> */
    private function settings(): array
    {
        return Setting::whereIn('key', [
            'invoice_seller_name',
            'invoice_seller_address',
            'invoice_gstin',
            'invoice_seller_state',
            'invoice_sac_code',
            'invoice_gst_rate',
            'invoice_number_prefix',
            'site_name',
        ])->pluck('value', 'key')->all();
    }
}
