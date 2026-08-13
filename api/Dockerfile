# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# Practest API — Laravel 12 / PHP 8.3, built for the Coolify (Docker) host.
#
# Build context is the REPO ROOT, so a single docker-compose context can build
# every service. All application paths below are therefore prefixed with api/.
#
# This image replaces the cPanel deploy model entirely: composer runs HERE, in
# the build, not on the server (CloudLinux used to kill it). vendor/ is baked in.
#
# Base: serversideup/php — Laravel-tuned, s6-managed nginx+php-fpm, with an
# AUTORUN_* contract that runs migrate / optimize / storage:link at boot.
# ─────────────────────────────────────────────────────────────────────────────

########## Stage 1: composer deps + optimized autoloader ######################
FROM serversideup/php:8.3-cli AS vendor
USER root
ENV COMPOSER_ALLOW_SUPERUSER=1
# zip + pdo_mysql ship in the base; these are the ones the app needs on top:
#   gd    → banner/thumbnail image handling, bacon-qr-code (2FA QR)
#   intl  → localization (i18n app is bilingual)
#   bcmath/gmp → pragmarx/google2fa performance
#   exif  → correct image orientation on uploads
RUN install-php-extensions gd intl bcmath gmp exif
WORKDIR /var/www/html

# Manifests first, so the (slow) dependency layer caches independently of code.
COPY api/composer.json api/composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction

# Then the app; finalize the classmap + Laravel package manifest.
COPY api/ ./
# Clear any stale bootstrap cache defensively (a dev-built packages.php lists
# Laravel\Pail, a --no-dev package, and would break package:discover).
RUN rm -f bootstrap/cache/*.php \
 && cp .env.example .env \
 && composer dump-autoload --optimize --no-dev --no-interaction \
 && php artisan package:discover --ansi \
 && rm -f .env

########## Stage 2: web runtime (nginx + php-fpm) #############################
FROM serversideup/php:8.3-fpm-nginx AS web
USER root
RUN install-php-extensions gd intl bcmath gmp exif
COPY --from=vendor --chown=www-data:www-data /var/www/html /var/www/html
USER www-data
# Boot-time Laravel prep (serversideup AUTORUN contract). OPTIMIZE caches
# config+routes+views. Migration isolation is deliberately OFF: it acquires a
# lock in the `cache_locks` table (CACHE_STORE=database), which does not exist
# on a fresh DB until migrations create it — a chicken-and-egg that fails the
# first boot. There is a single api replica, so isolation buys nothing here.
# Seeding is intentionally NOT autorun — the super-admin seed is a one-off after
# the first deploy (see docs), so it never re-runs on every container restart.
ENV AUTORUN_ENABLED=true \
    AUTORUN_LARAVEL_MIGRATION=true \
    AUTORUN_LARAVEL_STORAGE_LINK=true \
    AUTORUN_LARAVEL_OPTIMIZE=true \
    PHP_OPCACHE_ENABLE=1
# The base image already EXPOSEs 8080 (http) and defines a container healthcheck.

########## Stage: test (dev deps, CI-parity local test runs; not deployed) ###
# Layers phpunit + dev deps back onto the cached vendor stage so the suite can
# run in the exact PHP 8.3 + extensions the production image ships.
FROM vendor AS test
ENV COMPOSER_ALLOW_SUPERUSER=1
RUN composer install --no-interaction --prefer-dist
CMD ["php", "artisan", "test"]

########## Stage 3: queue worker (cli) #######################################
FROM serversideup/php:8.3-cli AS worker
USER root
RUN install-php-extensions gd intl bcmath gmp exif
COPY --from=vendor --chown=www-data:www-data /var/www/html /var/www/html
USER www-data
WORKDIR /var/www/html
# The worker never migrates or caches — the web service owns that.
ENV AUTORUN_ENABLED=false \
    PHP_OPCACHE_ENABLE=1
CMD ["php", "artisan", "queue:work", "--tries=3", "--max-time=3600", "--sleep=3", "--rest=1"]
