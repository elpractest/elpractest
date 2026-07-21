# Builder kickoff prompt #2 — remaining work to launch

> Paste everything below the line into a fresh AI-builder session opened at the repo root.
> Successor to `BUILDER-PROMPT.md` (which covered phases A0–E, now complete through commit `4c07982`).
> Covers: unexecuted local QA (Phase D remainder + full business-loop E2E), repo remote + production
> builds, Phase F cPanel deployment (interactive copilot), Phase G launch validation.
> Written 2026-07-20; baseline 101 backend tests passing.

---

You are continuing e-Learning Practest (Laravel 11 API + React SPA + Astro site) at repo root
`C:\Users\thevi\Downloads\e-Learning_Practest` (Windows). ALL feature phases are BUILT AND VERIFIED:
A0–E are committed through `4c07982`, backend suite is 101 passed / 415 assertions, both frontends
build clean, and a live browser E2E of the onboarding flow (register → email verify → login → OTP →
dashboard) has passed. Do not rebuild or redesign anything that exists. Your mission has four parts,
in order: (1) finish the UNEXECUTED verification work locally, (2) push the repo + produce production
builds, (3) drive the cPanel production deployment as an interactive copilot, (4) run launch validation.

## Read first (in this order, before any action)

1. `CLAUDE.md` §17 — canonical plan, contracts, guardrails. §17.12 is the definition of done.
2. `docs/QA-SCRIPT.md` — the E2E checklist you will execute (Part 1) and re-run on production (Part 4).
3. `docs/DEPLOYMENT.md` + `docs/ENV.md` — the runbook and env reference you will follow in Part 3.
4. Run `cd api && php artisan test` — expect 101 passed. Red = stop and investigate first.

If any doc contradicts the code, trust the code, fix the doc, note it in the commit message.

## Machine facts (verified 2026-07-20, save yourself the debugging)

- Port 8000 is held by Docker Desktop. Run the API on 8010: `php artisan serve --port=8010`.
  The vite proxy reads `VITE_API_PROXY` from `app/.env.local` (already set to `http://127.0.0.1:8010`).
- Dev email + OTP both land in `api/storage/logs/laravel.log` (`MAIL_MAILER=log`; MSG91 logs
  `MSG91 OTP [DEV MODE]` when no auth key). reCAPTCHA middleware self-skips without a secret key.
- Existing verified test student: `e2e-smoke@pactest.test` / `Practest123` (user id 4, email+phone verified).
- Admin/super-admin logins require TOTP 2FA. For scripted verification, read the user's
  `google2fa_secret` from the DB and generate the current code in tinker:
  `(new \PragmaRX\Google2FA\Google2FA())->getCurrentOtp($secret)`.
- Local PHP is 8.2 (prod 8.3); composer via `php tools/composer.phar <cmd>`.

## PART 1 — Finish local verification (autonomous; commit per task)

1.1 Execute `docs/QA-SCRIPT.md` end-to-end locally — for real, not by code reading. You will need
    content: create ONE published course with a priced batch, one module with a real YouTube lesson,
    and one published sectional mock with a few questions — via the admin UI where practical (this
    tests the admin side too). Optionally codify that content as a guarded dev-only seeder
    (`DevDemoSeeder`, refuses to run when `APP_ENV=production`) so QA is repeatable. The loop that must
    pass: student requests activation (proof upload) → admin approves + issues code → student redeems
    → outline unlocks → lesson plays and watched-seconds persist (refresh resumes) → attempt the mock
    (palette, autosave, section lock, server-side expiry auto-submit via `php artisan schedule:run` or
    `test:auto-submit`) → analytics correct → results history lists the attempt.

1.2 Payment-ON rehearsal: flip `payment_gateway_enabled` in super-admin settings, add Razorpay TEST
    keys to `api/.env` (never commit), buy a batch with a Razorpay test card, and confirm enrollment is
    created ONLY by the webhook (simulate the webhook POST with a valid HMAC signature against
    `/api/webhooks/razorpay` if a public tunnel is impractical; cloudflared is available as an option).
    Then flip the toggle OFF again (launch default per brief §7).

1.3 Cross-origin dress rehearsal: serve the BUILT SPA (`vite preview` or static server) on a different
    port than the API with NO dev proxy, `CORS_ALLOWED_ORIGINS` + `SANCTUM_STATEFUL_DOMAINS` set
    accordingly, and prove the csrf-cookie → login → authed-request flow works. This is the closest
    local approximation of production and catches Sanctum misconfig before DNS is involved.

1.4 Mobile + accessibility pass: 375px viewport on register, dashboard, activation modal, outline,
    lesson player, and ESPECIALLY test-taking (palette usable, timer always visible); keyboard
    navigation and visible focus on all new onboarding forms; labels tied to inputs.

1.5 Failure modes: refresh mid-test restores state; answer during a network drop is not lost silently;
    double-click submit doesn't double-submit; browser-back during checkout doesn't enroll; expired
    session mid-test surfaces a friendly re-login path.

1.6 Small fixes authorized (each additive + tested): guard `VerifyEmail.jsx` against React StrictMode
    double-fire (show "verified" not "already verified" on first visit); give `%VITE_GTM_ID%` a clean
    empty default so dev doesn't warn; anything Part 1 uncovers — fix forward, keep the suite green,
    never change existing contracts.

