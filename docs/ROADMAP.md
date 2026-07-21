# Practest — Completion Roadmap to Production

> ⚠️ **Superseded (2026-07-20): the canonical plan now lives in `CLAUDE.md` §17**, which also contains verified API contracts, known bugs with prescribed fixes, and builder guardrails. Where the two disagree, §17 wins — it corrects two errors in this file: there is **no** `GET /api/student/results` endpoint (results history needs a new one), and student-facing batch data comes from `GET /api/courses/public` (the per-course batch route is admin-only). This file is kept for long-form phase D–G detail.

> Status date: 2026-07-20. Backend test suite: **92 passed / 386 assertions**.
> This document continues the original build phases (1–7 in `CLAUDE.md` §15). Phases 1–3 and 6 are complete; this roadmap covers everything between "now" and "end users on practest.live".

---

## 0. Where the project stands

### Done and verified
| Area | Evidence |
|---|---|
| Laravel API — auth (Sanctum, Socialite, OTP, password reset, 2FA), RBAC, settings, audit logs | Controllers in `api/app/Http/Controllers/Auth`, passing feature tests |
| Test engine — sectional timing, server-authoritative clock, autosave, palette, auto-submit, analytics job, rank/percentile, CSV import | `TestTakingFlowTest`, `ComputeTestAnalyticsTest`, `RankPercentileTest`, `QuestionImportTest` |
| LMS + activation backend — courses/modules/lessons, progress, requests, codes, enrollments | `LmsProgressTest`, `ActivationFlowTest`, `EnrollmentTest` |
| Razorpay — order create, server-side webhook verify, idempotency, coupons, capacity guard | `RazorpayPaymentTest`, `RazorpayWebhookTest` |
| Admin + Super-Admin SPA — dashboard, courses, questions, tests, results, activations, codes, enrollments, settings, onboarding, audit logs, 2FA | 15 pages in `app/src/pages/` |
| Student test-taking SPA — dashboard (enrolled courses → tests), TestTaking, TestResult, Checkout | `Dashboard.jsx`, `TestTaking.jsx`, `TestResult.jsx`, `StudentCheckout.jsx` |
| Astro public site — Landing, Contact (reCAPTCHA → API), Courses list + detail, sitemap, robots.txt, GTM/consent components | `web/src/pages/`, `Analytics.astro`, `ConsentBanner.astro` |
| Scheduler — `test:auto-submit` every minute | `api/routes/console.php` |

### Missing (this roadmap)
- **Student onboarding UI** — no Register, email-verify, mobile-OTP, forgot/reset-password, or social-login screens (all API endpoints exist).
- **Student activation UI** — no browse-courses / request-activation / redeem-code screens (the no-payment flow, which is the default flow, has no student UI).
- **Student LMS UI** — no course outline, lesson video player, or watch-progress posting.
- **Student results history + profile** — only per-session result page exists; `GET /results` is unused.
- **Astro About page** (required by brief §5).
- **Domain — RESOLVED 2026-07-21**: canonical is `practest.live` (the `pactest.live` misspelling was a typo, swept out of code/config/docs). See `CLAUDE.md` §17.3 item 6.
- **Zero git commits** — repo is `git init`-ed but empty; nothing exists to push/deploy.
- **`deploy/` and `docs/` empty** — no `.htaccess` templates, deploy scripts, or env documentation. No `web/.env.example` (Astro needs `PUBLIC_API_URL`, `PUBLIC_SPA_URL`, `PUBLIC_GTM_ID`).
- **Production wiring** — cPanel subdomains, MySQL, cron for scheduler + queue worker, Cloudflare SSL/cache, live keys for OAuth/MSG91/reCAPTCHA/Razorpay/mail.

---

## Phase A — Student onboarding UI (SPA)

**Goal:** a stranger can create a working, fully-verified student account without admin help.
**Backend:** zero changes — wire against existing endpoints.

| Task | Build | Endpoints (already live) |
|---|---|---|
| A1 | `Register.jsx` — name, email, phone, password + confirm, T&C checkbox, reCAPTCHA v3 token | `POST /api/register` |
| A2 | `VerifyEmail.jsx` — "check your inbox" holding screen + resend (cooldown timer); handle the signed-link landing (`?verified=1` redirect back into SPA) | `GET /api/email/verify/{id}/{hash}`, `POST /api/email/resend` |
| A3 | `VerifyOtp.jsx` — send OTP to registered phone, 6-digit input, resend with countdown, attempts feedback | `POST /api/otp/send`, `POST /api/otp/verify` |
| A4 | `ForgotPassword.jsx` + `ResetPassword.jsx` (token from email link) | `POST /api/forgot-password`, `POST /api/reset-password` |
| A5 | Social login — Google/Facebook buttons on Login + Register; full-page redirect to `/api/auth/{provider}/redirect`, handle return session | existing Socialite routes |
| A6 | Verification-state routing — logged-in but email-unverified → A2; phone-unverified → banner + gate before activation requests (OTP is required before a batch request is accepted, brief §6) | `GET /api/me` flags |

