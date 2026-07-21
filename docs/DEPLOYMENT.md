# Practest — cPanel Production Deployment Runbook

This runbook outlines the step-by-step procedure to deploy **e-Learning Practest** on a standard cPanel hosting environment with PHP 8.3 and MySQL 8.

---

## 1. Domain & Subdomain Layout

Configure the following subdomains in cPanel under **Domains**:

| Subdomain | Public Root Directory | Description |
|---|---|---|
| `practest.live` / `www.practest.live` | `public_html/` | Astro static public site (`web/dist` artifacts) |
| `app.practest.live` | `subdomains/app/` | React SPA (`app/dist` artifacts) |
| `api.practest.live` | `subdomains/api/public/` | Laravel API (`api/public/`) |

> ⚠️ **Directory Isolation Rule**: The Laravel backend folder (`api/`) must be uploaded **outside public_html** (e.g. at `/home/username/practest-api/`). Point `api.practest.live` document root directly to `/home/username/practest-api/public/`.

---

## 2. Environment Configuration & Secrets

1. Create a MySQL 8 database (e.g., `username_practest`) and a user with `ALL PRIVILEGES`.
2. Copy `api/.env.example` to `/home/username/practest-api/.env`.
3. Set production values in `.env`:
   - `APP_ENV=production`
   - `APP_DEBUG=false`
   - `APP_URL=https://api.practest.live`
   - `FRONTEND_URL=https://app.practest.live`
   - `SESSION_DOMAIN=.practest.live`
   - `SANCTUM_STATEFUL_DOMAINS=app.practest.live`
   - `CORS_ALLOWED_ORIGINS=https://app.practest.live,https://practest.live,https://www.practest.live`
   - `DB_CONNECTION=mysql`
   - `DB_HOST=127.0.0.1`
   - `DB_DATABASE=username_practest`
   - `DB_USERNAME=username_dbuser`
   - `DB_PASSWORD=secretpassword`
4. Generate `APP_KEY`:
   ```bash
   php artisan key:generate
   ```

---

## 3. Deployment Steps

### Backend (Laravel API)
1. SSH into cPanel or open cPanel Terminal.
2. Navigate to API directory:
   ```bash
   cd /home/username/practest-api
   ```
3. Run the deployment script:
   ```bash
   bash deploy/deploy-api.sh
   ```
4. Copy `deploy/.htaccess-api` to `api/public/.htaccess`.

### React SPA (`app.practest.live`)
1. On local dev machine, build SPA with production environment:
   ```bash
   cd app
   VITE_API_URL=https://api.practest.live npm run build
   ```
2. Upload contents of `app/dist/` to `subdomains/app/`.
3. Copy `deploy/.htaccess-app` to `subdomains/app/.htaccess`.

### Astro Static Site (`practest.live`)
1. On local dev machine, build Astro static site:
   ```bash
   cd web
   PUBLIC_API_URL=https://api.practest.live PUBLIC_SPA_URL=https://app.practest.live npm run build
   ```
2. Upload contents of `web/dist/` to `public_html/`.
3. Copy `deploy/.htaccess-web` to `public_html/.htaccess`.

> ⚠️ **Build Note**: Astro pages are statically pre-rendered at build time. When a new course is created or published by an Admin, trigger an Astro rebuild and redeploy to `public_html/`.

---

## 4. Cron Jobs Setup (cPanel)

Add the following **two cron entries** under cPanel **Cron Jobs**:

```cron
# 1. Laravel Scheduler (auto-submit expired test sessions every minute)
* * * * * cd /home/username/practest-api && php artisan schedule:run >> /dev/null 2>&1

# 2. Queue Worker (computes test analytics, score breakdown & percentiles)
* * * * * cd /home/username/practest-api && php artisan queue:work --stop-when-empty --max-time=55 >> /dev/null 2>&1
```

> ⚠️ **Queue Cron is Mandatory**: Test scoring analytics run via queued jobs (`ComputeTestAnalytics`). If cron #2 is not configured, student test results will remain uncalculated.

---

## 5. Cloudflare & SSL Configuration

1. In Cloudflare DNS: set A records for `practest.live`, `www`, `app`, `api` (Proxied 🟧).
2. Set SSL/TLS encryption mode to **Full (strict)**.
3. Page Rule / Cache Rule: Set **Bypass Cache** for `api.practest.live/*`.
4. Exempt `/api/webhooks/razorpay` from WAF bot challenges if Razorpay payments are turned ON.
