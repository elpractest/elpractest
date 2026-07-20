# e-Learning Practest — Master Build Prompt for Claude Code

> **How to use this file**: This is the persistent project brief. Sections 1–16 are the original spec — **most of it is already built**. Before writing any code, read **§17 (Current status & completion plan)** at the bottom: it says exactly what remains, gives the verified API contracts to build against, lists known bugs with prescribed fixes, and sets the guardrails that keep the passing test suite green.

---

## 1. Project identity

- **App name**: e-Learning Practest
- **Primary domain**: `pactest.live` (already added to Cloudflare, DNS proxied)
- **Hosting**: cPanel (confirmed available: SSH/Terminal, Git Version Control, MultiPHP Manager with PHP 8.3, Cron Jobs, Node.js App via Passenger, JetBackup, Imunify360/ModSecurity)
- **Product type**: a **website**, not a web-app — public marketing/SEO pages must be static HTML; only the logged-in area behaves like an app
- **Audience**: aspirants preparing for Indian one-day and banking/government exams — SSC CGL, SBI PO, SBI Clerk, IBPS/RRB, UPSC, State PCS
- **Core differentiator**: a fast, accurate, exam-pattern-accurate computer-based test (CBT) series engine

---

## 2. Non-negotiable architecture decisions

Do not deviate from this split without flagging it first:

1. **Public marketing site** — Astro (static export, zero client-side JS by default). Covers Landing, About, Contact, Courses listing, Course detail. This is what gets indexed by Google and used for Meta/Google Ads landing pages.
2. **Authenticated app** — React 18 + Vite, client-side rendered SPA. Covers all three dashboards (Super-Admin, Admin, Student) and the test-taking engine. Never indexed (blocked via `robots.txt`).
3. **Backend API** — Laravel 11 on PHP 8.3, stateless REST API, Laravel Sanctum for SPA auth.
4. **Database** — MySQL 8.
5. No persistent Node.js server required in production. The Node.js App feature in cPanel exists as a fallback option only — do not depend on it unless explicitly told to.

### Subdomain layout (all on `pactest.live`, via Cloudflare)

| Subdomain | Serves |
|---|---|
| `pactest.live` / `www.pactest.live` | Astro static public site |
| `app.pactest.live` | React SPA (dashboards) |
| `api.pactest.live` | Laravel API |

---

## 3. Repository structure

```
e-Learning_Practest/
├── api/                    # Laravel 11 project
│   ├── app/Models, Http/Controllers, Services, Jobs
│   ├── database/migrations, seeders
│   └── routes/api.php
├── web/                    # Astro public site
│   └── src/pages, components, layouts
├── app/                    # React + Vite SPA
│   └── src/pages, components, store, api
├── docs/                   # deployment + env docs
├── deploy/                 # cPanel deploy scripts, .htaccess templates
└── tools/                  # local composer.phar (dev convenience, not deployed)
```

---

## 4. Roles & permissions (Spatie Laravel-Permission)

| Role | Can do |
|---|---|
| **Super-Admin** | Everything Admin can, plus: white-label settings (logo, colors, site name, footer, social links, SEO defaults), toggle payment gateway on/off, toggle other feature flags, manage Admin accounts, view platform-wide analytics, GTM/GA4/Meta Pixel IDs |
| **Admin** | Manage student accounts, review/approve batch activation requests, generate/issue activation codes, create/edit courses + modules + lessons, bulk-upload question banks via CSV, create tests, view student/batch analytics — cannot touch white-label or billing settings |
| **Student** | Register, verify email + mobile OTP, request batch activation, redeem activation code (or pay online if enabled), view enrolled courses, watch lesson videos, attempt practice/mock tests, view own analytics |

---

## 5. Public website pages (Astro, static)

- **Landing** — hero section, exam-category tiles (SSC/Banking/RRB/UPSC/State PCS), "why Practest" highlights, testimonials placeholder, CTA to Courses
- **About Us** — mission, story, trust signals
- **Contact Us** — form (name, email, phone, message) → POSTs to Laravel API → stores in DB + sends notification email; protected by reCAPTCHA v3
- **Courses** — tile grid of all courses (exam name, mode badge "Offline + Online Test Series", short description, CTA "View details")
- **Course detail** (`/courses/[slug]`) — full syllabus, what's included, mode, FAQ accordion, schema.org `Course` structured data, CTA "Login to request activation"

All pages: proper `<title>`/meta description per page, Open Graph tags, canonical URLs, semantic HTML, descriptive image `alt` text.

### Landing page design addendum

- Modern, futuristic look with glassmorphism and smooth animation
- Fully responsive, mobile-first
- Content addresses **students only** — no B2B benefits, no mention of the app's architecture or tech stack

---

## 6. Auth system

- Email + password registration, email verification required before login
- **Social login**: Google + Facebook via `laravel/socialite`
- **Mobile OTP verification** (via MSG91 or Twilio) — required before a batch-activation request is accepted
- Password reset flow (Laravel default)
- Rate limiting (`throttle` middleware) on login, register, OTP-send, and password-reset endpoints
- **Google reCAPTCHA v3** on register and contact forms
- RBAC via `spatie/laravel-permission`
- **Mandatory TOTP 2FA** for Super-Admin and Admin roles (via `pragmarx/google2fa-laravel`)
- Auth transport: Sanctum SPA mode (cookie-based since `app.` and `api.` share the root domain `pactest.live`)

