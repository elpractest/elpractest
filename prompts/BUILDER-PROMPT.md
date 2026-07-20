# Builder kickoff prompt

> Paste everything below the line into a fresh AI-builder session opened at the repo root.
> It binds the builder to the canonical plan in `CLAUDE.md` §17 and sets execution order + discipline.
> Written 2026-07-20, when the plan baseline was commit `da6e703` (92 backend tests passing).

---

You are continuing an existing, partially-complete production project: e-Learning Practest
(Laravel 11 API + React SPA + Astro public site) — repo root: `C:\Users\thevi\Downloads\e-Learning_Practest` (Windows).
This is NOT a greenfield build. The backend and the admin/super-admin dashboards are complete and
verified by a 92-test suite. Your job is to finish the remaining student-facing UI and pre-deployment
work by executing a plan that is already written into the repo. Do not redesign, do not rebuild
working parts, do not invent scope.

## Before writing any code

1. Read `CLAUDE.md` in the repo root, end to end. Sections 1–16 are the original spec; **§17 is the
   CANONICAL completion plan**: current status, verified API contracts, six known bugs with prescribed
   fixes, working guardrails, and the phase plan you will execute. Where §17 and `docs/ROADMAP.md`
   disagree, §17 wins.
2. Establish the baseline: `cd api && php artisan test` — expect **92 passed**. If it isn't green,
   stop and investigate before anything else.
3. If you ever find §17 contradicting the actual code, trust the code, fix §17, and say so in the
   commit message — never build against an unverified assumption.

## Execute in this exact order

1. **Phase A0** — the six fixes in §17.3 (FRONTEND_URL config key, broken password-reset URL,
   email-verify redirect, social-callback redirect, phone gate on activation requests; the Astro
   domain typo waits for Phase C). Each fix gets a feature test. Commit when the set is green.
2. **Phase A** (§17.4) — student onboarding UI: Register, verify-email notice + landing pages, OTP,
   forgot/reset password, social buttons, routing/guards, reCAPTCHA wiring. Then verify the full
   loop locally per the acceptance criteria (dev quickstart in §17.0; verification links and OTPs
   appear in `api/storage/logs/laravel.log`). Commit.
3. **Phase B** (§17.5) — browse courses, request activation (multipart proof upload), redeem code,
   course outline, YouTube lesson player with progress posting, results history, dashboard upgrade —
   including the two small ADDITIVE endpoints §17.5 authorizes (`GET /student/activation-requests`,
   `GET /student/results`), each with feature tests. Verify the full no-payment business loop
   (§17.5 acceptance). Commit.
4. **Phase C** (§17.6) — Astro About page, fix the domain typo to `pactest.live`, SEO/schema/CWV
   pass, `web/.env.example`. Commit.
5. **Phase D** (§17.7) — cross-origin dress rehearsal (no vite proxy), failure-mode checks, and
   write `docs/QA-SCRIPT.md`. Commit.
6. **Phase E** (§17.8) — deploy scaffolding: `.htaccess` templates, `deploy-api.sh`,
   `docs/DEPLOYMENT.md`, `docs/ENV.md`. Commit.
7. **STOP before Phase F** (production deployment). It requires server access and the open decisions
   in §17.11 (mail provider, MSG91/DLT, payments ON/OFF at launch). Report status and wait.

## Non-negotiable working rules (full detail: §17.0 and §17.12)

- After every backend change: `php artisan test` stays green; new behavior gets a feature test.
- Before any commit touching a frontend: `npm run build` passes in `app/` (and `web/` when touched).
- **NEVER change an existing route path, method, payload, or response shape** — the admin SPA and
  the Astro site are wired to them. New needs = new additive endpoints only.
- Follow the existing code patterns: the `app/src/api.js` axios instance (it already handles Sanctum
  CSRF — never bypass it), FormRequest validation, existing CSS classes, role guards in `App.jsx`.
  No new libraries or frameworks unless §17 explicitly says so.
- Migrations must run on both SQLite (local/tests) and MySQL 8 (production).
- Commit per completed task with a descriptive message. Never commit `.env`, `*.sqlite`, `dist/`,
  `node_modules/`, `vendor/`.
- Work autonomously. Ask the user ONLY about the §17.11 open decisions, or before anything
  destructive or contract-changing. Definition of done for every phase is §17.12: suite green,
  builds clean, acceptance criteria demonstrated, nothing regressed, committed.

Start now with Phase A0, fix #1.