**Also in this phase:** add `/register`, `/verify-email`, `/verify-otp`, `/forgot-password`, `/reset-password` routes to `App.jsx`; reCAPTCHA v3 site-key via `VITE_RECAPTCHA_SITE_KEY` (add to `app/.env.example`).

**Acceptance criteria**
- Register → receive email (Mailpit/log locally) → verify → prompted for OTP → land on dashboard.
- Social signup creates a `student` user and never anything else (backend already enforces; UI must handle the redirect round-trip).
- Wrong OTP / expired reset token / duplicate email all render friendly errors, not raw 422 JSON.
- Rate-limit responses (429) show a "try again in X" message.

**Estimated effort:** 1–1.5 sessions. **Dependencies:** none.

---

## Phase B — Student course discovery, activation & LMS UI (SPA)

**Goal:** the default (no-payment) business flow works end-to-end for a student, and enrolled students can actually watch lessons — currently the flow dead-ends at "contact your admin".

| Task | Build | Endpoints (already live) |
|---|---|---|
| B1 | Browse courses — public course grid inside the SPA with batch list per course | `GET /api/courses/public`, `GET /api/student/courses/{course}/batches` |
| B2 | Request activation — pick batch → submit request (with proof upload; `activation_requests` has proof fields and the admin side already views proofs) → "pending" status chip on dashboard | `POST /api/student/activation-requests` |
| B3 | Redeem activation code — input on dashboard → success unlocks course instantly | `POST /api/student/activation-codes/redeem` |
| B4 | Course outline page — modules → lessons tree, completion ticks, free-preview badges | `GET /api/student/courses/{course}/outline` |
| B5 | Lesson player — `youtube-nocookie.com` iframe + YouTube IFrame API; post watched-seconds every ~15s and on pause/end; resume position; lock non-preview lessons for non-enrolled | `GET /api/student/lessons/{lesson}`, `POST /api/student/lessons/{lesson}/progress` |
| B6 | Results history — list of past attempts with score/accuracy/percentile, linking into the existing `TestResult` page | `GET /api/student/results` (currently unused) |
| B7 | Dashboard upgrade — % course completion (from lesson progress), pending-request status, "continue watching" | data already returned by outline/progress endpoints |

**Notes**
- B5 is the only technically fiddly item (IFrame API lifecycle, debounced progress posts, tab-close flush via `visibilitychange`/`sendBeacon`).
- Keep the payment path (`purchasable-courses` + `StudentCheckout`) as-is; it coexists with B1–B3 and appears only when the gateway toggle is ON.

**Acceptance criteria**
- Full loop on a fresh account: browse → request → (as Admin) approve + issue code → (as student) redeem → outline visible → watch a lesson → progress % rises → take a test → see it in results history.
- A non-enrolled student can open free-preview lessons only; deep-linking a locked lesson URL is rejected by the UI *and* the API.
- Refresh mid-video resumes within a few seconds of where it left off.

**Estimated effort:** 1.5–2 sessions. **Dependencies:** Phase A (verified accounts) for the request-activation gate.

---

## Phase C — Astro public site completion + SEO pass

**Goal:** the marketing site is content-complete, indexed correctly, and points at the right domain.

| Task | Detail |
|---|---|
| C1 | **Domain resolved (2026-07-21) → `practest.live`.** All `site:`, `SESSION_DOMAIN`, `SANCTUM_STATEFUL_DOMAINS`, CORS, OAuth redirect URIs and robots/sitemap references were swept to `practest.live`. Remaining task: confirm the registered Cloudflare domain matches before Phase F. |
| C2 | About page (`web/src/pages/about.astro`) — mission, story, trust signals; reuse `Layout.astro` |
| C3 | SEO audit of every page — unique title + meta description, OG/Twitter tags, canonical URLs, `Organization` schema sitewide, `Course` schema on detail pages, `FAQPage` where FAQs render |
| C4 | Core Web Vitals — image optimization (course banners via `astro:assets`), font loading, verify zero unneeded client JS; target LCP < 2.5s / CLS < 0.1 |
| C5 | Landing content polish — testimonials placeholder, exam-category tiles complete (SSC/Banking/RRB/UPSC/State PCS), CTAs to `app.` subdomain via `PUBLIC_SPA_URL` |
| C6 | Create `web/.env.example` documenting `PUBLIC_API_URL`, `PUBLIC_SPA_URL`, `PUBLIC_GTM_ID` |

