# Session Handover — e-Learning Practest

> Last updated: **2026-07-22**, HEAD commit `1ac94ce`. Read this first for a cold start.
> It ties together the other docs and captures the hard-won learnings that aren't obvious from code.

---

## 0. TL;DR — where the project is

**The platform is LIVE in production and working.** All three hosts serve over HTTPS, a super-admin
can log in (with 2FA), students can sign up / verify email / reset password, and the **Test Series &
Teaching Layer (Phase 1)** is deployed and functional.

- Public site: **https://practest.live**
- App (dashboards + tests): **https://app.practest.live**
- API: **https://api.practest.live** (health: `/up`, quick check: `/api/settings/public`)
- Repo: **https://github.com/elpractest/elpractest** (private) · branch `main` · local + origin in sync at `1ac94ce`
- Backend tests: **113 passing**. Both frontends build clean.

**Read these docs, in order, for full context:**
1. `CLAUDE.md` §17 — canonical plan, verified API contracts, guardrails, definition of done.
2. `docs/INFRASTRUCTURE.md` — server/cPanel/Cloudflare/GitHub/DB facts + the deploy workflow.
3. `docs/TEST-SERIES-SPEC.md` — the approved Test Series design (Phase 1 done; Phases 2–3 pending).
4. This file — session learnings + current state + what's next.

---

## 1. What this session accomplished (the arc)

1. **Full SPA visual overhaul** — rebuilt `index.css` as a two-theme design system (day/night),
   Space Grotesk/Inter/JetBrains Mono fonts, glassmorphism, a floating theme toggle, an SVG `Icon`
   component; swept ~359 hardcoded colors → tokens across all pages.
2. **Landing page redesign** — "exam paper reimagined" identity (Astro `web/`): CBT-simulator hero,
   exam-category hall-ticket tiles, live course carousel, FAQ w/ schema, day/night synced to the SPA
   via a shared `practest_theme` cookie.
3. **Branding** — trademark **e-Learning Practest®** logo lockup everywhere; corporate footer (VPD
   Vastus Ventures Pvt Ltd → Vinstitution → e-Learning Practest; PAN/GSTIN/ISO; registered office);
   About + Contact rewritten; new graduation-cap favicon replacing framework defaults.
4. **Domain fix** — swept the `pactest.live` typo → **`practest.live`** everywhere (98 occurrences).
5. **Phase F production deployment (cPanel)** — cloned repo to the server, built `vendor` locally +
   uploaded (server composer gets killed), MySQL/MariaDB DB, `.env`, migrate + seed super-admin,
   pointed `api.` docroot at Laravel `public/`, uploaded both frontends, Cloudflare + AutoSSL/edge SSL.
6. **Fixed the production login** — the real bug was **`withXSRFToken`** missing on the axios instance
   (cross-origin CSRF); plus a super-admin password sync. Login + 2FA now work.
7. **Test Series & Teaching Layer — Phase 1** (built by Antigravity, reviewed + deployed here):
   `test_series` + `assignments` tables, `tests` gains `test_series_id/category/is_free/series_sort_order`,
   admin Series Builder, student Study Path, batch leaderboard. 113 tests green.
8. **Option B — super-admin is now a superset**: one unified `/admin/dashboard` shows all content tabs
   PLUS a Platform Governance section for super-admins (`1ac94ce`). Needs deploying (frontend only).
9. Design docs written: `docs/TEST-SERIES-SPEC.md`, `docs/INFRASTRUCTURE.md`, this handover.

---

## 2. Access & credentials (values live in the user's password manager, NOT here)

