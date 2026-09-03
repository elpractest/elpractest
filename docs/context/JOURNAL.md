# Journal

Append-only session history for Practest. Newest first, directly below this block.
Each entry: **Goal / Done / Why it's built this way / Verified / Left open / Surprises.**
"Where we are right now" lives in STATE.md, not here.

---

## 2026-09-03/04 — Image/table MCQs, instructions gate, PDF reader, video
## analytics, zero-mock-data cleanup

**Goal.** Answer "does bulk CSV import handle image/graph/diagram MCQs, and
can we set per-test instructions?" (answer at session start: no to both),
then build both properly for the Indian competitive-exam market — plus,
from an earlier ask in the same session, a robust lesson video player, admin
video-engagement analytics, and an in-app PDF reader for paid study
materials. Session closed with a second, unrelated ask: audit and remove
every piece of fabricated/demo content from the live product.

**Done — content authoring & test-taking:**
- Study material reader: `study_materials`/`reading_progress`/
  `material_annotations` tables, entitlement-checked private-disk streaming,
  a lazy-loaded pdf.js reader with highlight/note annotations and rate-limited
  position sync, surfaced via a Library shelf + course-outline strip.
- Video: hardened `LessonPlayer.jsx` (recovers from transient YouTube API
  failures, distinguishes a misconfigured video from a network drop, fixed a
  leaked `visibilitychange` listener), `CohortAnalyticsController::
  videoEngagement` + `AdminVideoAnalytics.jsx` reading `lesson_progress` data
  that was written but never read back in aggregate before.
- Instructions gate: `TestTakingController::preview()` + `TestInstructions.jsx`,
  wired into Start/Continue buttons — closes a gap where per-test instructions
  were collected but never shown to a student. Fixed a dead route
  (`/student/test/:id` never existed) found in the process.
- Image/table MCQs: `image_path` on questions/options, `image_path`+
  `table_data` on passages (additive migrations only — a `Blueprint::
  change()` attempt on `question_options.option_text` was caught via
  `migrate --pretend` before running; it would have rebuilt the table on
  SQLite and dropped every other column). Passage-based grouping (pre-existing,
  built for English RC sets) reused as-is for Data Interpretation tables.
  CSV bulk import first shipped question-image-only, then extended same-day
  to per-option images (`option_a_image_url`..`option_f_image_url`) after
  pushback on that scope cut — an option row is now valid with just an image,
  no text, mirroring the admin form's own rule.
- Download template button + `GET /api/admin/questions/import-template`, so
  the sample CSV is reachable from the admin UI instead of only by asking
  someone with shell access.

**Done — zero-mock-data cleanup (second half of the session):** removed
`app/src/lib/demoData.js` and every consumer (9 files), including the
`/tests/demo` free-trial exam feature and `TestSeriesDetail.jsx`'s demo-course
sales page — both real, working features built entirely on fake data, removed
on explicit instruction rather than assumed out of scope. Removed
`web/index.astro`'s fake mock-count arrays, fabricated CBT-timer/rank hero
badges, "15,000+ Aspirants" stats, and placeholder testimonials. Found and
fixed a real bug while in `contact.astro`: a hardcoded `recaptcha_token:
'dummy_token'` was sent on every submission instead of a real token — now
wired to actual reCAPTCHA v3, matching the SPA Register page's pattern.
Full breakdown of what was kept vs. removed and why lives in STATE.md rather
than repeated here, since it's the kind of detail someone will want to check
against the live code later, not just read once.