**Known caveat to document (not solve):** course detail pages are **statically built** — they fetch course data at build time. Adding/editing a course requires an Astro rebuild. Note this in `docs/DEPLOYMENT.md` with the rebuild command; a build-webhook can come post-launch.

**Acceptance criteria:** `npm run build` clean; sitemap lists all pages on the correct domain; Lighthouse SEO ≥ 95 and no CWV reds on Landing + one course page.

**Estimated effort:** 0.5–1 session. **Dependencies:** domain decision (C1) — everything else in the phase follows it.

---

## Phase D — Integration hardening & pre-launch QA

**Goal:** the three apps proven to work together as they will in production, before any server is touched.

| Task | Detail |
|---|---|
| D1 | Cross-origin dress rehearsal — run SPA and API on distinct hosts locally (e.g. `app.localhost` vs `api.localhost`) to prove the Sanctum cookie flow (`/sanctum/csrf-cookie`, `withCredentials`, `SESSION_DOMAIN`) before DNS is involved |
| D2 | reCAPTCHA + rate limits verified end-to-end on register and contact (real site key, throttle responses handled) |
| D3 | **Scripted manual E2E** (write it down as `docs/QA-SCRIPT.md`): register → verify email → OTP → request activation → admin approve → redeem → watch lesson → attempt full mock (incl. section lock + auto-submit at expiry) → analytics correct → results history |
| D4 | Payment-ON rehearsal — flip the toggle, Razorpay test keys, webhook via tunnel (e.g. `cloudflared`), confirm enrollment appears only after webhook (not client callback) |
| D5 | Mobile + accessibility pass on the test-taking screen (palette usable on a phone, timer visible, keyboard navigation) |
| D6 | Failure-mode checks — expired session mid-test, network drop during autosave (answer not lost), double-submit, back-button during checkout |
| D7 | *(Optional but recommended)* Playwright smoke suite covering the D3 happy path, runnable before every deploy |

**Acceptance criteria:** D3 script passes start-to-finish on the cross-origin setup with `MAIL_MAILER` pointed at a real inbox tool and MSG91 sandbox (or logged OTPs).

**Estimated effort:** 1 session. **Dependencies:** Phases A + B complete.

---

## Phase E — Repo hygiene & deploy scaffolding

**Goal:** the codebase is version-controlled and carries everything a deployment needs.

| Task | Detail |
|---|---|
| E1 | `.gitignore` audit (vendor/, node_modules/, dist/, .env, storage/, tools/composer.phar) → **first commit** → push to a private remote (GitHub) — cPanel Git Version Control pulls from it |
| E2 | `deploy/.htaccess-api` — deny dotfiles, route to Laravel `public/`; `deploy/.htaccess-app` — SPA history-mode fallback to `index.html`; `deploy/.htaccess-web` — static caching headers |
| E3 | `deploy/deploy-api.sh` — `composer install --no-dev`, `artisan migrate --force`, `config:cache`, `route:cache`, `view:cache`, `storage:link`, `queue:restart` |
| E4 | `docs/DEPLOYMENT.md` — the full cPanel runbook (Phase F steps, written as you execute them) |
| E5 | `docs/ENV.md` — every env var for all three apps, dev vs prod values, which third-party dashboard issues each key |
| E6 | Decide build strategy for the two frontends: build locally/CI and commit `dist/` to a deploy branch, **or** build on the server via cPanel Node. Recommended: build locally, rsync/git the artifacts — keeps production free of Node, per the brief's "no persistent Node" rule |

**Estimated effort:** 0.5 session. **Dependencies:** none (can run parallel to A–D; do E1 immediately — there is currently no history at all, one bad `rm` loses everything).

---

## Phase F — cPanel production deployment

**Goal:** all three apps live on the real domain with SSL, cron, and live third-party keys.