| Thing | Where / who |
|---|---|
| cPanel | `https://sgp.centreserver.com:2083` · user `thevins1` · home `/home/thevins1` |
| Server | IP `15.235.212.21` (Singapore) · MariaDB 10.6 |
| Code on server | `/home/thevins1/practest-src` (git clone, deploy key at `~/.ssh/practest_deploy`) |
| PHP 8.3 CLI | `/opt/cpanel/ea-php83/root/usr/bin/php` · Composer at `~/composer.phar` |
| Database | `thevins1_practest` / user `thevins1_practest` / pw in server `.env` |
| Docroots | root+www → `~/practest.live` · app → `~/app.practest.live` · api → `~/practest-src/api/public` |
| GitHub | `github.com/elpractest/elpractest` (private) — GCM auth occasionally blips, just retry the push |
| Super-Admin login | `thevinstitution@gmail.com` (pw in pw manager; **rotate it — it passed through setup logs**) + TOTP 2FA |
| Admin login | `vsn.educare@gmail.com` (seeded via `ADMIN_PASSWORD` env) |
| Cloudflare | user's account manages `practest.live` DNS (free plan) |
| Local repo | `C:\Users\thevi\Downloads\e-Learning_Practest` (Antigravity edits this SAME repo) |

---

## 3. THE DEPLOY WORKFLOW (memorize — most bugs here)

Two paths depending on what changed. Full detail in `docs/INFRASTRUCTURE.md` §7.

### Backend change (anything in `api/`)
```bash
cd ~/practest-src && git pull origin main
cd ~/practest-src/api                       # ← run artisan FROM api/, not practest-src/
PHP83=/opt/cpanel/ea-php83/root/usr/bin/php
$PHP83 artisan migrate --force              # only if migrations added
$PHP83 artisan config:cache && $PHP83 artisan route:cache && $PHP83 artisan view:cache   # ← ALWAYS, or new routes 404
```

### Frontend change (`app/` SPA or `web/` Astro)
Built locally, the `dist` is committed as `deploy/practest-*-dist.tar.gz`, so:
```bash
cd ~/practest-src && git pull origin main
cp ~/practest-src/deploy/practest-app-dist.tar.gz ~/app.practest.live/
cd ~/app.practest.live && rm -rf assets index.html && tar xzf practest-app-dist.tar.gz && rm -f practest-app-dist.tar.gz
```
(For the Astro site: `practest-web-dist.tar.gz` → `~/practest.live`.)

### Building the frontend tarball locally (before committing a UI change)
```bash
cd app && npm run build
cp ../deploy/.htaccess-app dist/.htaccess && cp public/favicon.svg dist/favicon.svg
tar -czf ../deploy/practest-app-dist.tar.gz -C dist .
# git add app/... deploy/practest-app-dist.tar.gz && commit && push
```

---

## 4. Hard-won gotchas (these cost real time this session)

1. **New API routes 404 in prod after deploy** → you forgot `php artisan route:cache` (prod runs
   cached routes). ALWAYS re-cache after pulling backend changes.
2. **`php artisan` "Could not open input file: artisan"** → you're in `~/practest-src`, but artisan is
   in `~/practest-src/api`. `cd api` first.
3. **`composer install` on the server prints "Terminated"** → CloudLinux resource cap kills it. Build
   `vendor/` LOCALLY (`php ../tools/composer.phar install --no-dev --optimize-autoloader`), tar it,
   upload via File Manager, extract. Don't fight the server.
4. **`git pull` prints "Terminated"** → same cap, transient. Just re-run it (usually works 2nd try).
   Same for `git push` "repository not found" — GCM blip, retry.
5. **Migration `->after('col')`** → fails on MySQL/MariaDB if `col` doesn't exist (SQLite ignores it,
   so local tests pass). NEVER use `->after()`; use `string` not DB `enum`. This bit us once.
6. **Cross-origin login = 419 CSRF** → the axios instance needs `withXSRFToken: true` (axios 1.x only
   sends the token same-origin otherwise). Already fixed in `app/src/api.js` — don't remove it.
7. **Cloudflare DNS** → keep `practest.live/www/app/api` **Proxied (orange)**; keep `mail`, `webmail`,
   `cpanel`, `whm`, `autoconfig`, `autodiscover`, `cpcalendars`, `cpcontacts`, `webdisk`, `MX` as
   **DNS-only (grey)** or cPanel/email breaks.
