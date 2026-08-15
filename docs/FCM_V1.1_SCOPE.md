# FCM Push + In-App Notifications — v1.1 Backend Scope

_Status: scoped, foundation stubbed (migrations + model + config). Not wired._
_Owner surface: `api/` (Laravel) + the Flutter Android app. Web SPA already has the
Notifications screen and only needs the feed endpoint._

## 1. The core idea — don't build a bespoke push system

Use Laravel's **Notification fan-out**. One notification class emits to two channels
at once:

- `database` → writes a row to the `notifications` table → feeds the **in-app
  Notifications screen** (already built: [`app/src/pages/Notifications.jsx`](../app/src/pages/Notifications.jsx),
  expecting `{ title, body, time, hue, icon, read }`).
- `fcm` (custom channel) → the actual push to the device.

`via()` returns `['database','fcm']`, but **drops `fcm` when the user has no
registered device token** — so web-only users still get the in-app feed with zero
wasted sends.

```
Event (approve / publish / submit)
        │
        ▼
  Notification class ──via()──►  [ database ] → notifications table → GET /student/notifications  (bell + feed)
                                 [ fcm ]      → FCM HTTP v1 → device → tap → deep-link (data.route)
```

## 2. Reuse — what already exists

| Already there | Why it matters |
|---|---|
| `User` has the `Notifiable` trait ([User.php:16](../api/app/Models/User.php)) | Notifications work out of the box. |
| Queue = `database` + a live worker ([config/queue.php:16](../api/config/queue.php)) | Push jobs ride the same rail as `QueuedVerifyEmail`. Nothing new to run. |
| Notifications screen built, shape known ([demoData.js:122](../app/src/lib/demoData.js)) | The feed endpoint just returns `{title, body, time, hue, icon, read}`. |
| `GooglePlayController` "inert until configured" pattern ([api.php:259](../api/routes/api.php)) | **Mirror it**: the FCM channel no-ops when unconfigured, so code deploys safely before secrets land. |
| Sanctum bearer auth for mobile ([MobileAuthController](../api/app/Http/Controllers/Auth/MobileAuthController.php)) | Device-token + Google-login endpoints slot into the existing token model. |

## 3. Data model (2 migrations — STUBBED)

| Table | Columns | Notes |
|---|---|---|
| `device_tokens` | `id, user_id→users (cascade), token (unique), platform (android/ios/web), last_used_at, timestamps` | Unique on `token`; a token reassigns to the newest owner on register (shared device). |
| `notifications` | Laravel standard — `uuid id (pk), type, notifiable morph, data json, read_at, timestamps` | Backs the in-app feed + unread badge. |