---

## 7. Course & batch activation flow (no payment gateway required)

1. Admin creates a course (with modules/lessons for LMS — see Section 8) and defines one or more **batches** under it.
2. Student registers, verifies email + mobile, browses Courses, clicks "Request activation" on a batch.
3. Request goes into `activation_requests` with status `pending`.
4. Admin reviews the request in their dashboard, approves it, and either:
   - generates a **new** activation code for that student, or
   - assigns an **existing unused** code from a bulk-generated batch
5. Student enters/redeems the code → `enrollments` row created → course unlocked.

**Activation codes** (`activation_codes` table): bulk-generatable in one action (e.g. generate 500 codes for Batch X), each tied to a specific course + batch, configurable as single-use or multi-use, with optional expiry date.

### Payment gateway — built in, but OFF by default

- Razorpay integration exists in the codebase from day one but is gated behind a `payment_gateway_enabled` flag in the `settings` table.
- Super-Admin dashboard has a literal toggle switch.
- **OFF (default)**: only the activation-code flow above is shown.
- **ON**: course/batch pages additionally show "Pay online for instant activation." A Razorpay webhook confirms payment **server-side** before creating the `enrollments` row — never trust a client-side success callback alone.

---

## 8. LMS module (YouTube-hosted video)

- Hierarchy: **Course → Modules → Lessons**
- Each lesson stores: title, `video_provider` (default `youtube`, kept generic for a future swap), `video_id`, duration, order, `is_free_preview` flag
- Videos uploaded as **Unlisted** on YouTube, embedded via `youtube-nocookie.com` iframe
- Access control: the lesson-content API endpoint checks the student's active enrollment **before** returning the video ID — free-preview lessons are the only exception
- Progress tracking: YouTube IFrame Player API on the frontend (`onStateChange`, `getCurrentTime()`) posts watched-seconds periodically to `lesson_progress` — used to compute % course completion on the student dashboard
- Note for later: if premium-content piracy protection becomes a priority, the abstracted `video_provider` field allows swapping in a DRM host like VdoCipher without restructuring the schema

---

## 9. Test series engine — build this with the most care

### Question bank

- Fields: subject, topic, difficulty, exam-tag(s), question text (must support inline math via **KaTeX** — quant sections need LaTeX-style notation), 4+ options, correct answer(s), explanation, marks, negative marks
- **Bulk upload via CSV** using `maatwebsite/excel`, with these exact columns:

```
question_text, option_a, option_b, option_c, option_d, correct_option, marks, negative_marks, subject, topic, difficulty, explanation
```

  Import must validate every row and return a **per-row error report** (e.g. "Row 45: correct_option must be one of a/b/c/d") rather than failing the whole batch.

### Test types

- **Practice** — subject/topic-wise, can be untimed, instant per-question feedback allowed
- **Mock / full-length** — timed, sectioned, replicates real exam pattern (e.g. SSC CGL sections, SBI PO sections), no feedback until submit

### Test-taking experience (must feel like a real CBT)

- `test_sessions` table stores `started_at` + `duration_seconds` — **the server is the sole source of truth for time remaining**, never the client clock
- Answers autosave via debounced API call (~2–3s after each selection) so nothing is lost on refresh or crash
- Resuming an in-progress test restores exact state (answered/marked/current question)
- Question palette showing: answered / not answered / marked-for-review / not-visited — standard SSC/Banking CBT UX, must be replicated
- Auto-submit when the server-computed time expires

### Analytics — must be 100% accurate, always recomputed from raw data

After submission, a **queued job** computes analytics using **only** the raw `test_answers` table as source of truth — never a client-submitted score:

- Overall score, accuracy %, attempted vs unattempted, total time taken
- Subject-wise and topic-wise breakdown
- Percentile/rank within the batch (computed from all attempts on that test)
- Full question-by-question review with correct answer + explanation
- Time spent per question

---

## 10. SEO requirements (Astro site)

- Unique `<title>` + meta description per page
- Open Graph + Twitter Card tags
- `schema.org` structured data: `Course` on course-detail pages, `Organization` sitewide, `FAQPage` where relevant
- Auto-generated `sitemap.xml` (`@astrojs/sitemap`), submitted to Google Search Console
- `robots.txt` explicitly disallows `/app/*` and `api.pactest.live`
- Target Core Web Vitals: LCP < 2.5s, CLS < 0.1

---

## 11. Ads & analytics integration

- GTM container ID, GA4 ID, and Meta Pixel ID are **not hardcoded** — stored in `settings` and injected at runtime (this is part of white-labelling: any future re-brand/clone of this platform can swap IDs without a redeploy)
- Conversion events to fire: registration complete, activation request submitted, code redeemed, (purchase — only if payment gateway is enabled), test completed
- Cookie consent banner + Google Consent Mode v2

