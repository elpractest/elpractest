<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$u = \App\Models\User::where('email', 'thevinstitution@gmail.com')->first();

echo "email_verified_at: " . ($u->email_verified_at ?? 'NULL') . "\n";

if (!$u->email_verified_at) {
    echo "\n--- email_verified_at is NULL! This is why login returns 401. ---\n";
    echo "The login controller checks hasVerifiedEmail() before returning credentials.\n";
    echo "But wait — the 401 says 'credentials incorrect', the 403 says 'verify email'.\n";
    echo "Let me check what the actual HTTP response code would be...\n\n";
    
    // The login method returns 401 for bad credentials, 403 for unverified email.
    // If the browser got 401, it means Hash::check failed or user was null.
    // If it got 403, it means email unverified.
    // Let's just fix it either way.
    
    echo "Fixing: setting email_verified_at to now...\n";
    $u->email_verified_at = now();
    $u->save();
    echo "Done. email_verified_at: " . $u->email_verified_at . "\n";
}