`User` gains `deviceTokens()` hasMany + `routeNotificationForFcm()` (returns the
user's token strings). **Stubbed** in this pass.

## 4. Config & secrets (FCM HTTP v1 — NOT legacy server keys)

- Package: **`laravel-notification-channels/fcm`** (wraps `kreait/firebase-php`,
  HTTP v1 + OAuth). Legacy server keys are deprecated — do not use them.
- `config/services.php` → `fcm` block (**stubbed**) reads a **service-account JSON
  path** from `FIREBASE_CREDENTIALS`. Store the JSON as a server secret/volume;
  **never commit it** (same discipline as prior leaked-cred cleanup).
- The channel guards on config presence → returns without sending when unset
  (GooglePlay pattern). Deploying the backend before the secret lands is safe.

## 5. Endpoints to add (student group)

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/student/device-tokens` | Register/refresh token on login & on FCM `onTokenRefresh`. Upserts, reassigns owner. |
| `DELETE` | `/student/device-tokens` | Remove on logout (wire into existing `/logout` + `/mobile/logout`). |
| `GET` | `/student/notifications` | Paginated feed → maps `data` json to `{title,body,time,hue,icon,read}`. |
| `GET` | `/student/notifications/unread-count` | Bell badge. |
| `POST` | `/student/notifications/{id}/read` · `/read-all` | Mark read. |

The feed endpoint is what lets you flip `VITE_USE_DEMO_DATA=false` on the
Notifications screen with real data behind it.

## 6. Notification classes → trigger points (the v1.1 surface)

Each defines `toDatabase()` (title/body/hue/icon/route) + `toFcm()` (notification +
`data.route` for deep-linking). hue/icon values match the frontend demo mapping.

| Notification | Fires at | hue / icon | Deep-link |
|---|---|---|---|
| `ActivationApproved` | `ActivationRequestController::approve` ([:96](../api/app/Http/Controllers/Admin/ActivationRequestController.php)) | gold / key | course outline |
| `ActivationRejected` | `reject` | red / x-circle | activation screen |
| `ResultReady` | `TestTakingController::submit` (after scoring) | green / check-circle | result screen |
| `NewMockPublished` | `TestController::publish` ([:198](../api/app/Http/Controllers/Admin/TestController.php)) | blue / target | test |
| `NewSeriesPublished` | `TestSeriesController::publish` ([:100](../api/app/Http/Controllers/Admin/TestSeriesController.php)) | blue / target | series detail |
| `EnrolledInCourse` | code redeem + manual enrollment | gold / graduation-cap | course outline |

These map 1:1 to the empty-state promise: _"Result alerts, new mocks and activation
updates."_

## 7. Fan-out strategy (the one real scaling concern)

`publish()` on a popular series may notify **thousands** of enrolled students. Do not
loop inline:

- `publish` dispatches a **`FanOutPublishNotification` job** → `chunkById` over the
  batch/course's enrolled users → `Notification::send($chunk, …)` (each send itself
  queued). Bounded memory, retry-safe.
- Approve / reject / result are single-recipient → notify directly (still queued).

## 8. Delivery hardening

- **Prune dead tokens:** FCM `UNREGISTERED` / `InvalidArgument` → delete that
  `device_tokens` row so the list stays clean.
- **Multicast** per user (one call, all their tokens).
- **No sensitive data** in payloads (scores fine; no tokens/PII).
- **Preferences** (per-category mute): defer to v1.2 unless wanted now.

## 9. Flutter client contract (so backend & app agree up front)

The app must: request POST_NOTIFICATIONS permission (Android 13+), fetch the FCM
token on login and on `onTokenRefresh`, `POST /student/device-tokens`, `DELETE` on
logout, and on tap read `data.route` to deep-link. Handing the app team this contract
now is what keeps v1.1 from stalling on integration.

## 10. Google Sign-In in the Flutter app — decision + scope

**Recommendation: add Google login, but do NOT add Firebase Auth.** Firebase Auth
would stand up a *second* identity store next to your Laravel/Sanctum users and force
a bridge. You already have the full social-login machinery — reuse it.

**Existing pieces:** `SocialAuthController` (Socialite web redirect), `SocialAccount`
model (`provider`, `provider_id` link), Google OAuth creds in
[`config/services.php`](../api/config/services.php) (`google` block), and the Sanctum
bearer pattern in `MobileAuthController`.

**Chosen flow — native token exchange (one identity system):**

```
Flutter: google_sign_in → Google ID token
        │ POST /mobile/social/google { id_token }
        ▼
Backend: verify ID token with Google  →  find SocialAccount(provider=google, provider_id)
         else find User by email  →  else create User + assignRole('student') + link SocialAccount
         →  issue Sanctum bearer token  (identical to MobileAuthController::login response)
```

- **New endpoint:** `POST /mobile/social/google` (public, throttled like
  `/mobile/login`). Verifies the Google **ID token** server-side (via
  `google/apiclient` `verifyIdToken`, or `kreait/firebase-php` if you route through a
  Firebase project), then runs the **same link-or-create logic** already in
  `SocialAuthController::callback` (extract it into a shared service so web + mobile
  don't drift), and returns a bearer token.
- **Synergy with FCM:** you're adding Firebase for push anyway, so
  `google-services.json` will already be present — which conveniently supplies the
  OAuth client config `google_sign_in` needs on Android. You still don't use Firebase
  **Auth**; you only benefit from the config file being there.
- **Client contract:** `google_sign_in` (request an ID token / server client id),
  send `id_token` to the endpoint, store the returned bearer token exactly like the
  email/password path.
- **Do NOT:** create Firebase Auth users, verify Firebase custom tokens, or let the
  device be the source of truth for identity. The server verifies the Google token and
  owns the session.

## 11. Testing (feature-level)

- Token register upserts & reassigns owner; logout deletes it.
- `via()` = `['database']` with no token, `['database','fcm']` with one.
- Each event writes a `notifications` row with the right `data`.
- `publish` fan-out enqueues N sends (`Notification::fake()`).
- `UNREGISTERED` response prunes the token.
- Google login: valid ID token links/creates + returns bearer; invalid token → 401;
  existing-email links rather than duplicates.

## 12. Phasing & rough size

1. **Foundation** — migrations, config, channel, token + feed endpoints. ~1 day.
   _Ship-able alone: lights up the in-app feed even before push works._ **(stubbed)**
2. **Notification classes + triggers** — 6 classes wired into the 6 points. ~1 day.
3. **Fan-out job + token pruning + tests** — ~0.5–1 day.
4. **Google Sign-In endpoint + shared link-or-create service + tests** — ~0.5 day.
5. **Wire Flutter + real-device send test** — dependent on app team.

**Deploy-safety:** steps 1–4 are inert until `FIREBASE_CREDENTIALS` / Google creds are
set (GooglePlay pattern), so the backend can merge and deploy ahead of the Flutter
work with zero prod risk.