---

## 12. White-labelling (Super-Admin only)

All of the following live in a single `settings` key-value table, read at runtime — changing any of them must never require a redeploy:

Site name · logo · favicon · primary/accent color · footer text · social links · contact details · SEO defaults · GTM ID · GA4 ID · Meta Pixel ID · `payment_gateway_enabled` · `social_login_enabled` · `lms_video_enabled`

---

## 13. Database schema (core tables)

| Table | Purpose |
|---|---|
| `users` | all roles (student/admin/super-admin), email, phone, verified flags |
| `roles`, `permissions` | via Spatie package |
| `social_accounts` | provider + provider_id per user |
| `otp_verifications` | mobile OTP records |
| `settings` | white-label + feature-flag key-value store |
| `courses`, `course_modules`, `lessons` | LMS hierarchy |
| `lesson_progress` | per-student watched-seconds per lesson |
| `batches` | batches under a course |
| `activation_requests` | student requests, status pending/approved/rejected |
| `activation_codes` | bulk-generated codes, course/batch-linked, single/multi-use, expiry |
| `enrollments` | confirmed course access per student |
| `payments` | Razorpay transaction records |
| `coupons` | discount codes (used only when payments are on) |
| `questions`, `question_options` | question bank |
| `tests`, `test_sections` | test definitions |
| `test_sessions` | server-authoritative timing per attempt |
| `test_answers` | raw per-question responses — source of truth for analytics |
| `test_analytics` | precomputed results, always regenerable from `test_answers` |
| `audit_logs` | admin/super-admin actions — critical since these roles control codes and settings |

---

## 14. Design & branding direction

- Modern, clean, trustworthy — this audience is preparing for serious government exams and should feel the platform is credible, not gimmicky
- Mobile-first for browsing/LMS (most Indian aspirants are on phones); test-taking screens should also work well on desktop/laptop for those who prefer it during actual mock exams
- Avoid clutter — question palette and timer are the most-looked-at UI elements during a test, keep them unambiguous
- Landing page: see the design addendum in Section 5

---

## 15. Build phases (tackle in this order)

1. **Laravel API foundation** — migrations, auth (Sanctum, Socialite, 2FA), roles/permissions, settings table
2. **Test series engine** — question bank + CSV import, test-taking flow, server-side timer, analytics job. Build and test this thoroughly before moving on — it's the core product.
3. **Course/LMS/activation system** — courses, modules, lessons, YouTube progress tracking, activation requests + codes
4. **React SPA dashboards** — Student, Admin, Super-Admin
5. **Astro public site** — Landing, About, Contact, Courses, Course detail, full SEO pass
6. **Payment gateway (behind toggle) + Ads/Analytics wiring**
7. **Deployment** — Git-based deploy to cPanel, `.htaccess` for SPA routing, Cloudflare SSL/cache rules, cron for Laravel scheduler

---

## 16. Instructions to Claude Code

- Ask before making a major architectural decision that isn't already specified above
- Write automated tests specifically for test-scoring and analytics logic — this must be provably 100% accurate
- Use Laravel migrations for every schema change, never manual SQL against the live DB
- Keep the Astro public site free of client-side data fetching except the contact form
- Provide a `.env.example` documenting every required environment variable for both the Laravel API and the two frontends

---

## Local dev environment notes (this machine)

- PHP 8.2.29 at `C:\Users\thevi\AppData\Local\...\PHP.PHP.8.2\php.exe` (production is PHP 8.3 — Laravel 11 supports both)
- Composer: local phar at `tools/composer.phar` → run as `php tools/composer.phar <cmd>`
- No local MySQL — local dev + tests use **SQLite**; production uses MySQL 8. Migrations must stay compatible with both.
- Run API tests: `cd api; php artisan test`
- Local API server: `cd api; php artisan serve` (port 8000)

---

## Read this first — how this platform is actually sold and deployed

- Practest is a white-labelled product sold to coaching institutes, **not a shared multi-tenant app**. Every client institute gets their own **separate deployment**: own database, own domain/subdomain, own installation of this exact codebase. There is no `tenant_id` scoping anywhere in the schema, and none is needed — isolation happens at the deployment level, not inside a shared database.
- `thevinstitution@gmail.com` is seeded as the permanent Super-Admin account in **every single deployment**, via `SUPER_ADMIN_EMAIL`/`SUPER_ADMIN_PASSWORD`. This already works exactly as needed via the existing `SuperAdminSeeder` and role-lockdown feature — no changes required there. This is how the platform owner retains support/control access into every client's copy.
- Each deployment has exactly **one Admin account** — the actual owner of that specific coaching institute, paying an annual licence fee to run their institute on this software. Admin manages day-to-day operations for their institute: courses, question bank, tests, batches, enrollments, activation requests. Everything already built in Phase 4A/4B is correctly scoped for this and needs no rework.
- Admin **never** gets access to branding, white-label settings, feature toggles, or platform-level configuration. Super-Admin configures these when a client's copy is provisioned, and can revisit them later if needed — but there is no self-service branding screen anywhere in the Admin dashboard, and there should never be one.
- **Forward note for later phases**: the public Astro site (Phase 5) is statically built, so when it's eventually built per-client, branding needs to be pulled from `settings` at *build time*, not runtime like the React SPA does — worth remembering when that phase starts, not something to solve now.

