# Paste this into Claude Code

Run Claude Code from the repo root (`elpractest/elpractest`) and paste the block below.

---

You are working in the Flutter app at `e-Learning_Practest Android app/`.

**Context, and please verify it before you change anything.** `lib/theme.dart` is already an accurate port of the deep-ink + gold design guide — every hex, both palettes, the tint map, the type scale, the CBT palette. Do not retheme it. The problem is that the port stopped after tokens, fonts, brand assets and the splash: every screen below that still renders the layout designed for the previous teal system. Confirm this for yourself by grepping for these four token names across `lib/` — they are declared in theme.dart and referenced by zero widgets:

```
AppTheme.goldGradient
AppText.hero
AppColors.chrome
AppColors.nav
```

`docs/DESIGN-GUIDE-PORT.md` in this repo ends with a "Not done" list. That list is the work. Read it, and read `RESTYLE_NOTES.md` — the **web SPA at `app/src/` is the reference implementation**, not the mockup, because it already resolved the places where the design asks for something the backend cannot do. Port from the web.

**Four patches are supplied in `design_handoff_practest_android/dart/`.** They are written against this codebase's real APIs (`useColors`, `AppColors`, `AppText`, `AppTheme`, `Routes`, `SurfacePanel`, `EmptyState`) and are meant to be moved into `lib/`, not vendored. Apply them in this order, running `flutter analyze` and `flutter test` after each:

1. `practest_guide_widgets.dart` → `lib/practest_guide_widgets.dart`.
   Then migrate call sites: replace `PrimaryButton` with `GoldButton` on every screen's primary action (one per screen — the glow is what makes it primary, so a second glowing button on a screen is a bug), `SecondaryButton` with `GhostButton` where the guide draws the quiet action, and `SurfacePanel` with `GuideCard` so cards land on 20px instead of 14px. Repoint `AppHeader`'s flat `c.bg` fill at `ChromeHeader`.

2. `i18n.dart` → `lib/i18n.dart`.
   Register `I18n.instance` in the `MultiProvider` in `lib/app.dart` and `await I18n.instance.init()` in `main.dart` before `runApp`. Scope is splash, welcome, login, nav and brand copy only — API-sourced text stays as the server sends it.

3. `welcome_screen.dart` → `lib/screens/welcome_screen.dart`, replacing `intro_screen.dart` at the `AuthStatus.unauthenticated` branch of `RootGate`. Delete `intro_screen.dart` once it is unreferenced. Add `assets/hero/` to pubspec assets.

4. `shell_five_tab.dart` → `lib/shell.dart`, replacing it. Keep the four-tab reasoning in the comment rather than deleting it, per the port doc's own instruction. `HomeShell.series`/`.results`/`.profile` indices change — grep for `HomeShell.go(` and fix every call site.

**Then, still not done, in visibility order:**

- **Home** (`lib/screens/home_screen.dart`) — rebuild to the guide's order: goal selector → promo carousel → four quick-mode tiles → Continue card → Explore-by-exam 8-grid → popular-series carousel → scholarship strip. The promo carousel is already correct; leave it. Port the order from `app/src/pages/Dashboard.jsx`.
- **Login** (`lib/screens/auth/login_screen.dart`) — restyle only. Radial `#12203A` ground, 40dp rounded back tile, EN/हिं pill, 16px field radii, `GoldButton` submit. **Keep email + password.** The mockup draws mobile + OTP but `/otp/send` sits inside `auth:sanctum` (`api/routes/api.php`), so it is verification for a signed-in user, not a login. The web made the same call.
- **CBT countdown** — move from `c.orange` to `c.danger`. `orange` is now only an alias for the amber warning family and means nothing of its own. Do not touch `CbtStatus`; it is marked DO NOT EDIT in both codebases and already matches hex for hex.
- **Result / Test list / Leaderboard / Profile** — restyle via the primitives. Result additionally wants the score hero in `AppText.scoreHero` (42px mono, solid ink, never a gradient) and subject-wise accuracy bars.
- **Icons** — the guide draws lucide-style 2.2px strokes throughout; the app draws Material rounded fills. Add `lucide_icons` to pubspec and swap. `shell_five_tab.dart` names the lucide glyph for each tab in a comment.

**Rules for this work:**

- Visual only. Do not change routing, auth, API calls, the CBT engine's handlers, or state management. `RESTYLE_NOTES.md` describes the same constraint holding on the web side.
- Never introduce a colour that is not in `AppColors`. If something seems to need one, it is the wrong token, not a missing one.
- `#F5A623` is ~1.9:1 on white and may never carry text or a glyph — use `brandBright` (`#A85F00` on light). `onBrand` is the dark ink, never white.
- Never a border and a shadow on the same surface. Dark carries a hairline; light carries one soft ambient shadow.
- `flutter analyze` must stay clean (8 pre-existing lints in untouched files are expected) and all 59 tests must pass.

Release builds must carry the API base:

```bash
flutter build apk --release --dart-define=API_BASE_URL=https://api.practest.live/api
```
