<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Stamps security headers on every API response, server-side and
 * deterministically — independent of whatever edge/proxy sits in front.
 *
 * The API only ever returns JSON (or redirects/files), never a rendered HTML
 * document, so a maximally-tight CSP is safe here: `default-src 'none'` +
 * `frame-ancestors 'none'` means even if a response were somehow interpreted
 * as a document it can load nothing and be framed nowhere.
 */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        $headers = [
            'X-Content-Type-Options' => 'nosniff',
            'X-Frame-Options' => 'DENY',
            'Referrer-Policy' => 'strict-origin-when-cross-origin',
            'Content-Security-Policy' => "default-src 'none'; frame-ancestors 'none'",
        ];

        foreach ($headers as $name => $value) {
            // Don't clobber a header an individual response deliberately set.
            if (! $response->headers->has($name)) {
                $response->headers->set($name, $value);
            }
        }

        return $response;
    }
}