---

# 17. CURRENT STATUS & PHASE-BY-PHASE COMPLETION PLAN

> Status date: **2026-07-20**. Baseline: backend test suite **92 passed / 386 assertions** (`cd api; php artisan test`). Git history starts at commit `596bc12` (everything below assumes that commit as the floor — never rewrite it).
> This section is **canonical** and supersedes `docs/ROADMAP.md` where they disagree (it corrects two endpoint errors in that file). Every claim below was verified by reading the code on the status date, not assumed from the spec.

## 17.0 Ground rules for any AI builder (read before coding)

**The prime directive: do not break what works.** The backend and the admin SPA are feature-complete and verified. Remaining work is almost entirely *additive* student-facing UI plus deployment. Concretely:

1. **Test gate** — run `cd api; php artisan test` before you start and after every backend change. Baseline is 92 passed. A red suite means stop and fix, never "fix later". Every backend change you make (including the small bug fixes in §17.3) gets its own feature test.
2. **Build gate** — `npm run build` must pass in `app/` and in `web/` before any commit that touches them.
3. **Never change an existing route path, method, payload, or response shape.** The admin SPA (15 pages) and Astro site are wired to them. New needs → new endpoints, or strictly additive fields.
4. **Follow the existing patterns, don't introduce new ones**:
   - SPA: functional components + hooks, `app/src/api.js` axios instance (it already auto-fetches the Sanctum CSRF cookie before writes — never call `axios` directly), inline styles + the `glass-panel` / `btn-primary` / `btn-secondary` / `form-input` classes from `app/src/index.css`, role guards in `App.jsx`. No new UI/state libraries — the app deliberately has none.
   - API: FormRequest classes for validation, policy of enumeration-safe messages ("If an account exists…"), throttle names defined in `api/app/Providers/AppServiceProvider.php`, audit logging on admin actions.
   - PHP: PSR-12; `config()` never `env()` outside `config/*` files (production runs `config:cache` — a raw `env()` call silently returns null there).
5. **Git discipline** — one commit per completed task/phase chunk with a descriptive message. Never commit `.env`, `api/database/*.sqlite`, `dist/`, `vendor/`, `node_modules/` (already gitignored — keep it that way).
6. **Migrations must stay SQLite-compatible** (local/CI) *and* MySQL 8-compatible (production).
7. When this plan says "verify X in file Y first" — actually read the file. The two errors this section corrects in `docs/ROADMAP.md` both came from assuming instead of reading.

### Local dev quickstart (this machine)

```powershell
# API — http://localhost:8000, SQLite, mail→log, OTP→log
cd api; php artisan serve

# SPA — http://localhost:3000 (vite.config.js proxies /api and /sanctum → 127.0.0.1:8000,
# so dev needs no VITE_API_URL and no CORS; SANCTUM_STATEFUL_DOMAINS already covers localhost:3000)
cd app; npm run dev

# Astro site — http://localhost:4321, needs PUBLIC_API_URL=http://localhost:8000 for course/contact fetches
cd web; npm run dev
```

- Composer: `php tools/composer.phar <cmd>` (local PHP is 8.2, prod is 8.3 — both fine for Laravel 11).
- **Email verification / password reset links in dev**: `MAIL_MAILER=log` → look in `api/storage/logs/laravel.log`.
- **OTP in dev**: no `MSG91_AUTH_KEY` set → `Msg91Service` logs `MSG91 OTP [DEV MODE]: Phone=…, OTP=…` to the same log (verified in `api/app/Services/Msg91Service.php`).
- **reCAPTCHA in dev**: `VerifyRecaptcha` middleware skips itself when `RECAPTCHA_SECRET_KEY` is empty and in the `testing` env — so local flows work without keys, but the SPA must still *send* `recaptcha_token` when a site key is configured (read `api/app/Http/Middleware/VerifyRecaptcha.php` before touching this).

## 17.1 Where the project stands

### Built and verified (do not rebuild these)

| Area | Evidence |
|---|---|
| **Laravel API — complete** for every feature in §§4–13: auth (Sanctum SPA cookies, Socialite Google+FB, MSG91 OTP, password reset, mandatory admin TOTP 2FA), RBAC, test engine (server-authoritative timing, sections, palette, autosave, auto-submit, queued analytics, rank/percentile), CSV question import with per-row errors, LMS (courses/modules/lessons/progress), activation requests + codes, Razorpay behind `payment_gateway_enabled` toggle, contact form, white-label settings, audit logs | 18 feature-test files, 92 passing; `api/routes/api.php` is the full route map |
| **Admin + Super-Admin SPA — complete**: dashboard, courses/modules/lessons, batches, enrollments, questions + CSV import, tests, results, activation requests + codes, payments, users, settings, onboarding, audit logs, 2FA setup/verify | 15 pages in `app/src/pages/` |
| **Student SPA — partial**: Login (with 2FA branch), Dashboard (enrolled courses → tests list), TestTaking (palette/timer/autosave/sections), TestResult, StudentCheckout (Razorpay, shown only when toggle ON) | `Dashboard.jsx`, `TestTaking.jsx`, `TestResult.jsx`, `StudentCheckout.jsx` |
| **Astro site — partial**: Landing, Contact (reCAPTCHA → API), Courses list + `[slug]` detail (build-time fetch), sitemap, robots.txt, GTM/consent components | `web/src/pages/`, `Analytics.astro`, `ConsentBanner.astro` |
| **Scheduler**: `test:auto-submit` every minute | `api/routes/console.php` |