**Why it's built this way.** The mock-data decisions were NOT unilateral —
each one (whether to leave now-unbacked widgets blank vs. patch them with a
real endpoint; whether to keep or remove the demo trial exam; whether to
touch the marketing site's placeholder copy; whether to fix the reCAPTCHA bug)
was put to the user explicitly before touching code, because several of them
remove real, working functionality (the trial exam) or touch business-facing
copy (marketing stats/testimonials) that isn't a judgment call an assistant
should make alone.

**Verified.** Backend suite 386 passed (was 380 at session start, then held
steady through the frontend-only cleanup pass). `npm run build` + lint clean
on `app/` and `web/`. Live browser click-through of the Download-template
button and of the cleaned-up SPA screens (Dashboard, Test series, Study zone,
Search, Notifications) on throwaway self-registered test accounts — created
via the real register flow, email-verified via `tinker` (not a password
reset on an existing account, which got blocked by the permission classifier
as a sensitive credential change), deleted after each check. All confirmed
correct empty states, zero console errors. `web/` changes verified via build
output only, not click-tested live — this session's dev-server tooling
couldn't resolve the `practest-web` launch config from its working directory.
CI-gated pushes: 3 commits for the content-authoring half went out and
promoted to `deploy/coolify` cleanly (one required a same-day follow-up fix —
the sample CSV turned out to have been silently gitignored this whole time,
caught by a new regression test failing in CI against a real checkout,
invisible locally since the file existed on disk either way). The
mock-data-removal half was NOT committed by the end of this entry — see
STATE.md's Next step.

**Left open.** Committing + pushing the mock-data removal (STATE.md has the
file list). Real content seeding, so the now-honest empty states have
something to show. Firebase credentials on the Coolify api container
(backend's been ready since the last promotion). A Flutter release build.

**Surprises.** `storage/app/.gitignore`'s blanket `*` rule had silently
swallowed the CSV template for its entire existence. React checkboxes set via
a scripted "set value" call don't fire the `onChange` a controlled component
depends on — cost real time twice in this session on register-form
automation, worth remembering for future scripted UI testing here.
`TestTaking.jsx`/`TestResult.jsx` had demo-mode branches threaded through
~15 call sites each — removing a "small" fallback touched far more of the
real exam engine's surface area than expected, though every removal was a
pure subtraction (delete the early-return, keep what already ran for real
sessions), never a behavior change to the real path.

---

## 2026-08-15 — FCM push v1.1 (steps 1–2) + activation-reject fix

**Goal.** Move toward a launch-worthy, zero-mock Practest. Diagnose the "mock data",
fix what's actually broken, then scope + build push notifications.

**Done.**
- **Diagnosis:** the web app's rich content is a *deliberate* frontend fallback
  (`USE_DEMO_DATA` defaults true in `app/src/lib/demoData.js`), shown only when the
  API returns empty AND no content is seeded — not a bug. The admin panel already
  exists in full at `/admin/dashboard`.
- **Activation-reject fix:** `AdminActivations.jsx` sent `{admin_notes}`, backend
  validates `{reason}` → guaranteed 422. One-word key fix.
- **`docs/FCM_V1.1_SCOPE.md`** — full scope incl. Google-login-mobile (native
  `google_sign_in` → server-verify ID token → Sanctum bearer, reusing `SocialAccount`;
  explicitly NOT Firebase Auth).
- **Step 1:** `device_tokens` + `notifications` migrations, `DeviceToken`, `services.fcm`,
  `User` FCM routing, `DeviceTokenController` + `NotificationController` + routes.
  Feed returns the exact shape `lib/notifications.js` renders.
- **Step 2:** dependency-free `FcmService` (openssl RS256 JWT + `Http`), `FcmChannel`,
  `FcmNotification` base (database always + fcm when a token exists), 6 notifications
  (`ActivationApproved/Rejected`, `EnrolledInCourse`, `ResultReady`, `NewMock/SeriesPublished`),
  `FanOutContentNotification` job. Wired into 7 triggers.
- Fixed 2 stale tests (`PhaseA0FixesTest` asserted base `VerifyEmail`/`ResetPassword`;
  registration now sends the `Queued*` subclasses from prior commit `f95801e`).

**Why it's built this way.** `FcmService` is dependency-free (no composer package, no
Docker rebuild) and **no-ops until `FIREBASE_CREDENTIALS` is set** — mirrors
`GooglePlayController`'s "inert until configured", so the backend deploys safely ahead
of the secret and the Flutter client. One `FcmNotification` base fans every event out
to `database` (in-app feed) + `fcm` (push, only when a token exists). `ResultReady`
fires at the end of `ComputeTestAnalytics`, not in `submit()`, because the score does
not exist yet at submit. Google login reuses the existing Socialite/`SocialAccount` +
Sanctum machinery rather than standing up a second identity store in Firebase Auth.

**Verified.** Full backend suite **139 passed** (`php artisan test`, sqlite `:memory:`).
New: `NotificationApiTest` 6/6, `FcmNotificationTest` 5/5 (approve/reject/redeem fire
their notifications, fan-out skips inactive enrollees, `via()` adds fcm only with a
token). **Not verified:** no real FCM device send (no service account configured); the
two migrations have never run on prod; the reject fix is unproven against a live admin
session; the feed endpoint has no frontend consumer yet.

**Left open.** Set `FIREBASE_CREDENTIALS`/`FIREBASE_PROJECT_ID` on the server; Flutter
client (token register + tap deep-link); point frontend `fetchNotifications()` at the
new endpoint; Google-login endpoint `/mobile/social/google` (scoped, not built); the
zero-mock launch itself (seed content in `/admin/dashboard`, then `VITE_USE_DEMO_DATA=false`).

**Surprises.** The "mock data" was never a bug. Super-admin is a superset of admin (no
separate login needed). The 2 red tests predated this session — a consequence of the
committed `QueuedVerifyEmail` work, not these changes. `submit()` doesn't score inline;
`ComputeTestAnalytics` does, async.
