# Current state

Where Practest work stopped. Keep short and current — history goes in JOURNAL.md.

_Last updated: 2026-08-15_

## In flight

**FCM push + in-app notifications, v1.1** — **committed on `deploy/coolify`,
UNPUSHED, not deployed.** A push to `deploy/coolify` is the prod deploy. All
deploy-safe: the backend FCM sender no-ops until `FIREBASE_CREDENTIALS` is set.

- Backend (`c1aa786`, `794f051`): device-token + in-app feed endpoints, `FcmService`
  (dependency-free HTTP v1, prunes dead tokens), channel, 6 notifications wired into
  7 triggers, chunked fan-out job. Suite 139 pass.
- Frontend feed (`251c7f6`): `app/src/lib/notifications.js` consumes
  `GET /student/notifications` with a fallback to the old client-derived feed if the
  endpoint 404s. Needs an `app/` rebuild to take effect.
- **Flutter client (step 5):** `google-services.json` placed (project
  `practest-24732`), google-services Gradle plugin wired, `firebase_core` +
  `firebase_messaging` added, `PushService` registers the token on
  login/app-open/refresh and removes it on logout, `POST_NOTIFICATIONS` permission,
  push taps deep-link via a web→Flutter route mapper. `flutter analyze` clean; debug
  APK builds with Firebase compiled in.
- Activation-reject 422 fix (`7fce39a`).
- **Native Google sign-in (step 4):** `POST /mobile/social/google` verifies a
  Google ID token (dependency-free, Google tokeninfo) and issues a Sanctum bearer
  via a shared `SocialAuthService` (reused by the web callback); `/settings/public`
  now exposes `google_client_id`; the Flutter login button does native
  `google_sign_in` → exchange → `Session.mobileGoogleLogin`. Suite 146 pass; analyze
  clean; release APK builds. NOT Firebase Auth. **Committed?** see git log; still
  UNPUSHED with the rest.
- Scope: [docs/FCM_V1.1_SCOPE.md](../FCM_V1.1_SCOPE.md).

## Next step

Three things, all required before a real push reaches a phone:
1. Push `deploy/coolify` → deploys the notifications backend (+ reject fix).
2. On the api container, set `FIREBASE_CREDENTIALS_JSON` (paste the whole
   service-account JSON) + `FIREBASE_PROJECT_ID=practest-24732`. (Alternatively mount
   the JSON as a file and point `FIREBASE_CREDENTIALS` at its path.)
3. Ship a **release** app build (`--dart-define=API_BASE_URL=https://api.practest.live/api`,
   via build-release.ps1/.sh).

## Open / blocked

- **Nothing blocked.** Owner decisions: when to push/deploy; whether to add Google
  login now (native `google_sign_in` → verify → Sanctum, doc step 4, NOT built; do
  **not** add Firebase Auth).
- **Never verified live:** no real FCM device send (backend undeployed + no service
  account); the Flutter client compiles/builds but token-registration and tap
  deep-link are unproven on a device; the two backend migrations have never run on
  prod; the reject fix and the server-feed path are unproven against a live session.
- **Google login — final config (code done + deployed once pushed):** web login's
  `GOOGLE_CLIENT_ID` is `904862810932-…` (a DIFFERENT Google project). Mobile needs
  the Firebase project's (`practest-24732` / `688814926066`) web client, so it's
  decoupled: set **`GOOGLE_MOBILE_CLIENT_ID` = `688814926066-1b0pv343gn2lv6v9l3ltvfdtpqdef0ui.apps.googleusercontent.com`**
  on the api container (new key; leave `GOOGLE_CLIENT_ID` alone). `social_login_enabled`
  is already ON; SHA-1 `E1:F1:54:75:9E:E5:F2:5A:9B:BC:50:88:9A:35:C8:25:C2:03:6E:4E`
  is registered. Debug/release share the debug key's SHA-1 (no release keystore yet).
- **Zero-mock-data launch is not done.** The web app shows demo content because
  `USE_DEMO_DATA` defaults true AND the DB has no published content — not a bug. Seed
  courses/tests/series/banners via `/admin/dashboard`, then set
  `VITE_USE_DEMO_DATA=false` and rebuild `app/`.

## Prod facts worth not re-deriving

- Firebase project: **`practest-24732`**. Android package: `com.practest.practest_app`.
- Admin panel is the SPA at **`/admin/dashboard`** (one tabbed page). **Super-admin
  is a superset of admin** — no separate login needed.
- Seeded accounts: super-admin `thevinstitution@gmail.com`, admin
  `vsn.educare@gmail.com` (both seeded with a **default password** — rotate the admin
  one if unused). Student test acct: `vmedics.ps@gmail.com` (anant).
- **Store rule:** a course lists in the Store only when `Course.is_published=true`
  AND it has an `is_active` batch with `price_paise` set.
- Mobile auth = Sanctum bearer via `/mobile/login`; token in `shared_preferences`
  (`auth_token`). API base already includes `/api`; app paths are like
  `/student/device-tokens`.
- Backend tests run on sqlite `:memory:`, `QUEUE_CONNECTION=sync`. Full suite: 139 pass.
