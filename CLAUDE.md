# e-Learning Practest — Master Build Prompt for Claude Code

> **How to use this file**: This is the persistent project brief. Build in the phase order given in Section 15 — don't ask for everything in one shot. Each phase ends with something testable.

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

