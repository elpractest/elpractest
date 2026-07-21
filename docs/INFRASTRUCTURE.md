# e-Learning Practest — Infrastructure & Deployment Reference

> Live production handoff. **Secrets are NOT stored in this file** — it points to where each
> one lives. Keep actual passwords in a password manager, never commit them.
> Companion docs: `CLAUDE.md` §17 (master plan), `docs/DEPLOYMENT.md`, `docs/ENV.md`.

---

## 1. What this project is

| Part | Tech | Lives at | Served from |
|---|---|---|---|
| Public site | Astro (static) | `web/` | `practest.live` + `www.` |
| Student/Admin app (SPA) | React + Vite | `app/` | `app.practest.live` |
| Backend API | Laravel 11 (PHP 8.3) | `api/` | `api.practest.live` |
| Database | MariaDB 10.6 | server | — |

Everything is ONE stateless API + two frontends that call it. The future Android app is a third client of the same API.

---

## 2. Live URLs

| URL | What |
|---|---|
| https://practest.live | Public landing site |
| https://app.practest.live | The app (login, dashboards, tests) |
| https://api.practest.live | API (JSON only) |
| https://api.practest.live/up | API health check (should return 200) |
| https://api.practest.live/api/settings/public | Public settings (quick "is API alive" check) |

---

## 3. Access points (log in to these — passwords in your password manager)

| Service | URL | Username | Password location |
|---|---|---|---|
| cPanel | https://sgp.centreserver.com:2083 | `thevins1` | your hosting welcome email / pw manager |
| cPanel Terminal | cPanel → search "Terminal" | (same session) | — |
| Cloudflare | https://dash.cloudflare.com | your CF email | pw manager |
| GitHub repo | https://github.com/elpractest/elpractest | your GitHub account | pw manager |
| Super-Admin (the app) | https://app.practest.live | `thevinstitution@gmail.com` | pw manager + TOTP 2FA (authenticator app) |

---

## 4. Server facts (cPanel account)

| Fact | Value |
|---|---|
| Host | `sgp.centreserver.com` (Singapore) |
| Server IP | `15.235.212.21` |
| cPanel user | `thevins1` |
| Home directory | `/home/thevins1` |
| PHP 8.3 CLI binary | `/opt/cpanel/ea-php83/root/usr/bin/php` |
| Composer | `~/composer.phar` (run as `php ~/composer.phar ...`) |
| Primary domain of account | `vinstitution.com` (practest.live is an **addon** domain) |

### Document roots (where each site's files live on the server)
| Host | Document root |
|---|---|
| `practest.live` / `www` | `/home/thevins1/practest.live` (Astro `dist`) |
| `app.practest.live` | `/home/thevins1/app.practest.live` (SPA `dist`) |
| `api.practest.live` | `/home/thevins1/practest-src/api/public` (Laravel public/) |

### Code + config on the server
- Full repo clone: `/home/thevins1/practest-src` (pulls from GitHub via deploy key)
- API environment file: `/home/thevins1/practest-src/api/.env` (**never in git**)
- GitHub deploy key (read-only): `~/.ssh/practest_deploy` (public half is added as a Deploy Key on the repo)
- Git is configured to use the deploy key automatically (`core.sshCommand` is set in `practest-src`)

---

## 5. Database

| Fact | Value |
|---|---|
| Engine | MariaDB 10.6 |
| DB name | `thevins1_practest` |
| DB user | `thevins1_practest` |
| DB password | in the server `.env` (`DB_PASSWORD`) / your pw manager |
| Access UI | cPanel → phpMyAdmin |

---

## 6. Cloudflare (DNS + SSL + CDN)

