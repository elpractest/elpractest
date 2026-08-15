# Journal

Append-only session history for Practest. Newest first, directly below this block.
Each entry: **Goal / Done / Why it's built this way / Verified / Left open / Surprises.**
"Where we are right now" lives in STATE.md, not here.

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