### Missing (this plan, in order)

- **A** — student onboarding UI: Register, verify-email, mobile OTP, forgot/reset password, social buttons (+ 6 small backend integration fixes, §17.3)
- **B** — student discovery/activation/LMS UI: browse courses, request activation (proof upload), redeem code, course outline, lesson player + progress, results history, dashboard upgrade
- **C** — Astro: About page, domain fix, SEO/CWV pass, `web/.env.example`
- **D** — integration hardening + scripted QA
- **E** — deploy scaffolding (`deploy/`, `docs/`) — E1 (first commit) is **done**
- **F** — cPanel production deployment
- **G** — launch validation + post-launch ops

## 17.2 Verified API contracts (build the UI against exactly this)

All routes in `api/routes/api.php`. Prefix `/api`. Session-cookie auth via Sanctum; `app/src/api.js` handles CSRF automatically. Shapes below were read from the controllers on the status date.

### Auth & onboarding (Phase A)

| Endpoint | Contract |
|---|---|
| `POST /register` | `{name, email, password, password_confirmation, phone?, recaptcha_token?}` → **201**, user is **NOT logged in**. Password rule: min 8 + mixed case + numbers. Fires `Registered` → sends verification email. Middleware: `recaptcha`, `throttle:register`. 422 on duplicate email: "An account with this email already exists." |
| `POST /login` | `{email, password}` → 200 `{user, 2fa_required, 2fa_setup_needed}`. **403 `{message, email_verified:false}` if email unverified** — the register→login path MUST route through verification. 401 bad credentials. `throttle:login`. |
| `GET /me` | `{user: {id, name, email, phone, email_verified, phone_verified, roles, avatar}}` — the two boolean flags drive all verification routing. |
| `GET /email/verify/{id}/{hash}` | Named `verification.verify`. Manual sha1-hash check (no signed middleware), returns JSON. See bug #3. |
| `POST /email/resend` | `{email}` — enumeration-safe, always 200. |
| `POST /forgot-password` | `{email}` — always 200 (enumeration-safe). **Currently broken end-to-end — bug #2.** `throttle:password-reset`. |
| `POST /reset-password` | `{token, email, password, password_confirmation}` — 200 or 422 with translated status. |
| `POST /otp/send` | **Auth required.** `{phone}` (≤20 chars) → 200. `throttle:otp-send` (3/10 min). OTP is 6 digits, expires 10 min. |
| `POST /otp/verify` | **Auth required.** `{phone, otp}` (otp exactly 6) → 200, sets `users.phone` + `phone_verified_at`. 422 "Invalid or expired OTP." |
| `GET /auth/{provider}/redirect` | `google` or `facebook`. Returns a 302 to the provider — **navigate with `window.location.href`, never XHR** (CORS will kill an XHR here). |
| `GET /auth/{provider}/callback` | Logs the user in (session cookie set). Social signup auto-verifies email, assigns `student`, `phone` stays null. **Currently returns JSON — bug #4.** |

**Resulting flow to implement:** register → "check your inbox" → email link → verified → login → if `phone_verified` false, OTP screen → dashboard. Social login skips email verification but not the phone gate.

### Student portal (Phase B)

| Endpoint | Contract |
|---|---|
| `GET /courses/public` | Public, cached 300s, throttled 60/min. Published courses with **only active batches that have `price_paise` set** — an unpriced batch is invisible here (see B1 note). Includes slug/descriptions/syllabus/faq/thumbnail/banner + batch `{id, name, price_paise, price_in_rupees, starts_at, ends_at}`. |
| `POST /student/activation-requests` | **multipart/form-data**: `batch_id`, `payment_reference` (unique among pending/approved — friendly 422 if reused), `proof_document` (**required** file: jpg/jpeg/png/pdf, ≤4 MB). → 201. No server-side phone gate today — bug #5. |
| `POST /student/activation-codes/redeem` | `{code}` — **exactly 8 chars**. Handles expiry/max-uses/batch-capacity with distinct 422 messages; success creates/reactivates the enrollment. |
| `GET /student/courses` | Enrolled courses (drives current Dashboard). |
| `GET /student/purchasable-courses` | Only meaningful when `payment_gateway_enabled` — existing Dashboard + StudentCheckout already consume it; leave as-is. |
| `GET /student/courses/{course}/outline` | Modules → lessons tree for an enrolled course (includes per-lesson progress — verify exact shape in `LmsController::courseOutline` before building B4). |
| `GET /student/lessons/{lesson}` | Returns `video_id` only if enrolled or `is_free_preview`. |
| `POST /student/lessons/{lesson}/progress` | Watched-seconds upsert — verify field names in `LmsController::updateProgress` before building B5. |
| `GET /student/tests`, `POST /student/tests/{test}/start`, sessions/answers/palette/submit/result | Fully working — TestTaking/TestResult already consume them. Don't touch. |
| `GET /settings/public` | Feature flags incl. `payment_gateway_enabled` (string `'true'`/`'false'` quirk — Dashboard.jsx shows the comparison). |

