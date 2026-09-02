<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Adds the one security header the API edge does NOT already provide: a
 * Content-Security-Policy.
 *
 * The serversideup base-image nginx in front of the API already emits
 * X-Content-Type-Options, X-Frame-Options (SAMEORIGIN) and Referrer-Policy on
 * every response — and it appends them *after* Laravel returns, so setting the
 * same names here just produces duplicate/conflicting headers rather than
 * overriding them. So this middleware owns only the CSP.
 *
 * The API returns JSON (or redirects/files) almost everywhere, so a
 * maximally-tight CSP is safe: `default-src 'none'` + `frame-ancestors 'none'`
 * means even if a response were somehow interpreted as a document it can load
 * nothing and be framed nowhere. frame-ancestors is the authoritative
 * anti-framing control regardless of the nginx SAMEORIGIN.
 *
 * The one exception is the printable invoice (Student\InvoiceController::show),
 * which is a real HTML document and needs its own styles. It sets its own,
 * still-strict nonce-based policy — hence the `has()` check below, which lets a
 * route opt out deliberately instead of this loosening the default for everyone.
 */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if (! $response->headers->has('Content-Security-Policy')) {
            $response->headers->set(
                'Content-Security-Policy',
                "default-src 'none'; frame-ancestors 'none'"
            );
        }

        return $response;
    }
}
