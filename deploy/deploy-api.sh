#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Practest — Production Laravel API deploy (run ON the server, via cPanel Terminal)
#
# Manual equivalent of the "Deploy API" step in .github/workflows/ci.yml.
# Both follow docs/INFRASTRUCTURE.md §7.
#
#   bash ~/practest-src/deploy/deploy-api.sh
#
# Two things this script deliberately does NOT do, because they break on this
# host (see docs/SESSION-HANDOVER.md §4):
#
#   * `composer install` — CloudLinux kills it ("Terminated"). vendor/ is built
#     locally and uploaded by hand. This script aborts if composer.lock changed
#     rather than deploying new code against a stale vendor/.
#   * overwrite api/public/.htaccess — that file is tracked in git and is NOT
#     the same as deploy/.htaccess-api; it carries the X-XSRF-Token passthrough
#     that cross-origin login depends on. It arrives with the pull.
# -----------------------------------------------------------------------------
set -euo pipefail

PHP83=/opt/cpanel/ea-php83/root/usr/bin/php
SRC="$HOME/practest-src"

echo "🚀 Practest API deploy"

# --- 0. Preflight: fail before touching anything -----------------------------
[ -x "$PHP83" ]           || { echo "❌ PHP 8.3 not found at $PHP83"; exit 1; }
[ -f "$SRC/api/artisan" ] || { echo "❌ $SRC/api/artisan missing — wrong path or wrong server"; exit 1; }
[ -f "$SRC/api/.env" ]    || { echo "❌ $SRC/api/.env missing — the server env file is not in git"; exit 1; }

cd "$SRC"

# --- 1. Fetch (the resource cap kills git at random — retry) -----------------
echo "📥 Fetching..."
ok=0
for i in 1 2 3; do
  if git fetch origin main; then ok=1; break; fi
  echo "   git fetch failed (attempt $i) — retrying in 10s"; sleep 10
done
[ "$ok" = "1" ] || { echo "❌ git fetch failed 3x"; exit 1; }

# --- 2. Refuse to deploy against a stale vendor/ -----------------------------
OLD_LOCK=$(git rev-parse HEAD:api/composer.lock)
NEW_LOCK=$(git rev-parse origin/main:api/composer.lock)
if [ "$OLD_LOCK" != "$NEW_LOCK" ]; then
  cat <<'MSG'
❌ composer.lock changed — vendor/ must be rebuilt, and it CANNOT be built here.

   On your LOCAL machine:
     cd api
     php ../tools/composer.phar install --no-dev --optimize-autoloader
     tar -czf vendor.tar.gz vendor

   Upload vendor.tar.gz via cPanel File Manager into practest-src/api/,
   extract it there, then re-run this script.
MSG
  exit 1
fi

echo "🔖 Rollback point (current HEAD): $(git rev-parse --short HEAD)"

# --- 3. Pull -----------------------------------------------------------------
echo "⬇️  Pulling..."
ok=0
for i in 1 2 3; do
  if git pull --ff-only origin main; then ok=1; break; fi
  echo "   git pull failed (attempt $i) — retrying in 10s"; sleep 10
done
[ "$ok" = "1" ] || { echo "❌ git pull failed 3x"; exit 1; }
echo "   now at: $(git rev-parse --short HEAD)"

# --- 4. Migrate + re-cache ---------------------------------------------------
# artisan lives in api/, NOT in practest-src/
cd "$SRC/api"

echo "🗄️  Migrating..."
$PHP83 artisan migrate --force

# All three, always. Skipping route:cache is why new routes 404 in production.
echo "⚡ Re-caching config, routes, views..."
$PHP83 artisan config:cache
$PHP83 artisan route:cache
$PHP83 artisan view:cache

echo "🔄 Restarting queue worker..."
$PHP83 artisan queue:restart

# --- 5. Prove it's live ------------------------------------------------------
echo "🔍 Smoke test..."
curl -fsS -o /dev/null -w "   /api/settings/public -> %{http_code}\n" https://api.practest.live/api/settings/public
code=$(curl -s -o /dev/null -w '%{http_code}' -H 'Accept: application/json' https://api.practest.live/api/admin/test-series)
echo "   /api/admin/test-series -> $code (expect 401)"
[ "$code" = "401" ] || { echo "❌ expected 401 — the route cache may be stale"; exit 1; }

echo "✅ API deploy finished."
echo
echo "Reminder: frontend changes are NOT deployed by this script."
echo "See docs/INFRASTRUCTURE.md §7B, or let the CI workflow do it."
