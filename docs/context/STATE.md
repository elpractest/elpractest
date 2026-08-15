# Current state

Where Practest work stopped. Keep short and current — history goes in JOURNAL.md.

_Last updated: 2026-08-15_

## In flight

**FCM push + in-app notifications, v1.1 (steps 1–2)** — **committed on
`deploy/coolify`, UNPUSHED, not deployed.** A push to `deploy/coolify` is the prod
deploy. All deploy-safe: the FCM sender no-ops until `FIREBASE_CREDENTIALS` is set.

- Backend (`c1aa786` stale-test fix, `794f051` FCM): device-token + in-app feed
  endpoints, `FcmService` (dependency-free HTTP v1, prunes dead tokens), channel,
  6 notifications wired into 7 triggers, chunked fan-out job. Suite 139 pass.
- Frontend feed wiring: `app/src/lib/notifications.js` now consumes
  `GET /student/notifications` (server-authoritative, server-tracked unread), with an
  automatic fallback to the old client-derived feed if the endpoint 404s. Takes
  effect on the next `app/` rebuild. Lint + `vite build` clean.
- Activation-reject 422 fix (`7fce39a`, `AdminActivations.jsx`) — reject now posts
  `{reason}` not `{admin_notes}`.
- Scope: [docs/FCM_V1.1_SCOPE.md](../FCM_V1.1_SCOPE.md).

## Next step

Push `deploy/coolify` to deploy (ships backend + reject fix; the frontend feed change
needs an `app/` rebuild/redeploy). Then set `FIREBASE_CREDENTIALS`+`FIREBASE_PROJECT_ID`
on the Coolify server and do the Flutter client: register the token to
`/student/device-tokens`, delete on logout, deep-link on tap via `data.route`.

## Open / blocked

- **Nothing blocked.** Owner decisions: when to push/deploy; whether to add Google
  login now (native `google_sign_in` → verify → Sanctum, doc step 4, NOT built; do
  **not** add Firebase Auth).
- **Never verified live:** no real FCM device send (no service account configured);
  the two new migrations have never run on prod; the reject fix and the server-feed
  path are unproven against a live session (against current prod the frontend uses
  only the *fallback* path, since the backend endpoint isn't deployed yet).
- **Zero-mock-data launch is not done.** The web app shows demo content because
  `USE_DEMO_DATA` defaults true AND the DB has no published content — not a bug. Seed
  courses/tests/series/banners via `/admin/dashboard`, then set
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
