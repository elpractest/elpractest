<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * A student's own receipts. `show` returns a print-optimised HTML document
 * rather than a generated PDF: the browser's own "Save as PDF" produces the
 * same artefact, and it keeps a PDF engine (and the Docker rebuild that comes
 * with it) out of the image for something rendered a few times per enrolment.
 */
class InvoiceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $invoices = Invoice::where('user_id', $request->user()->id)
            ->latest('issued_at')
            ->get()
            ->map(fn (Invoice $i) => [
                'id' => $i->id,
                'invoice_number' => $i->invoice_number,
                'issued_at' => $i->issued_at,
                'description' => $i->description,
                'total' => $i->rupees('total_paise'),
                'is_tax_invoice' => $i->is_tax_invoice,
            ]);

        return response()->json(['invoices' => $invoices]);
    }

    public function show(Request $request, Invoice $invoice)
    {
        if ($invoice->user_id !== $request->user()->id) {
            abort(403);
        }

        // This is the API's only HTML document, so it is also the only response
        // that needs to run its own styles. The app-wide policy is
        // `default-src 'none'` (right for a JSON API, and it silently blocks an
        // inline <style>), and SecurityHeaders only fills the header in when it
        // is absent — so set a scoped policy here rather than loosening that
        // one. A per-request nonce keeps this stricter than 'unsafe-inline'.
        $nonce = base64_encode(random_bytes(16));

        return response()
            ->view('invoices.show', ['invoice' => $invoice, 'nonce' => $nonce])
            ->header('Content-Type', 'text/html; charset=utf-8')
            ->header(
                'Content-Security-Policy',
                "default-src 'none'; style-src 'nonce-{$nonce}'; script-src 'nonce-{$nonce}'; frame-ancestors 'none'"
            );
    }
}