- Nameservers: Cloudflare (free plan)
- **Proxied (orange cloud):** `practest.live`, `www`, `app`, `api` → all A records to `15.235.212.21`
- **DNS-only (grey cloud) — required:** `mail`, `webmail`, `cpanel`, `whm`, `autoconfig`, `autodiscover`, `cpcalendars`, `cpcontacts`, `webdisk`, and the `MX` record. (Proxying these breaks cPanel/mail.)
- SSL: Cloudflare edge certificate secures the browser side. Set SSL/TLS mode to **Full** (or Full-strict with a Cloudflare Origin cert on the server).
- Cache: fine to cache the static site; **never cache `api.*`** (it's dynamic).

---

## 7. THE DEPLOY WORKFLOW ← read this carefully

There are **two different paths** depending on what you changed. This is the #1 thing to get right.

### A) You changed the BACKEND (anything in `api/`) → git-based
```bash
# On your LOCAL machine:
git add -A
git commit -m "describe change"
git push

# On the SERVER (cPanel → Terminal):
cd ~/practest-src
git pull                       # pulls your change (deploy key handles auth)
cd api
PHP83=/opt/cpanel/ea-php83/root/usr/bin/php
$PHP83 artisan migrate --force # ONLY if you added migrations
$PHP83 artisan config:cache && $PHP83 artisan route:cache && $PHP83 artisan view:cache
```
- **Caveat 1 — composer:** if you added/changed PHP packages (`composer.json`/`composer.lock`), do NOT run `composer install` on the server — it gets killed by the resource limit. Instead: build `vendor/` locally (`php ../tools/composer.phar install --no-dev --optimize-autoloader`), tar it, upload via File Manager, extract into `practest-src/api/vendor`.
- **Caveat 2 — git pull sometimes says "Terminated"** (resource limit). Just re-run it, or for a single file use the direct-edit fallback.
- **Always** re-run the three `*:cache` commands after pulling, or the cached config/routes stay stale.

### B) You changed a FRONTEND (`app/` SPA or `web/` Astro site) → build + upload
The server does NOT build the frontends (production is Node-free by design). You build locally and upload the `dist`.
```bash
# --- SPA (app.practest.live) ---
cd app
npm run build
cp ../deploy/.htaccess-app dist/.htaccess          # SPA history-mode routing (+ /.well-known exclusion)
cp public/favicon.svg dist/favicon.svg
tar -czf ~/Downloads/practest-app-dist.tar.gz -C dist .
# then: cPanel File Manager → app.practest.live → Upload that .tar.gz
# then in Terminal:
#   cd ~/app.practest.live && rm -rf assets index.html && tar xzf practest-app-dist.tar.gz && rm -f practest-app-dist.tar.gz

# --- Astro site (practest.live) ---
cd web
npm run build
cp ../deploy/.htaccess-web dist/.htaccess
tar -czf ~/Downloads/practest-web-dist.tar.gz -C dist .
# then: File Manager → practest.live → Upload → Terminal: cd ~/practest.live && tar xzf ... && rm -f ...
```
Frontend env values are baked in at BUILD time: `app/.env.production` (`VITE_API_URL`) and `web/.env.production` (`PUBLIC_API_URL`, `PUBLIC_SPA_URL`).

### Rule of thumb
- **Backend logic / API / DB** → push + `git pull` + cache = live.
- **Any pixel the user sees** → `npm run build` + upload `dist`.
- A **backend change reaches the website AND the future Android app for free** (both just call the API). A **UI change** must be rebuilt for each frontend.

---

## 8. Local development (this machine)

Repo: `C:\Users\thevi\Downloads\e-Learning_Practest`
```powershell
# API — http://localhost:8010 (port 8000 is taken by Docker here)
cd api; php artisan serve --port=8010
# SPA — http://localhost:3000 (proxies to 8010 via app/.env.local)
cd app; npm run dev
# Astro — http://localhost:4321
cd web; npm run dev
```
- Run backend tests: `cd api; php artisan test` (baseline: 101 passed)
- Local email + OTP land in `api/storage/logs/laravel.log`

---

## 9. Pending before "real students" launch

- [ ] **`noreply@practest.live` mailbox** (cPanel → Email Accounts) + set `MAIL_*` in server `.env` → signup verification emails work. **Blocks student self-signup.**
- [ ] **Two cron jobs** (cPanel → Cron Jobs), both every minute — **CRITICAL**:
  - `/opt/cpanel/ea-php83/root/usr/bin/php /home/thevins1/practest-src/api/artisan schedule:run` (auto-submit expired tests)
  - `/opt/cpanel/ea-php83/root/usr/bin/php /home/thevins1/practest-src/api/artisan queue:work --stop-when-empty --max-time=55` (**analytics is a queued job — without this, students never get test results**)
- [ ] **MSG91 + DLT template** for phone OTP (approval has lead time). Until then, activate students via admin-issued codes (phone verification is deferred).
- [ ] Add real content: courses, batches, question CSVs, one published mock per exam.
- [ ] Rotate the super-admin password (it passed through setup logs) + back up the 2FA secret.
- [ ] Confirm `www` DNS record exists and Cloudflare SSL is green on all four hosts.

---

## 10. Payments (currently OFF)

`payment_gateway_enabled = false` in settings → activation-code flow only. To enable online payment later: add Razorpay live keys to `.env`, flip the toggle in Super-Admin settings, and add the webhook `https://api.practest.live/api/webhooks/razorpay` (+ exempt it from any WAF challenge).
