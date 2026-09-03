# Current state

Where Practest work stopped. Keep short and current — history goes in JOURNAL.md.

_Last updated: 2026-09-04_

## In flight

Nothing mid-build. The three things below all shipped, tested, and are live
(pushed to `main`, CI-promoted to `deploy/coolify`) as of this update.

**Image/table MCQ support, per-test instructions gate, video analytics,
in-app PDF reader** — done. Built for the Indian competitive-exam market
(SSC/Banking/RRB/UPSC): question/option/passage images, DI tables via
passages, reasoning figure-series (image-only options), a per-test
instructions screen shown before a first attempt, a hardened lesson video
player, an admin video-engagement view, and a PDF study-material reader
(entitlement-checked stream, reading-position sync, annotations). CSV bulk
import now supports option-level images too
(`option_a_image_url`..`option_f_image_url`), plus a **Download template**
button on the admin Question bank page
(`GET /api/admin/questions/import-template`). Backend suite: 386 passed.

**Zero-mock-data cleanup, SPA + marketing site** — done. Full details below.

## What just happened: mock-data removal

The SPA (`app/`) shipped with a `USE_DEMO_DATA` fallback
(`app/src/lib/demoData.js`) that filled empty screens with fabricated SSC/
Banking/Railways/UPSC content — course cards, a "Free test" trial exam with
its own 20-question bank, fake notifications, fake search chips, fake study
stats. The Astro marketing site (`web/`) separately had static fabricated
content baked into `index.astro` — fake per-exam mock counts, a hardcoded
"00:47:12" CBT-timer hero badge, a "Trusted by 15,000+ Aspirants" stat
block, and a section literally commented `<!-- ASPIRANT VOICES
(placeholder) -->` with 3 invented testimonials.