**Corrections to `docs/ROADMAP.md` (it was wrong about these):**
1. **There is no `GET /student/results` endpoint.** Admin has `GET /admin/results`; students only have per-session `GET /student/tests/sessions/{session}/result`. Results history (B6) therefore needs a **new small endpoint** — see B6 for the approved scope.
2. **There is no student batch-listing route** (`courses/{course}/batches` is admin-only). Student-facing batch data comes from `GET /courses/public`.

## 17.3 Known bugs — fix these first, inside Phase A (small, backend, test each)

Each fix below is deliberately narrow. Anything wider needs a flagged decision first.

1. **`FRONTEND_URL` is never read.** It exists in `.env.example` but no config key consumes it. Add `'frontend_url' => env('FRONTEND_URL', 'http://localhost:3000')` to `api/config/app.php`; use `config('app.frontend_url')` in fixes #2–#4.
2. **Password-reset email is broken end-to-end.** `PasswordResetController::forgotPassword` calls `Password::sendResetLink`, and the default `ResetPassword` notification builds `route('password.reset', …)` — **that named route does not exist anywhere**, so sending throws (surfaces as 500; grep confirmed no `createUrlUsing` in the codebase). Fix: in `AppServiceProvider::boot()`, `ResetPassword::createUrlUsing(fn ($user, string $token) => config('app.frontend_url')."/reset-password?token={$token}&email=".urlencode($user->email));`. Test: fake notifications, assert the URL shape.
3. **Email-verification link strands the user on raw JSON.** The default `VerifyEmail` notification signs a URL to the API route, which returns JSON in the browser tab. Fix: `VerifyEmail::createUrlUsing` → `config('app.frontend_url')."/verify-email?id={id}&hash={hash}"`; the new SPA page calls `GET /api/email/verify/{id}/{hash}` via XHR and renders success/failure + "Continue to login". (The API route does its own sha1 check and ignores signature/expiry — keep that behavior, don't add `signed` middleware now.)
4. **Social callback returns JSON to a full-page browser redirect** (`SocialAuthController::callback`) — after `Auth::login` the user is stranded on `api.…/callback` JSON. Fix: on success `return redirect(config('app.frontend_url').'/dashboard');`, on failure `redirect(config('app.frontend_url').'/login?error=social_failed')`. Update the existing social-auth feature test to expect redirects.
5. **Brief §6 says OTP verification is required before an activation request is accepted — the server doesn't enforce it.** Add to `StoreActivationRequest::authorize()` (or controller): reject when `$this->user()->phone_verified_at === null` with 403 `{message: 'Please verify your phone number first.', phone_verified: false}` + test. The Phase B UI gates on the same flag client-side.
6. **Domain typo:** `web/astro.config.mjs` says `site: 'https://www.practest.live'` — everything else (brief §1, `api/.env.example` session/Sanctum domains, `app/.env.production`) says **`pactest.live`**. Canonical = **`pactest.live`**. Fix the Astro config during Phase C; if the user ever says otherwise, `practest.live` requires changing session domain, Sanctum stateful domains, CORS, OAuth redirect URIs, and robots/sitemap references together.

## 17.4 Phase A — Student onboarding UI (SPA) + fixes above

**Goal:** a stranger can create a fully-verified working account with zero admin help.

| Task | Build | Notes |
|---|---|---|
| A0 | Backend fixes #1–#5 | Each with a feature test; suite stays green |
| A1 | `Register.jsx` | name/email/phone(optional)/password+confirm, T&C checkbox, reCAPTCHA v3 (load script only when `VITE_RECAPTCHA_SITE_KEY` set; send `recaptcha_token`), field-level 422 rendering, link to Login |
| A2 | `VerifyEmailNotice.jsx` + `VerifyEmail.jsx` | Notice: "check your inbox" + resend with 60s cooldown. Verify: landing page for the email link (`/verify-email?id&hash`) per fix #3 |
| A3 | `VerifyOtp.jsx` | Auto-send on mount (once), 6-digit input, resend countdown matching `throttle:otp-send`, skip-for-now link (dashboard works unverified; activation request is what's gated) |
| A4 | `ForgotPassword.jsx` + `ResetPassword.jsx` | Reset reads `token`/`email` from query params per fix #2 |
| A5 | Social buttons on Login + Register | Full-page navigate to `/api/auth/{provider}/redirect`; handle `?error=social_failed` on Login; hide when `social_login_enabled` setting is false (`GET /settings/public`) |
| A6 | Routing + guards in `App.jsx` | New public routes: `/register`, `/verify-email-notice`, `/verify-email`, `/forgot-password`, `/reset-password`; authed route `/verify-otp`. After login: `!phone_verified` → nudge (non-blocking banner) on dashboard linking to `/verify-otp` |

Also: add `VITE_RECAPTCHA_SITE_KEY=` to `app/.env.example`; keep the vite dev proxy untouched.

**Acceptance:** full local loop — register → link from `laravel.log` → verified → login → OTP from log → `phone_verified:true` → dashboard. Wrong OTP / reused email / weak password / 429s all render friendly messages. `php artisan test` green, `npm run build` clean.

## 17.5 Phase B — Student discovery, activation & LMS UI (SPA)

**Goal:** the default no-payment business flow (§7) works end-to-end in the UI, and enrolled students can watch lessons.

| Task | Build | Notes |
|---|---|---|
| B1 | Browse courses in SPA | `GET /courses/public`. **Caveat:** it only returns priced active batches — if a batch should be requestable without a public price, flag it; don't silently work around. Response is cached 300s — after admin-side batch edits in testing, expect the delay. |
| B2 | Request activation | Batch picker → offline-payment instructions → `payment_reference` input + proof file (jpg/png/pdf ≤4MB) → multipart POST (override the JSON default: send FormData, let axios set Content-Type). Gate on `phone_verified` (fix #5) with inline link to `/verify-otp`. Show pending/approved/rejected status on dashboard afterwards — **needs a tiny read endpoint**: `GET /student/activation-requests` (own requests only) — additive, tested. |
| B3 | Redeem code | 8-char input on dashboard → distinct error messages (invalid/expired/capacity) → success refreshes enrolled courses |
| B4 | `CourseOutline.jsx` | Modules→lessons tree, free-preview badges, completion ticks, % complete. Read `LmsController::courseOutline` first for the exact shape. |
| B5 | `LessonPlayer.jsx` | `youtube-nocookie.com` embed + YouTube IFrame API; post watched-seconds every ~15s + on pause/end + `visibilitychange` flush (`navigator.sendBeacon` fallback); resume position; locked lessons show enroll CTA. The only technically fiddly item in the phase. |
| B6 | Results history | **New endpoint** `GET /student/results`: own completed sessions (test title, score, accuracy, percentile, submitted_at, session id) reusing `TestAnalytics` — additive + feature test. Page links into existing `TestResult`. |
| B7 | Dashboard upgrade | Course cards gain % completion + "continue watching"; pending-request chips; redeem + browse entry points. Keep the existing purchasable-courses section exactly as-is (payment-ON path). |

**Acceptance:** fresh account full loop — browse → request (proof) → admin approves + issues code → redeem → outline → watch (progress rises, resume works) → attempt mock → results history shows it. Locked-lesson deep links rejected by UI *and* API. Suite green.

## 17.6 Phase C — Astro public site completion + SEO

1. Fix the domain (bug #6) — `site: 'https://www.pactest.live'`; verify robots.txt/sitemap output.
2. `web/src/pages/about.astro` — mission/story/trust signals per §5, reusing `Layout.astro`.
3. SEO audit every page: unique title+description, OG/Twitter, canonical, `Organization` sitewide + `Course` on detail + `FAQPage` where FAQs render.
4. CWV: `astro:assets` for images, font strategy, zero stray client JS; LCP < 2.5s / CLS < 0.1.
5. Landing polish per §5 addendum (students-only copy; all five exam categories; CTAs → `PUBLIC_SPA_URL`).
6. Create `web/.env.example`: `PUBLIC_API_URL`, `PUBLIC_SPA_URL`, `PUBLIC_GTM_ID`.
7. Document (in `docs/DEPLOYMENT.md`): course pages are **build-time rendered** — adding/editing courses requires an Astro rebuild.

**Acceptance:** `npm run build` clean; sitemap lists all pages on `pactest.live`; Lighthouse SEO ≥ 95 on Landing + one course page.

## 17.7 Phase D — Integration hardening & scripted QA

1. Cross-origin dress rehearsal: SPA built + served on a different local host/port than the API **without the vite proxy** (this is what production does; the proxy hides Sanctum/CORS misconfig). Prove `/sanctum/csrf-cookie` + credentialed XHR round-trip.
2. reCAPTCHA end-to-end with real test keys on register + contact; verify 429 handling.
3. Write `docs/QA-SCRIPT.md`: the full manual E2E (register → verify → OTP → request → approve → redeem → watch → timed mock incl. auto-submit at expiry → analytics → history) as a numbered checklist. It becomes the launch-validation script in G.
4. Payment-ON rehearsal: toggle ON, Razorpay test keys, webhook via `cloudflared` tunnel — enrollment must appear only after the webhook, never from the client callback.
5. Mobile + a11y pass on test-taking (palette on a phone, timer visibility, keyboard nav, focus states).
6. Failure modes: expired session mid-test, network drop during autosave, double-submit, back-button during checkout.

**Status:** Completed in Part 1 (2026-07-20). `DevDemoSeeder` created and verified. Full E2E QA loop executed and passed. `VerifyEmail` StrictMode fix + score field fixes applied. `QA-SCRIPT.md` marked PASS. Backend 101 tests pass, SPA & Web builds clean.

## 17.8 Phase E — Deploy scaffolding (E1 done)

- `deploy/.htaccess-api` (deny dotfiles, front-controller), `deploy/.htaccess-app` (SPA history fallback), `deploy/.htaccess-web` (static cache headers).
- `deploy/deploy-api.sh`: `composer install --no-dev --optimize-autoloader`, `migrate --force`, `config:cache`, `route:cache`, `view:cache`, `storage:link`, `queue:restart`.
- `docs/DEPLOYMENT.md` (cPanel runbook, written while executing Phase F) + `docs/ENV.md` (every var × three apps, dev vs prod, which dashboard issues each key).
- Build strategy: build frontends **locally** with prod env values and deploy the `dist/` artifacts (git deploy branch or upload) — keeps production Node-free per §2.5.

## 17.9 Phase F — cPanel production deployment (runbook skeleton)

1. Subdomains/docroots: root+`www` → Astro `dist`; `app.` → SPA `dist`; `api.` → Laravel `public/` (app dir outside any docroot).
2. MySQL 8 DB + user. Production `.env`: `APP_ENV=production`, `APP_DEBUG=false`, fresh `APP_KEY`, DB creds, `SESSION_DOMAIN=.pactest.live`, `SESSION_SECURE_COOKIE=true`, `SANCTUM_STATEFUL_DOMAINS=app.pactest.live`, **`CORS_ALLOWED_ORIGINS=https://app.pactest.live,https://pactest.live,https://www.pactest.live`** (the Astro contact form + course fetch call the API from the root domain — forgetting those origins breaks the public site), `FRONTEND_URL=https://app.pactest.live`, mail/MSG91/reCAPTCHA/Razorpay live values.
3. `php artisan migrate --force`; seed roles + Super-Admin via `SUPER_ADMIN_*` (per §"Read this first": `thevinstitution@gmail.com`). Never dev seeders in prod.
4. **Two cron entries** (both required): `* * * * * php artisan schedule:run` (auto-submit) and `* * * * * php artisan queue:work --stop-when-empty --max-time=55` — **analytics is a queued job; without the queue cron students never get results**.
5. Cloudflare: DNS for `app.`/`api.` proxied, SSL **Full (strict)**, cache-everything on the static site, **bypass cache on `api.*`**, exempt `/api/webhooks/razorpay` from WAF/Bot-Fight challenges.
6. Third-party prod config: OAuth redirect URIs `https://api.pactest.live/api/auth/{provider}/callback` in Google/Facebook consoles; MSG91 live key + DLT-approved template (start DLT approval early — it has lead time); reCAPTCHA v3 keys registered for `pactest.live` **and** `app.pactest.live`; SMTP decision (cPanel mail vs Brevo/SES); Razorpay live keys + webhook `https://api.pactest.live/api/webhooks/razorpay` + `RAZORPAY_WEBHOOK_SECRET`.
7. Imunify360/ModSecurity: watch for false positives on JSON POSTs (CSV import, answer autosave); whitelist specific rule IDs, don't disable. JetBackup covers DB + `storage/` daily.
8. `robots.txt` on `app.` disallows everything.

**Acceptance:** three hosts on HTTPS; `php artisan about` shows cached config; a real email, OTP, and queued job all observably work.

## 17.10 Phase G — Launch validation & post-launch

1. Run `docs/QA-SCRIPT.md` on production with a real email + phone, including one full timed mock with auto-submit.
2. Razorpay dashboard test webhook → signature verify + idempotency visible in `payments`/`audit_logs`.
3. Search Console: verify, submit sitemap; confirm `app.`/`api.` unindexed.
4. Enter GTM/GA4/Pixel IDs in Super-Admin settings; tags fire only post-consent (Consent Mode v2); verify the §11 conversion events.
5. Content seeding (operator): real courses/batches/question CSVs, one published mock per flagship exam.
6. Ops baseline: uptime monitors + `/up` health route, log rotation, one **tested** JetBackup restore, weekly `queue:failed` check.
7. Soft launch with one real batch before ad spend; watch audit logs, failed jobs, Imunify blocks for a week.

## 17.11 Decisions

**Resolved:** canonical domain = `pactest.live` (brief §1 + Cloudflare + API env agree; Astro config is the typo). First commit exists (`596bc12`); repo has no remote yet — pushing to a private GitHub repo is part of E.
**Open (ask the user, don't guess):** transactional email provider (F.6); MSG91 confirmed + DLT template kickoff (F.6); launch with payments ON or OFF (default OFF per §7); optional SPA visual polish pass (slot between D and F if wanted — the current dark-glass styling is functional but was never design-reviewed).

## 17.12 Definition of done (applies to every phase)

Suite green · builds clean · acceptance criteria demonstrated (screenshot or logged walkthrough) · no existing endpoint/page regressed · committed with a message naming the phase/task · anything discovered-but-out-of-scope written into this section or `docs/ROADMAP.md` instead of half-fixed.

