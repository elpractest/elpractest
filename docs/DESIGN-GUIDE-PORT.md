# Porting the Android app onto the deep-ink + gold guide

_Started 2026-08-12. This file exists because the work is half done and the
half that is left is not obvious from the diff._

## What happened, in one paragraph

There are **two** design guides, twelve hours apart, and they are different
directions rather than successive drafts:

| File | Written | Palette | Type |
|---|---|---|---|
| `E:\vpd\apps\Practest Redesign Guide.dc.html` | 2026-08-12 05:09 | teal `#009090` / orange `#F07830` | Space Grotesk + Inter |
| `E:\vpd\apps\Practest App.dc.html` | 2026-08-12 17:59 | deep ink `#0B0F1A` / gold `#F5A623` | Sora + Plus Jakarta Sans + Noto Sans Devanagari |

The **web SPA (`app/`) was rebuilt against the newer guide the same evening**
(`app/src/index.css` and friends, 18:31–19:58). The **Android app was not** — its
only post-guide commits were the promo carousel, and the release APK built at
20:40 came from pre-guide source. This port closes that gap.

## The reference implementation is the web app, not the mockup

Port from `app/src/`, not from the `.dc.html`. The web already resolved the
places where the mockup asks for something the backend cannot do, and matching
its resolutions is what keeps the two surfaces one product:

- **Login.** The mockup draws mobile + OTP. The API's `/otp/send` and
  `/otp/verify` sit **inside** the `auth:sanctum` group (`api/routes/api.php`),
  so they are phone *verification* for an already-signed-in user, not a login.
  OTP-as-login needs new unauthenticated endpoints that issue a token. The web
  kept **email + password** and added only the EN/हिं pill. Owner confirmed the
  Android app does the same.
- **Notifications.** No backend. The web *derives* the feed from
  `/api/student/results` + `/api/student/activation-requests` and tracks
  last-seen locally (`app/src/lib/notifications.js`). Port that, with
  SharedPreferences standing in for localStorage.
- **Store.** An explicit no-backend stub, flagged as such in
  `app/src/components/BottomNav.jsx`. Ship it as a stub; do not invent a
  storefront.
- **AI Guru** is **Vajini** here, and it is real: `POST /api/vajini/chat`,
  throttled, and it returns **503 when the OpenAI key is unconfigured** — handle
  that state explicitly rather than as a generic error.
- **CBT palette** is marked `DO NOT EDIT` in both codebases and already matched
  hex for hex. Leave it alone.

## Done and verified

`flutter analyze` clean (8 pre-existing lints, untouched files) and **59/59
tests pass** after each step below.

1. **Tokens** — `lib/theme.dart` `AppColors.dark`/`.light` are now a port of
   `app/src/index.css`. Added `secondary`, `secondarySoft`, `nav`, `chrome`;
   added `tint(hue, isDark)` + `TintHue`, the port of the web's `TINTS`; added
   `AppTheme.goldGradient` / `violetGradient`.
2. **Type** — Sora (display), Plus Jakarta Sans (UI), Noto Sans Devanagari
   (हिं), JetBrains Mono kept. Inter and Space Grotesk deleted. Static
   per-weight instances, **not** variable fonts — pointing several weights at
   one variable file silently renders the default instance for all of them.
   Every Latin style carries `fontFamilyFallback: AppFont.fallback`.
3. **Brand + launcher icon** — `assets/brand/*` are now byte-identical to what
   the web serves (`app/src/assets/logo-mark.png`, `logo-full.png`). Launcher
   icons regenerated at all five densities, adaptive + legacy + round, on a
   **white** ground.
4. **Splash** — rebuilt to the guide.

### Two reversals worth knowing about

- **`BrandMark` is now plated on white**, which the old comment in
  `lib/widgets.dart` called "the one thing the brand rules forbid". That rule
  was right about the old artwork — a near-white silhouette. The current mark's
  mortarboard and pencil tip are **solid black**, so on `#0B0F1A` they vanish
  and the P reads as a broken amber hook. The guide plates it everywhere for
  this reason. `practest-logo-knockout.png` is deleted: the new wordmark is
  solid black and has nothing to knock out of.
- **`orange` no longer means anything of its own.** The old system gave three
  hues one job each; the new guide has no teal and no orange, and makes gold
  both brand and achievement. `orange` survives as an alias for the amber
  warning family so its ~12 call sites keep compiling. The one place that
  genuinely meant "time" — the CBT countdown — should move to `danger`, which
  is where the guide draws it. **Not yet done.**
  The `each hue owns exactly one job` test was replaced by
  `gold is legible wherever it carries meaning`, which asserts the contrast rule
  that took its place (flat `#F5A623` is ~1.9:1 on white and may never carry
  text; `onBrand` must be the dark ink, never white).

## Not done

In rough order of visibility:

1. **Welcome/intro** — hero image + scrim, `EXAM-ACCURATE CBT` badge, headline,
   Hindi subline, EN/हिं toggle, gold Get Started. Needs a hero photograph that
   does not exist in the repo yet.
2. **Login restyle** — brand tile, "Welcome back". Keep email + password.
3. **EN/हिं language layer** — port the strings from `app/src/lib/i18n.js`;
   persist the choice. Scope agreed with the owner: splash, welcome, login, nav
   and brand copy. API-sourced text stays as the server sends it.
4. **Five tabs + Vajini FAB.** `lib/shell.dart` is four tabs and carries a
   documented argument *against* a fifth ("three of its tabs were subscription
   products rather than places"). The new guide supersedes it — record that in
   the comment rather than deleting the reasoning.
5. **Vajini chat screen**, **notifications**, **search**, **store stub**.
6. **Home** — goal selector, quick modes, Continue card, Explore by exam,
   scholarship strip. The promo carousel is already there and already real.
7. **CBT countdown → `danger`** (see above).

## Building

Release builds **must** carry the API base or they point at the emulator
loopback and cannot reach production:

```bash
flutter build apk --release --dart-define=API_BASE_URL=https://api.practest.live/api
```

Flutter SDK is at `C:\flutter` and is not on PATH.
