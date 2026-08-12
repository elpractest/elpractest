# CI/CD Setup — e-Learning Practest

How `.github/workflows/ci.yml` deploys to the live cPanel server.

> **Server facts live in `docs/INFRASTRUCTURE.md`. This file must never contradict it.**
> Everything below was verified against the running server's actual layout — the
> paths here are the real ones, not a greenfield proposal.

---

## Architecture

```
GitHub
  │
  ├── push to any branch / PR ──► CI: Laravel tests (MariaDB 10.6) + SPA build + Astro build
  │
  └── push to main ────────────► Deploy to production
                                   api.practest.live | app.practest.live | practest.live
```

There is **no staging environment**. The server has no staging subdomains, docroots,
or database, so the workflow has no staging deploy job. Pushes to `develop` run
tests and builds only. If staging is ever provisioned, add the subdomains and a
second DB first, then copy the production job and change the paths.

---

## The server layout the pipeline targets

| Path | What |
|---|---|
| `~/practest-src` | git clone; backend deploys are a `git pull` here |
| `~/practest-src/api/.env` | server-only env file — **never in git** |
| `~/practest-src/api/public` | docroot for `api.practest.live` |
| `~/app.practest.live` | docroot for `app.practest.live` (SPA `dist`) |
| `~/practest.live` | docroot for `practest.live` + `www` (Astro `dist`) |
| `~/public_html` | docroot of the **primary** domain `vinstitution.com` — **never touched** |

`practest.live` is an **addon** domain on this cPanel account. Anything that writes
to `~/public_html` is hitting the wrong website.

---

## Deploy model

**Backend** (`api/`) → `git pull` on the server + `artisan` re-cache. The server
pulls from GitHub using its own read-only deploy key (`~/.ssh/practest_deploy`);
CI only issues the commands over SSH.

**Frontends** (`app/`, `web/`) → built by GitHub Actions, shipped as a `.tar.gz`,
extracted into the docroot with `rsync --delete`. Production stays Node-free.

**Composer never runs on the server.** CloudLinux kills it ("Terminated"). `vendor/`
is built locally and uploaded by hand. The workflow compares the `composer.lock`
blob between `HEAD` and `origin/main` *before pulling* and aborts the whole deploy
if it changed, so new code never runs against a stale `vendor/`.

When `composer.lock` changes:

```bash
cd api && php ../tools/composer.phar install --no-dev --optimize-autoloader && tar -czf vendor.tar.gz vendor
```

Upload `vendor.tar.gz` via cPanel File Manager into `practest-src/api/`, extract,
then re-run the workflow.

---

## Required GitHub secrets

### cPanel connection
| Secret | Value |
|---|---|
| `CPANEL_HOST` | `15.235.212.21` (or `sgp.centreserver.com`) |
| `CPANEL_USER` | `thevins1` |
| `CPANEL_SSH_KEY` | private half of a key authorized in cPanel → SSH Access |
| `CPANEL_PORT` | SSH port for this host |

> This is a **different key** from `~/.ssh/practest_deploy` on the server. That one
> is server → GitHub (read-only, pulls the repo). This one is GitHub → server.

### Frontend build-time values (optional; builds succeed without them)
| Secret | Used by |
|---|---|
| `VITE_RECAPTCHA_SITE_KEY` | React SPA |
| `VITE_GTM_ID` | React SPA |
| `PUBLIC_GTM_ID` | Astro site |

API URLs are **not** secrets — they're hardcoded in the workflow
(`https://api.practest.live`, `https://app.practest.live`).

Everything else the API needs (DB password, mail, MSG91, Razorpay, reCAPTCHA
secret, super-admin password) lives in `~/practest-src/api/.env` **on the server**
and is never sent through CI.

### GitHub Environment
Create an Environment named `production` (Settings → Environments). The deploy job
targets it, so you can require a manual approval before any deploy runs.

**Merging to `main` deploys to production automatically.** Add a required reviewer
if you don't want that.

---

## One-time server setup

Already done during Phase F — listed here for a rebuild or a new client deployment.

1. **SSH key for CI**
   ```bash
   ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/practest-ci
   ```
   Public half → cPanel → SSH Access → Manage SSH Keys → Import + **Authorize**.
   Private half → `CPANEL_SSH_KEY` secret.

2. **Subdomains + docroots** — per the table above. The Laravel app directory sits
   outside every docroot; only `api/public` is served.

3. **PHP 8.3** — cPanel → MultiPHP Manager for `api.practest.live`.
   CLI binary is `/opt/cpanel/ea-php83/root/usr/bin/php`; bare `php` may be an older version.

4. **Database** — MariaDB 10.6, `thevins1_practest` / user `thevins1_practest`.
   Credentials live in the server `.env`.

5. **Cron jobs — both required, every minute:**
   ```cron
   * * * * * /opt/cpanel/ea-php83/root/usr/bin/php /home/thevins1/practest-src/api/artisan schedule:run >> /dev/null 2>&1
   * * * * * /opt/cpanel/ea-php83/root/usr/bin/php /home/thevins1/practest-src/api/artisan queue:work --stop-when-empty --max-time=55 >> /dev/null 2>&1
   ```
   The second one is **not optional**: analytics is a queued job. Without it,
   students submit a test and never receive results, silently.