8. **The frontend `dist` tarballs are committed to git** (`deploy/*.tar.gz`) to enable pull-based
   frontend deploys. Works, but bloats the repo over time — a known tradeoff to revisit.

---

## 5. Feature status

**Working in production:** auth (register/verify-email/reset-password/login + mandatory admin TOTP 2FA),
student onboarding + OTP screen (OTP send is deferred — see below), course/LMS/activation flow,
CBT test engine (palette/timer/autosave/auto-submit/analytics), question bank + CSV import, admin +
super-admin dashboards, white-label settings, Razorpay behind a toggle (OFF at launch), contact form,
**Test Series Phase 1** (series builder, assignments, study path, batch leaderboard).

**Deployed but needs a config to fully function:**
- **Phone OTP (MSG91)** — DLT template pending; phone verification deferred. Students activate via
  **admin-issued activation codes** (redeeming does NOT need phone verification).

---

## 6. What's NEXT (pending, roughly prioritized)

1. **Deploy Option B** (commit `1ac94ce`, frontend-only) — run the frontend deploy steps in §3 so the
   super-admin sees the unified dashboard live.
2. **Verify the two cron jobs exist** (cPanel → Cron Jobs), both every minute — **critical & silent**:
   - `... artisan schedule:run` (auto-submit expired tests)
   - `... artisan queue:work --stop-when-empty --max-time=55` (**analytics + CSV import are queued —
     without this, students never get test results**). Test: submit a mock as a student → result should
     appear within ~1 min. If it hangs, the queue cron is missing.
3. **Content seeding** — real courses, batches, question CSVs, first Test Series + assign to a batch.
4. **Test Series Phase 2/3** (`docs/TEST-SERIES-SPEC.md`): cohort analytics dashboard, weak-area
   reports, homework deadlines/overdue, all-institute ranking; then adaptive study path + live tests.
5. **MSG91 + DLT** for real phone OTP.
6. **Rotate the super-admin password** (it went through setup logs/chat) + back up the 2FA secret.
7. **Android app** — approved direction: **Capacitor wrap** of the existing SPA (same API/DB). Needs a
   token-login endpoint (`/api/mobile/login` issuing a Sanctum bearer token — `auth:sanctum` already
   accepts both), FCM push, and Play billing kept off-app (institute enrollment model). User has a paid
   Play Console account.
8. **Cleanup (optional):** `SuperAdminDashboard.jsx` + `SuperAdminGuard` in `App.jsx` are now unused
   dead code (Option B unified into AdminDashboard); safe to remove later.

---

## 7. Working with Antigravity (the other AI builder)

- Antigravity edits the **same local repo** (`C:\Users\thevi\Downloads\e-Learning_Practest`) and pushes
  to the same GitHub remote. It built Test Series Phase 1 well.
- When handing it work, point it at: `CLAUDE.md` §17 (guardrails/contracts) → the relevant spec
  (`docs/TEST-SERIES-SPEC.md`) → `docs/INFRASTRUCTURE.md` (deploy). It re-derives context from these.
- Watch its **deploy commands** — its Phase-1 deploy one-liner silently no-op'd production (wrong
  artisan dir + missing `route:cache`); the corrected sequence is §3 above.

---

## 8. Verify current state (paste to confirm nothing drifted)
```bash
cd C:/Users/thevi/Downloads/e-Learning_Practest
git fetch origin && git rev-parse HEAD && git rev-parse origin/main   # should match
cd api && php artisan test                                            # expect 113 passed
# production liveness:
curl -s -o /dev/null -w "%{http_code}\n" https://api.practest.live/api/settings/public   # 200
curl -s -o /dev/null -w "%{http_code}\n" -H "Accept: application/json" https://api.practest.live/api/admin/test-series  # 401 = live
```

Definition of done for any change (from `CLAUDE.md` §17.12): suite green · builds clean · additive
(no existing route/payload changed) · deployed with cache refresh · verified live.
