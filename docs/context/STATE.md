# Current state

Where Practest work stopped. Keep short and current — history goes in JOURNAL.md.

_Last updated: 2026-08-15_

## In flight

**FCM push + in-app notifications, v1.1 (steps 1–2)** — code-complete on the
working tree, **uncommitted, not deployed**. All backend, all deploy-safe: the
FCM sender no-ops until `FIREBASE_CREDENTIALS` is set, so it can ship ahead of the
secret and the Flutter work.

- Migrations `device_tokens` + `notifications`, `DeviceToken` model, `services.fcm`
  config, `User::deviceTokens()`/`routeNotificationForFcm()`.
- Endpoints: `POST/DELETE /student/device-tokens`, `GET /student/notifications`
  (+`/unread-count`, `/read-all`, `/{id}/read`).
- `FcmService` (dependency-free: openssl RS256 JWT + `Http`, prunes dead tokens),
  `FcmChannel`, `FcmNotification` base, 6 notifications, `FanOutContentNotification`
  job, wired into 7 triggers.
- Scope: [docs/FCM_V1.1_SCOPE.md](../FCM_V1.1_SCOPE.md).

**Activation-reject fix** (`app/src/pages/AdminActivations.jsx`) — frontend sent
`{admin_notes}` but the backend validates `{reason}` → every reject was a 422.
One-word fix, uncommitted. Ships with the next `app/` build.

## Next step

Commit the FCM work (backend) + the reject fix (frontend) as separate commits.
Then either: set `FIREBASE_CREDENTIALS`+`FIREBASE_PROJECT_ID` on the Coolify server
and do the Flutter client (register token, deep-link on tap), **or** point the
frontend `fetchNotifications()` at `GET /api/student/notifications` so server-only
events (new mock, enrolment) show in-app.

## Open / blocked

- **Nothing blocked.** Owner decisions: when to deploy; whether to add Google login
  now (native `google_sign_in` → verify → Sanctum, scoped in the doc as step 4, NOT
  built; do **not** add Firebase Auth).
- **Never verified live:** no real FCM send (no service account configured); the two
  new migrations have never run on prod; the reject fix is unproven against a live
  admin session; the in-app feed endpoint has no frontend consumer yet (feed is
  still client-derived in `lib/notifications.js`).
- **Zero-mock-data launch is not done.** The web app shows demo content because
  `USE_DEMO_DATA` defaults true AND the DB has no published content — not a bug.
  Seed courses/tests/series/banners via `/admin/dashboard`, then set
  `VITE_USE_DEMO_DATA=false` and rebuild `app/`.

## Prod facts worth not re-deriving

- Admin panel is the SPA at **`/admin/dashboard`** (one tabbed page). **Super-admin
  is a superset of admin** — no separate login needed.
- Seeded accounts: super-admin `thevinstitution@gmail.com`, admin
  `vsn.educare@gmail.com` (both seeded with a **default password** — rotate the admin
  one if unused). Student test acct: `vmedics.ps@gmail.com` (anant).
- **Store rule:** a course lists in the Store only when `Course.is_published=true`
  AND it has an `is_active` batch with `price_paise` set.
- Release APK (all signup fixes): 63.4 MB at
  `e-Learning_Practest Android app/build/app/outputs/flutter-apk/app-release.apk`.
- Backend tests run on sqlite `:memory:`, `QUEUE_CONNECTION=sync` — notifications
  fire synchronously in tests, FCM channel no-ops (no creds). Full suite: 139 pass.