6. **Cloudflare DNS**

   | Type | Name | Content | Proxy |
   |---|---|---|---|
   | A | `@`, `www`, `app`, `api` | `15.235.212.21` | 🟧 Proxied |
   | — | `mail`, `webmail`, `cpanel`, `whm`, `autoconfig`, `autodiscover`, `cpcalendars`, `cpcontacts`, `webdisk`, `MX` | — | ⬜ DNS-only |

   Proxying the second row breaks cPanel and email. SSL/TLS **Full**; bypass cache
   on `api.practest.live/*`; exempt `/api/webhooks/razorpay` from WAF challenges.

---

## What the workflow does, step by step

1. **Preflight** (SSH, read-only) — verifies all four paths, the PHP 8.3 binary,
   the server `.env`, and `git`/`tar`/`rsync`/`curl`; fetches with retry; runs the
   `composer.lock` guard; prints the current HEAD as a rollback point.
   *Nothing on the server is modified until this passes.*
2. **Deploy API** — `git pull --ff-only` (retried 3×, because the resource cap
   kills git at random), then from `api/`: `migrate --force`, `config:cache`,
   `route:cache`, `view:cache`, `queue:restart`.
3. **Upload tarballs** — `practest-app-dist.tar.gz`, `practest-web-dist.tar.gz` → `~/deploy-incoming/`.
4. **Deploy frontends** — back up each docroot by **copying** to
   `~/deploy-backups/` (never by moving the live directory), extract to a temp
   dir, then `rsync -a --delete` into the docroot, excluding `.well-known/`
   (AutoSSL renewal) and `cgi-bin/`. Keeps the last 5 backups of each.
5. **Smoke test** — all four hosts must answer, and `/api/admin/test-series` must
   return **401, not 404** — a direct proof that `route:cache` actually took.

---

## Manual deploy (no CI)

Backend, on the server:
```bash
bash ~/practest-src/deploy/deploy-api.sh
```

Frontends, locally then upload — see `docs/INFRASTRUCTURE.md` §7B.

---

## Local development

```powershell
.\dev-start.ps1     # API :8010, SPA :3000, Astro :4321
.\dev-stop.ps1
```

> `docs/INFRASTRUCTURE.md` §8 notes the API runs on **8010** on this machine
> because Docker holds 8000. `CLAUDE.md` §17 still says 8000 — 8010 is correct here.

Tests:
```powershell
cd api; php artisan test      # 113 passing
cd app; npm run lint; npm run build
cd web; npm run build
```

---

## Rollback

**Backend** — SSH in, `cd ~/practest-src && git reset --hard <sha>`, then from
`api/` re-run the three `*:cache` commands. The pre-deploy HEAD is printed in the
preflight step's log.

**Frontend** — extract the matching backup:
```bash
cd ~/app.practest.live && tar xzf ~/deploy-backups/app-<timestamp>.tgz
cd ~/practest.live     && tar xzf ~/deploy-backups/web-<timestamp>.tgz
```

---

## Troubleshooting

**New API route 404s after deploy** — `route:cache` didn't run, or ran from the
wrong directory. `artisan` is in `api/`, not `practest-src/`.

**"Could not open input file: artisan"** — you're in `~/practest-src`. `cd api`.

**git says "Terminated"** — CloudLinux resource cap, transient. Retry (the scripts
already retry 3×).

**Deploy aborts on composer.lock** — working as designed. Build `vendor/` locally
and upload it (see above).

**SPA blank / 404 on refresh** — `.htaccess` missing from the docroot. It ships
*inside* the tarball; the build job asserts its presence, because
`upload-artifact@v4` silently drops dotfiles otherwise.

**AutoSSL renewal fails** — something deleted `.well-known/`. The rsync excludes
it; check for a manual `rm -rf` in the docroot.

**Login returns 419** — the axios instance needs `withXSRFToken: true`
(`app/src/api.js`), and `api/public/.htaccess` must keep its X-XSRF-Token
passthrough. Never overwrite that file with `deploy/.htaccess-api`.

**No test results for students** — the `queue:work` cron is missing. This is the
single most common silent production failure.

---

## Pre-launch checklist

- [ ] `CPANEL_*` secrets set; CI public key authorized in cPanel
- [ ] `production` GitHub Environment created (+ reviewer if you want a gate)
- [ ] **Both cron jobs verified running** (submit a mock as a student → result within ~1 min)
- [ ] `noreply@practest.live` mailbox + `MAIL_*` in the server `.env`
- [ ] Super-admin password rotated (it passed through setup logs) + 2FA secret backed up
- [ ] OAuth redirect URIs `https://api.practest.live/api/auth/{provider}/callback`
- [ ] reCAPTCHA registered for `practest.live` **and** `app.practest.live`
- [ ] MSG91 DLT template approved (phone OTP is deferred until then)
- [ ] Razorpay webhook + `RAZORPAY_WEBHOOK_SECRET` (only if payments go ON)
- [ ] `docs/QA-SCRIPT.md` run against production
- [ ] GTM/GA4/Meta Pixel IDs entered in Super-Admin settings
- [ ] Sitemap submitted to Search Console; `app.` and `api.` confirmed unindexed