| Task | Detail |
|---|---|
| F1 | Create subdomains + docroots: root/`www` → `web/dist`; `app.` → SPA `dist`; `api.` → Laravel `public/` (Laravel app dir itself outside any docroot) |
| F2 | MySQL 8 database + user; production `.env`: `APP_ENV=production`, `APP_DEBUG=false`, `APP_KEY` generated, DB creds, `SESSION_DOMAIN=.practest.live`, `SANCTUM_STATEFUL_DOMAINS=app.practest.live`, `CORS_ALLOWED_ORIGINS=https://app.practest.live,https://practest.live,https://www.practest.live` (Astro contact form + course fetch call the API from the root domain too) |
| F3 | `php artisan migrate --force`; seed roles + Super-Admin via `SUPER_ADMIN_EMAIL`/`SUPER_ADMIN_PASSWORD` (`thevinstitution@gmail.com` per brief); **never** run dev seeders in prod |
| F4 | **Two cron entries** — scheduler: `* * * * * php artisan schedule:run` (drives `test:auto-submit`); queue: `* * * * * php artisan queue:work --stop-when-empty --max-time=55` (analytics is a queued job — without this cron, students never receive results) |
| F5 | Cloudflare — DNS records for `app.` and `api.` (proxied), SSL **Full (strict)** with AutoSSL or an origin cert on cPanel, cache rules: cache-everything on the static site, **bypass cache** on `api.*`, page rule so `/webhooks/razorpay` is never challenged by WAF/Bot Fight |
| F6 | Live third-party config — Google + Facebook OAuth apps (prod redirect URIs on `api.practest.live`), MSG91 live key + DLT-approved template, reCAPTCHA v3 keys for the prod domains, SMTP (cPanel mail or a transactional provider — decide; see Open decisions), Razorpay live keys + webhook URL + webhook secret |
| F7 | Imunify360/ModSecurity — watch for false positives on JSON POSTs (question CSV import and answer autosave are the likely victims); whitelist specific rules rather than disabling; confirm JetBackup covers DB + `storage/` daily |
| F8 | Frontends built with prod env (`PUBLIC_API_URL=https://api.practest.live`, `VITE_API_URL` likewise) and deployed to their docroots; `robots.txt` on `app.` disallowing everything |

**Acceptance criteria:** all three hosts serve over HTTPS with valid certs; `php artisan about` shows production config cached; a test email and a test OTP actually arrive; queue cron visibly processes a dispatched job.

**Estimated effort:** 1 session with server access at hand. **Dependencies:** E complete; C1 domain decision; all third-party accounts accessible.

---

## Phase G — Launch validation & post-launch

**Goal:** proven working in production, measurable, and safely operable.

| Task | Detail |
|---|---|
| G1 | Run the full `docs/QA-SCRIPT.md` E2E on production with a real email + phone — including one complete timed mock with auto-submit and analytics |
| G2 | Razorpay webhook test event from their dashboard → confirm signature verify + idempotency in `audit_logs`/`payments` |
| G3 | Search Console — verify property, submit sitemap; confirm `app.` and `api.` are not indexed |
| G4 | Enter GTM/GA4/Pixel IDs in Super-Admin settings; verify tags fire *only after consent* (Consent Mode v2); check the conversion events: registration, activation request, redeem, test complete |
| G5 | Content seeding (operator task, not code): real courses, batches, question CSVs, at least one published mock per flagship exam |
| G6 | Ops baseline — uptime monitor on all three hosts + a `/up` health route, Laravel log rotation, JetBackup restore *actually tested once*, weekly `queue:failed` check |
| G7 | Soft launch — one real batch of students before ad spend; watch `audit_logs`, failed jobs, and Imunify blocks for a week |

**Estimated effort:** 0.5 session + operator content time.

---

## Open decisions (answer before the relevant phase)

1. **Domain — RESOLVED 2026-07-21 → `practest.live`.** (Confirm the Cloudflare-registered domain matches before Phase F.)
2. **Transactional email provider** (blocks F6) — cPanel SMTP is fine to start but risks spam-foldering; Brevo/SES free tiers are the usual upgrade.
3. **OTP provider confirmed as MSG91?** (blocks F6) — DLT template approval has lead time in India; start it early.
4. **Launch with payment gateway ON or OFF?** (G-phase toggle) — default per brief is OFF (activation codes only).
5. **SPA visual pass?** — current SPA is functional dark-glass styling; if a design polish is wanted, slot it between D and F as its own phase rather than blocking launch.

## Sequence & total effort

```
E1 (first commit — do today)
A → B → C → D → E2-E6 → F → G
             └ C can overlap A/B (independent codebases)
```

Roughly **5–7 focused sessions** to G1. The critical path is A → B → D: the student-facing UI is the only substantial build work left; everything after it is configuration and verification.
