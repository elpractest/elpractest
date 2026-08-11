# Android app — state, build, and release

> Last updated: **2026-08-11**. Covers `e-Learning_Practest Android app/`.
> The July handover (`docs/SESSION-HANDOVER.md` §6.7) planned a **Capacitor wrap**.
> That is not what exists. The app is a **native Flutter client** that talks to the
> same Laravel API. Treat §6.7 of that document as superseded.

---

## 1. What it is

A Flutter (Dart) app, package `com.practest.practest_app`, label **Practest**.
It is a **student-only** client — there is no admin or super-admin surface in it.
It authenticates with a Sanctum **bearer token**, not the cookie session the web
SPA uses, via `POST /api/mobile/login` (`MobileAuthController`, already live).

Screens present and wired to the API:

| Area | Endpoints used |
|---|---|
| Auth | `/mobile/login`, `/mobile/logout`, `/me`, `/register`, `/forgot-password`, `/reset-password`, `/email/verify/{id}/{hash}`, `/email/resend` |
| Discovery & activation | `/courses/public`, `/student/activation-requests` (incl. multipart proof upload) |
| LMS | `/student/courses`, `/student/courses/{id}/outline`, `/student/lessons/{id}` |
| CBT engine | `/student/tests`, `/student/tests/{id}/start`, `/student/tests/sessions/{id}`, `…/palette`, `…/advance-section`, `…/answers/{q}/visit`, `…/submit`, `…/result` |
| Test series | `/student/test-series`, `/student/test-series/{id}` |
| Results | `/student/results` |
| Checkout | `/student/checkout/*` — **disabled in Play builds, see §4** |

Ahead of all of that sit two screens that talk to nothing: an animated
**splash** (`lib/screens/splash_screen.dart`) and the logged-out **intro**
(`lib/screens/intro_screen.dart`). `RootGate` in `app.dart` plays the splash
once on launch and then cross-fades to the intro or, for a restored session,
straight to the dashboard. Login and register are now *pushed on top of* the
intro rather than being the root — which is why `login_screen.dart` unwinds the
navigator with `popUntil(isFirst)` after a successful login. Remove that and the
dashboard renders underneath a still-visible login form.

The intro's feature copy is deliberately restricted to things the app actually
does. If a feature is cut, cut its card.

**The day/night toggle used to be backwards.** `MaterialApp`'s `theme` is the
*light* slot and `darkTheme` the dark one; `app.dart` had the two palettes
crossed, so `ThemeMode.dark` resolved to `AppColors.light` and the toggle did
the opposite of what its sun/moon icon promised. Since `ThemeController`
defaults to dark, a fresh install opened in the light palette. Fixed — but it
means every screen now looks different from how it looked before 2026-08-11,
and none of them have been reviewed in the dark palette they were designed for.

Feature coverage is essentially complete. What has never happened is a build that
points at production: see §6.

---

## 2. Toolchain

The project was authored on another machine (`android/local.properties` still
pointed at `C:\Users\Akhil\…` when it arrived here). `local.properties` is
machine-local and git-ignored — every machine sets its own.

- **Flutter 3.44.x** or newer. `pubspec.yaml` requires Dart `^3.12.2`; Flutter
  3.29 ships Dart 3.7 and fails to resolve. This machine: `C:\flutter`.
- **Android SDK** with platform 36 + build-tools 36. This machine:
  `C:\Users\thevi\AppData\Local\Android\Sdk`.
- **JDK 17+**. This machine: `C:\Program Files\Microsoft\jdk-21.0.10.7-hotspot`.
- `targetSdk`/`compileSdk` are 36 and `minSdk` 24, inherited from the Flutter
  Gradle plugin. 36 is what Google Play currently requires.

Baseline on a clean tree: `flutter analyze` → 5 info-level lints (deprecated
`withOpacity`, one `use_null_aware_elements`), **no errors**. `flutter test` →
**7 passing**.

---

## 3. Configuration switches

Both are compile-time `--dart-define`s. There is no runtime settings screen.

### `API_BASE_URL`

```dart
// lib/api_client.dart
const String apiBaseUrl = String.fromEnvironment(
  'API_BASE_URL', defaultValue: 'http://10.0.2.2:8000/api');
```

**The default is a dev server and it is baked into the binary.** Forgetting the
define does not fail the build — it produces an app that silently cannot reach
anything. The release APK found in `build/` on 2026-08-10 had
`http://192.168.0.100:8000/api` compiled in, i.e. someone's LAN. Always pass:

```
--dart-define=API_BASE_URL=https://api.practest.live/api
```

To confirm after the fact, unzip the artifact and grep the AOT snapshot:
`lib/arm64-v8a/libapp.so` contains the URL as a plain string.

### `ENABLE_IN_APP_PURCHASE`

Off by default. See §4.

---

## 4. Why in-app purchase is off (`lib/build_config.dart`)

