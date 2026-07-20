#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Practest — Production Laravel API Deployment Script (cPanel SSH)
# -----------------------------------------------------------------------------
set -e

echo "🚀 Starting Practest API Deployment..."

# 1. Pull latest code (if using git repository deployment)
# git pull origin master

# 2. Install production Composer dependencies
echo "📦 Installing production PHP dependencies..."
composer install --no-dev --optimize-autoloader --no-interaction --prefer-dist

# 3. Run database migrations safely
echo "🗄️ Running database migrations..."
php artisan migrate --force

# 4. Cache production configuration and routes
echo "⚡ Caching Laravel configuration, routes, and views..."
php artisan config:cache
php artisan route:cache
php artisan view:cache

# 5. Ensure storage symlink exists
echo "🔗 Creating storage symlink if missing..."
php artisan storage:link || true

# 6. Restart queue worker to load fresh code
echo "🔄 Restarting queue worker..."
php artisan queue:restart

echo "✅ Practest API deployment finished successfully!"
