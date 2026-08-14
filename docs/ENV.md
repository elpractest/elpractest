# Practest — Environment Variables & Secrets Reference

This document provides a comprehensive reference of all environment variables across the three components of **e-Learning Practest**: Laravel API (`api/`), React SPA (`app/`), and Astro Static Site (`web/`).

---

## 1. Laravel API (`api/.env`)

| Variable | Description | Dev Default | Production Example | Issuing Authority / Notes |
|---|---|---|---|---|
| `APP_NAME` | Display name of app | `"Practest"` | `"Practest"` | Super-Admin / Operator |
| `APP_ENV` | Environment name | `local` | `production` | Framework |
| `APP_KEY` | 32-char encryption key | Auto-generated | `base64:...` | `php artisan key:generate` |
| `APP_DEBUG` | Verbose debug mode | `true` | `false` | Framework (Must be `false` in prod) |
| `APP_URL` | API root base URL | `http://localhost:8000` | `https://api.practest.live` | Infrastructure |
| `FRONTEND_URL` | React SPA base URL | `http://localhost:3000` | `https://app.practest.live` | Infrastructure |
| `DB_CONNECTION` | Database driver | `sqlite` | `mysql` | Local SQLite / MariaDB 10.6 |
| `DB_HOST` | Database host | `127.0.0.1` | `mariadb` | Compose service name (internal Docker network) |
| `DB_DATABASE` | Database name | `database.sqlite` | `practest` | Must match `mariadb` service env |
| `DB_USERNAME` | Database user | `null` | `practest` | Must match `mariadb` service env |
| `DB_PASSWORD` | Database password | `null` | `StrongPassword123` | Set in Coolify env |
| `DB_ROOT_PASSWORD` | MariaDB root password | — | `StrongRootPassword123` | Coolify env (used by the `mariadb` service only) |
| `SESSION_DOMAIN` | Cookie domain | `.practest.live` | `.practest.live` | Preceded with `.` for root & subdomains |
| `SANCTUM_STATEFUL_DOMAINS` | SPA domains allowed stateful cookies | `app.practest.live,localhost:3000` | `app.practest.live` | Sanctum CSRF protection |
| `CORS_ALLOWED_ORIGINS` | Allowed CORS origins | `http://localhost:3000` | `https://app.practest.live,https://practest.live,https://www.practest.live` | Required for Astro contact form & public course fetch |
| `MAIL_MAILER` | Mail driver | `log` | `smtp` | `log` until a real provider is set (SES / Brevo / SMTP) |
| `MAIL_SCHEME` | Transport encryption scheme | `null` | `smtps` | `smtps` for SSL port 465 (provider-dependent) |
| `MAIL_HOST` | SMTP server host | `127.0.0.1` | `smtp.provider.com` | Transactional email provider |
| `MAIL_PORT` | SMTP server port | `2525` | `465` | Provider SSL port |
| `MAIL_USERNAME` | SMTP account user | `null` | `noreply@practest.live` | Provider mailbox / API user |
| `MAIL_PASSWORD` | SMTP account pass | `null` | `(provider_password)` | Set in Coolify env |
| `MAIL_FROM_ADDRESS` | Sender email address | `"noreply@practest.live"` | `"noreply@practest.live"` | Domain MX/SPF/DKIM verified |
| `GOOGLE_CLIENT_ID` | OAuth Client ID | `""` | `xyz.apps.googleusercontent.com` | Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | OAuth Secret | `""` | `GOCSPX-secret` | Google Cloud Console |
| `GOOGLE_REDIRECT_URI` | OAuth Redirect | `${APP_URL}/api/auth/google/callback` | `https://api.practest.live/api/auth/google/callback` | Google Cloud Console |
| `FACEBOOK_CLIENT_ID` | OAuth App ID | `""` | `123456789` | Meta for Developers |
| `FACEBOOK_CLIENT_SECRET` | OAuth App Secret | `""` | `fb-secret-key` | Meta for Developers |
| `FACEBOOK_REDIRECT_URI` | OAuth Redirect | `${APP_URL}/api/auth/facebook/callback` | `https://api.practest.live/api/auth/facebook/callback` | Meta for Developers |
| `MSG91_AUTH_KEY` | MSG91 API key | `""` | `msg91-auth-key` | MSG91 Portal (India SMS) |
| `MSG91_TEMPLATE_ID` | DLT approved template ID | `""` | `65a123...` | DLT Registration / MSG91 |
| `MSG91_SENDER_ID` | 6-char header | `PRACTEST` | `PRCTST` | DLT Approved Header |
| `RECAPTCHA_SECRET_KEY` | reCAPTCHA v3 Secret | `""` | `6Ld...secret` | Google reCAPTCHA Admin Console |
| `RECAPTCHA_SITE_KEY` | reCAPTCHA v3 Site Key | `""` | `6Ld...sitekey` | Google reCAPTCHA Admin Console |
| `RAZORPAY_KEY_ID` | Razorpay Key ID | `""` | `rzp_live_...` | Razorpay Dashboard |
| `RAZORPAY_KEY_SECRET` | Razorpay Key Secret | `""` | `secret` | Razorpay Dashboard |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook signature secret | `""` | `whsec_...` | Razorpay Webhooks |
| `SUPER_ADMIN_NAME` | Initial Super-Admin Name | `"Super Admin"` | `"Super Admin"` | Seeder (`SuperAdminSeeder`) |
| `SUPER_ADMIN_EMAIL` | Initial Super-Admin Email | `"thevinstitution@gmail.com"` | `"thevinstitution@gmail.com"` | Permanent Super-Admin lock |
| `SUPER_ADMIN_PASSWORD` | Initial Super-Admin Pass | `"Password123."` | `"GeneratedSecurePass!"` | Seeder |

---

## 2. React SPA (`app/.env.example`)

| Variable | Description | Dev Value | Production Example | Notes |
|---|---|---|---|---|
| `VITE_API_URL` | Base API URL | `""` (uses Vite proxy) | `https://api.practest.live` | Leave empty in dev if using Vite proxy |
| `VITE_RECAPTCHA_SITE_KEY` | Google reCAPTCHA v3 Public Site Key | `""` | `6Ld...sitekey` | Loaded dynamically in Register page |

---

## 3. Astro Static Site (`web/.env.example`)

| Variable | Description | Dev Value | Production Example | Notes |
|---|---|---|---|---|
| `PUBLIC_API_URL` | Base API URL for course/contact fetches | `http://localhost:8000` | `https://api.practest.live` | Read at build time for course SSG |
| `PUBLIC_SPA_URL` | Student App base URL for CTA links | `http://localhost:3000` | `https://app.practest.live` | Link destination for "Login" & "Register" |
| `PUBLIC_GTM_ID` | Google Tag Manager Container ID | `""` | `GTM-XXXXXXX` | Optional static override |