**All of it is now removed**, per explicit user decisions (not a unilateral
call):
- SPA: `demoData.js` deleted outright. Widgets with a real API-backed empty
  state (banners, Dashboard's popular-courses card, notifications) just lost
  their fallback — they already degrade correctly to nothing. Widgets with
  **no** real data source at all (Dashboard's "explore by exam" grid,
  StudyZone's stat header, SearchPage's trending/recent chips,
  StudentTestSeries' filter chips) were deleted rather than patched, so the
  live site can show real blank states honestly instead of fake ones —
  explicit user call, since the DB has no content seeded yet and these would
  otherwise just be empty regardless.
- The `/tests/demo` "free trial mock" was a real, working feature (not
  incidental filler) built entirely on the fake question bank — removed on
  explicit instruction along with `TestSeriesDetail.jsx`'s whole `SalesDetail`
  pre-enrollment sales-page component, which only ever rendered for a demo
  course id (real series get a proper 404 empty state now instead).
  `TestTaking.jsx`/`TestResult.jsx` had ~15 `isDemo` branches threaded through
  the real exam engine — all removed; the real server-authoritative logic is
  now the only path (was already correct for real sessions, this just deletes
  the bypass).
- `web/index.astro`: removed the fake mock-count arrays, the hero's fabricated
  CBT-timer/rank badges, the "15,000+ Aspirants" stat block, and the
  testimonials section. Left the "Built like the real thing" deep-dive
  widgets (section-timer/analytics/lesson-progress mockups) alone — those
  illustrate real mechanisms rather than claiming specific fake outcomes, and
  weren't in the removal scope the user approved.
- `web/contact.astro`: found and fixed a real bug while in here —
  `recaptcha_token: 'dummy_token'` was hardcoded into every submission. Now
  loads the real reCAPTCHA v3 script (`PUBLIC_RECAPTCHA_SITE_KEY`, new env
  var, mirrors the SPA Register page's pattern) and executes a real token at
  submit time; still a graceful no-op end-to-end when unconfigured, matching
  `VerifyRecaptcha` middleware's own skip-when-no-secret behavior.

**Verified:** `npm run build` + lint clean on both `app/` and `web/`. Live
browser click-through on a throwaway self-registered student account
(created via the real register flow, email-verified via `tinker`, deleted
after) — Dashboard, Test series, Study zone, Search, and Notifications all
render correct empty states with zero console errors. `web/` verified via
build output only (astro build succeeded, no dangling class/const
references) — not click-tested live, since this session's `.claude/
launch.json` server-name resolution didn't reach the `practest-web` entry
from this working directory.

**Not yet committed as of this note** — see whoever picks this up next: check
`git status` before assuming it shipped.

## Next step

1. **Commit + push the mock-data removal** (13 files: 10 in `app/`, 3 in
   `web/`, one deletion). Sequenced after image/table-MCQ work, which is
   already live.
2. Seed real content (`/admin/dashboard`) so the now-honest empty states
   actually have something to show — this was always the real blocker behind
   "zero-mock-data launch," not the fake fallback code itself.
3. Set `FIREBASE_CREDENTIALS_JSON` + `FIREBASE_PROJECT_ID` on the Coolify api
   container — FCM push backend has been live since the last promotion, just
   never configured. See "Prod facts" below for the project id.
4. Ship a release Flutter app build once (3) is done — the Android client's
   FCM + native Google sign-in code is complete and committed but has never
   sent or received a real push on a device.

## Open / blocked

- **Nothing blocked.** Owner decisions: when to seed real content; when to
  configure Firebase creds; whether/when to cut a Flutter release build.
- **Never verified live:** real FCM device send (no service account
  configured yet); Flutter token-registration and push-tap deep-link on an
  actual device; the two FCM migrations have never run on prod.
- **Zero-mock-data launch — code side is now done**, but the site will still
  look sparse until real courses/tests/series/banners are seeded, per (2)
  above. `VITE_USE_DEMO_DATA` no longer does anything — the flag and the file
  it gated are both gone, not just defaulted off.
- **Google login — final config (code done + deployed once pushed):** web
  login's `GOOGLE_CLIENT_ID` is `904862810932-…` (a DIFFERENT Google
  project). Mobile needs the Firebase project's (`practest-24732` /
  `688814926066`) web client, so it's decoupled: set
  **`GOOGLE_MOBILE_CLIENT_ID` = `688814926066-1b0pv343gn2lv6v9l3ltvfdtpqdef0ui.apps.googleusercontent.com`**
  on the api container (new key; leave `GOOGLE_CLIENT_ID` alone).
  `social_login_enabled` is already ON; SHA-1
  `E1:F1:54:75:9E:E5:F2:5A:9B:BC:50:88:9A:35:C8:25:C2:03:6E:4E` is
  registered. Debug/release share the debug key's SHA-1 (no release keystore
  yet).

## Prod facts worth not re-deriving

- Firebase project: **`practest-24732`**. Android package:
  `com.practest.practest_app`.
- Admin panel is the SPA at **`/admin/dashboard`** (one tabbed page).
  **Super-admin is a superset of admin** — no separate login needed.
- Seeded accounts: super-admin `thevinstitution@gmail.com`, admin
  `vsn.educare@gmail.com` (both seeded with a **default password** — rotate
  the admin one if unused, and note: as of 2026-09-03 the super-admin's
  actual DB password no longer matches whatever `SUPER_ADMIN_PASSWORD` says
  in `.env` — it was changed by someone at some point without updating that
  doc value; don't trust `.env` for it, ask the owner). Student test acct:
  `vmedics.ps@gmail.com` (anant).
- **Store rule:** a course lists in the Store only when
  `Course.is_published=true` AND it has an `is_active` batch with
  `price_paise` set.
- Mobile auth = Sanctum bearer via `/mobile/login`; token in
  `shared_preferences` (`auth_token`). API base already includes `/api`; app
  paths are like `/student/device-tokens`.
- Backend tests run on sqlite `:memory:`, `QUEUE_CONNECTION=sync`. Full
  suite: 386 pass (was 139 as of the last time this line was updated —
  substantial ground covered between then and now that this doc never
  tracked; treat any older reference elsewhere in the repo to a lower count
  as stale).
- Deploy model: push to `main` → CI runs the backend suite on MariaDB →
  passing run fast-forwards `deploy/coolify` → Coolify's webhook deploys.
  See `.github/workflows/ci.yml`'s own header comment for the full rationale
  (promotion-branch model, no deploy credential in CI).
- The bulk-import sample CSV (`api/storage/app/templates/
  question_import_sample.csv`) used to be silently swallowed by
  `storage/app/.gitignore`'s blanket `*` rule — never actually shipped
  despite being referenced in code. Fixed 2026-09-03; it's a real tracked
  file now with a carved-out gitignore exception.
