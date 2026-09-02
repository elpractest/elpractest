@php
    /** @var \App\Models\Invoice $invoice */
    $title = $invoice->is_tax_invoice ? 'Tax Invoice' : 'Payment Receipt';
@endphp
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{{ $title }} {{ $invoice->invoice_number }}</title>
<style nonce="{{ $nonce }}">
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
        margin: 0; padding: 32px 20px; background: #f4f5f7; color: #1b2130;
        font: 14px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .sheet {
        max-width: 760px; margin: 0 auto; background: #fff; padding: 40px;
        border: 1px solid #dfe3ea; border-radius: 8px;
    }
    .top { display: flex; justify-content: space-between; gap: 24px; flex-wrap: wrap; align-items: flex-start; }
    h1 { margin: 0 0 4px; font-size: 20px; letter-spacing: .02em; text-transform: uppercase; }
    .muted { color: #63708a; }
    .seller-name { font-size: 16px; font-weight: 700; margin-bottom: 4px; }
    .meta { text-align: right; font-size: 13px; }
    .meta b { display: inline-block; min-width: 96px; text-align: left; }
    .parties { display: flex; gap: 32px; flex-wrap: wrap; margin: 28px 0 20px; }
    .parties > div { flex: 1 1 220px; }
    .label { font-size: 11px; letter-spacing: .09em; text-transform: uppercase; color: #63708a; margin-bottom: 6px; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13.5px; }
    th, td { padding: 10px 12px; border-bottom: 1px solid #e6e9f0; text-align: left; }
    th { background: #f7f8fa; font-size: 11px; letter-spacing: .07em; text-transform: uppercase; color: #63708a; }
    td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
    tr.total td { font-weight: 700; font-size: 15px; border-top: 2px solid #1b2130; border-bottom: none; }
    .foot { margin-top: 28px; padding-top: 16px; border-top: 1px solid #e6e9f0; font-size: 12px; color: #63708a; }
    .actions { max-width: 760px; margin: 0 auto 16px; text-align: right; }
    button {
        font: 600 13px inherit; padding: 9px 18px; border-radius: 6px; cursor: pointer;
        background: #1b2130; color: #fff; border: none;
    }
    @media print {
        body { background: #fff; padding: 0; }
        .sheet { border: none; border-radius: 0; padding: 0; max-width: none; }
        .actions { display: none; }
    }
</style>
</head>
<body>
{{-- The click handler is bound from a nonce'd script rather than an inline
     onclick, which the page's Content-Security-Policy also blocks. --}}
<div class="actions"><button type="button" id="print-invoice">Print / Save as PDF</button></div>

<div class="sheet">
    <div class="top">
        <div>
            <div class="seller-name">{{ $invoice->seller_name }}</div>
            @if ($invoice->seller_address)
                <div class="muted">{!! nl2br(e($invoice->seller_address)) !!}</div>
            @endif
            @if ($invoice->seller_gstin)
                <div class="muted">GSTIN: {{ $invoice->seller_gstin }}</div>
            @endif
            @if ($invoice->seller_state)
                <div class="muted">State: {{ $invoice->seller_state }}</div>
            @endif
        </div>
        <div class="meta">
            <h1>{{ $title }}</h1>
            <div><b>Number</b> {{ $invoice->invoice_number }}</div>
            <div><b>Date</b> {{ $invoice->issued_at->format('d M Y') }}</div>
            @if ($invoice->sac_code)
                <div><b>SAC</b> {{ $invoice->sac_code }}</div>
            @endif
        </div>
    </div>

    <div class="parties">
        <div>
            <div class="label">Billed to</div>
            <div><strong>{{ $invoice->buyer_name }}</strong></div>
            @if ($invoice->buyer_email)
                <div class="muted">{{ $invoice->buyer_email }}</div>
            @endif
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th>Description</th>
                <th class="num">Amount (₹)</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>{{ $invoice->description }}</td>
                <td class="num">{{ $invoice->rupees('taxable_paise') }}</td>
            </tr>

            @if ($invoice->is_tax_invoice && $invoice->gst_rate > 0)
                <tr>
                    <td class="muted">CGST @ {{ rtrim(rtrim(number_format($invoice->gst_rate / 2, 2), '0'), '.') }}%</td>
                    <td class="num">{{ $invoice->rupees('cgst_paise') }}</td>
                </tr>
                <tr>
                    <td class="muted">SGST @ {{ rtrim(rtrim(number_format($invoice->gst_rate / 2, 2), '0'), '.') }}%</td>
                    <td class="num">{{ $invoice->rupees('sgst_paise') }}</td>
                </tr>
            @endif

            <tr class="total">
                <td>Total paid</td>
                <td class="num">₹{{ $invoice->rupees('total_paise') }}</td>
            </tr>
        </tbody>
    </table>

    <div class="foot">
        @if ($invoice->is_tax_invoice)
            Amounts are inclusive of GST at {{ rtrim(rtrim(number_format($invoice->gst_rate, 2), '0'), '.') }}%.
        @else
            This is a payment receipt, not a tax invoice.
        @endif
        Paid online — no signature required.
    </div>
</div>

<script nonce="{{ $nonce }}">
    document.getElementById('print-invoice').addEventListener('click', function () {
        window.print();
    });
</script>
</body>
</html>