1.7 Update `docs/QA-SCRIPT.md` marking each item PASS/FAIL with date; fix fails before proceeding.
    Update `CLAUDE.md` §17 status notes as things complete. Commit per task.

## PART 2 — Remote + production artifacts (one user step, rest autonomous)

2.1 The repo has NO remote. Ask the user to create a PRIVATE GitHub repo (or hand you an existing
    remote URL + auth), then push all commits and verify the remote history matches local.

2.2 Produce production builds and verify them locally before any upload:
    `app/` with `VITE_API_URL=https://api.practest.live` (`app/.env.production` already exists),
    `web/` with `PUBLIC_API_URL=https://api.practest.live`, `PUBLIC_SPA_URL=https://app.practest.live`.
    Record the exact commands in `docs/DEPLOYMENT.md` if they differ from what's written.

## PART 3 — Phase F: cPanel deployment (INTERACTIVE COPILOT — do NOT attempt autonomously)

Gate first — collect from the user before touching anything, and STOP until answered:
  (a) mail provider decision (cPanel SMTP vs Brevo/SES/other), (b) MSG91 live key + DLT template
  status, (c) launch with payments ON or OFF (brief default: OFF), (d) confirmation they have open
  access to: cPanel, Cloudflare, Google Cloud console, Meta developers, MSG91, reCAPTCHA admin,
  Razorpay dashboard, and the GitHub remote.

Then walk `docs/DEPLOYMENT.md` step by step. Operating rules for this part:

- For each step: tell the user EXACTLY what to click/enter, wait for their confirmation, then
  VERIFY the result yourself from here (curl the live URL, check DNS/headers/HTTP codes) before
  moving to the next step. Never mark a step done on the user's word alone when it is verifiable.
- SECRETS NEVER TRANSIT CHAT OR GIT. The user types live keys/passwords directly into the server
  `.env` or the provider dashboard. You verify behavior (email arrives, OTP arrives, webhook 200s),
  never the values.
- Non-negotiables to check off explicitly: `APP_DEBUG=false` + `APP_ENV=production` + cached config;
  `SESSION_DOMAIN=.practest.live`, `SESSION_SECURE_COOKIE=true`, `SANCTUM_STATEFUL_DOMAINS=app.practest.live`;
  `CORS_ALLOWED_ORIGINS` includes `https://practest.live` AND `https://www.practest.live` AND
  `https://app.practest.live` (the Astro contact form + course fetch call the API from the root domain);
  `FRONTEND_URL=https://app.practest.live`; `migrate --force` + SuperAdminSeeder (`SUPER_ADMIN_*` env,
  never dev seeders); BOTH cron entries (`schedule:run` every minute AND
  `queue:work --stop-when-empty --max-time=55` every minute — analytics is queued; without the queue
  cron students never get results); Cloudflare SSL Full (strict), cache bypass on `api.*`,
  WAF/Bot-Fight exemption for `/api/webhooks/razorpay`; OAuth redirect URIs on `api.practest.live` in
  Google+Meta consoles; reCAPTCHA v3 keys registered for `practest.live` AND `app.practest.live`;
  `robots.txt` on `app.` disallowing everything; Imunify360/ModSecurity watched for false positives on
  JSON POSTs (CSV import, answer autosave) — whitelist specific rule IDs only; JetBackup covering DB +
  `storage/` daily.

Acceptance: all three hosts serve over HTTPS with valid certs; `php artisan about` shows cached
production config; a real email, a real OTP, and a queued job all observably work on the live stack.

## PART 4 — Phase G: launch validation (interactive)

4.1 Re-run `docs/QA-SCRIPT.md` ON PRODUCTION with a real email + real phone, including one full timed
    mock with auto-submit firing from the server cron.
4.2 Razorpay dashboard test webhook → verify signature validation + idempotency (`payments`/`audit_logs`).
4.3 Google Search Console: verify property, submit the sitemap, confirm `app.` and `api.` are not indexed.
4.4 Enter GTM/GA4/Meta Pixel IDs via super-admin settings; verify tags fire ONLY after consent
    (Consent Mode v2) and the §11 conversion events emit: registration, activation request, redeem,
    test complete (+ purchase only if payments ON).
4.5 Ops baseline: uptime monitor on all three hosts + the Laravel `/up` route; log rotation; ONE tested
    JetBackup restore; a weekly `queue:failed` check habit documented.
4.6 Soft launch: one real student batch before any ad spend; watch `audit_logs`, `failed_jobs`, and
    Imunify blocks for a week. Content seeding (real courses/questions/mocks) is the operator's task —
    support them, don't invent content.

## Working rules (unchanged, full detail CLAUDE.md §17.0/§17.12)

`php artisan test` green after every backend change, with a feature test for new behavior;
`npm run build` clean before frontend commits; never change existing route paths/payloads/response
shapes — additive only; follow existing code patterns, no new libraries; never commit `.env`,
`*.sqlite`, `dist/`, secrets; one descriptive commit per task; work autonomously through Parts 1–2,
interactively through Parts 3–4; ask the user ONLY for the listed decisions/access and anything
destructive. Report status at the end of each Part before starting the next.

Begin with the READ FIRST list, then Part 1, task 1.1.