Google Play requires **Google Play Billing** for purchases of in-app digital
content. Selling course access through Razorpay inside the app is a billing-policy
violation and a routine cause of rejection or suspension. The July plan already
said billing would be kept off-app; the Flutter app had shipped it on anyway.

`enableInAppPurchase` is a `bool.fromEnvironment` that defaults to **false**, and
it gates both the fetch of purchasable courses and the render of the purchase
section in `dashboard_screen.dart`. The server's own `payment_gateway_enabled`
setting can now only ever turn buying *off* in the app, never on. Students on the
Play build activate with an **admin-issued activation code**, which is the flow
the platform was designed around. The web SPA at `app.practest.live` is untouched
and keeps its Razorpay checkout.

The `razorpay_flutter` native SDK is still linked into the APK — the gate removes
reachability, not the dependency.

For a side-loaded build that may sell:
`--dart-define=ENABLE_IN_APP_PURCHASE=true`.

---

## 5. Release build

### One-time: create the upload key

Never done yet. `android/key.properties` is absent, so **release currently falls
back to the debug key** and the build prints a warning saying so. Play rejects
debug-signed uploads.

```
keytool -genkey -v -keystore practest-upload.jks -storetype JKS \
  -keyalg RSA -keysize 2048 -validity 10000 -alias practest-upload
```

Keep the `.jks` **outside the repo** and the passwords in the password manager;
losing the upload key means you cannot ship an update to the same listing without
a Google-side key reset. Then copy `android/key.properties.example` to
`android/key.properties` and fill it in — both the file and `*.jks` are
git-ignored.

### Build

```
flutter build appbundle --release --dart-define=API_BASE_URL=https://api.practest.live/api
```

`appbundle` (`.aab`) is what Play takes; `apk` is for side-loading and testing.
Output lands in `build/app/outputs/bundle/release/app-release.aab`.

### Verifying on the emulator

`adb shell screencap` returns a **pure black frame** for this app on the
emulator. The app is rendering fine — the Flutter engine logs a VM service URL,
sends viewport metrics and throws no Dart errors — but Impeller's surface does
not come back through `screencap`. Every screenshot-based check silently
"fails" the same way, and it looks exactly like a crash.

The debug manifest therefore sets
`io.flutter.embedding.android.EnableImpeller=false`, so debug builds render with
Skia and can be screenshotted. Release builds keep Impeller. If you ever see an
all-black capture, check that meta-data before believing the app is broken.

Two more emulator notes: it sleeps its display and then every capture is black
for the ordinary reason, so set `adb shell svc power stayon true` first; and if
the emulator process dies it leaves `hardware-qemu.ini.lock` and
`multiinstance.lock` behind in `~/.android/avd/<name>.avd`, after which it
refuses to start again (exit 255) until you delete them.

### Manifest facts worth knowing

- `usesCleartextTraffic` was moved out of the main manifest into
  `src/debug/AndroidManifest.xml`. Debug builds can still hit a plain-http dev
  server; release builds cannot make a cleartext request at all.
- `android:allowBackup="false"` — the auth token lives in SharedPreferences.

---

## 6. Open items

1. **Nothing has been verified against production.** No build has ever pointed at
   `api.practest.live`. Login → course → start test → submit → result needs a real
   run on a device before this goes anywhere near Play.
2. **Imunify360 bot-protection on the cPanel host** answers non-browser clients
   with `403 {"message":"Access denied by Imunify360 bot-protection…"}`. It fired
   for every request from a machine on Cloudflare WARP, regardless of user agent.
   Ordinary mobile traffic will most likely pass, but this has **not** been
   proven, and it is exactly the failure mode that would make the app look broken
   for a subset of users. The app now sends `User-Agent: PractestApp/1.0.0
   (Android)` so the host has something stable to whitelist.
3. **The app is untracked in git.** `git status` shows the whole directory as
   untracked. About 55 files / 0.6 MB would be added; `build/` and `.dart_tool/`
   are correctly excluded.
4. **Play listing assets** do not exist: feature graphic (1024×500), phone
   screenshots, short + full description, content rating questionnaire, and the
   Data safety form (the app collects name, email, phone). The privacy policy at
   `https://practest.live/privacy` exists but predates the app and should be
   reviewed to cover it.
5. **`test/` holds 7 tests**, around math rendering and the boot sequence. There
   is no test of the API client, the session, or the test-taking flow. Note the
   comment in `widget_test.dart`: never `pumpAndSettle` this app — the aurora
   backdrop animates forever, so there is no settled state and the call hangs
   until it times out. Advance with explicit `pump(Duration)`.
6. **The brand asset is generated, not drawn.** `assets/logo.png` is the
   white-background `logo.png` at the project root with the white keyed out and
   the mark flattened to `#308FD7`. The root file remains the source for the
   launcher icon. If the logo is ever redrawn, regenerate the asset — a
   white-background PNG on the dark theme looks like a bug.
