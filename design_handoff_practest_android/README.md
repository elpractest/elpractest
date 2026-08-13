# Handoff: Practest Android — design-guide port

## Overview

The Flutter Android app at `e-Learning_Practest Android app/` does not match the deep-ink + gold design guide that the web SPA (`app/`) was rebuilt against on 2026-08-12. This bundle contains the audit of why, four drop-in Dart patches, and a derived brand asset.

**Start with `PROMPT.md`** — it is written to be pasted directly into Claude Code running at the repo root.

## About the design files

`Practest UI Gap Audit.dc.html` and `Practest Logo Usage.dc.html` are **design references written in HTML** — they document findings and show artwork in context. They are not code to port.

The `dart/` files are different: they are **real Dart written against this codebase's own APIs** (`useColors`, `AppColors`, `AppText`, `AppTheme`, `Routes`, `SurfacePanel`, `EmptyState`) and are meant to be moved into `lib/` and compiled, not treated as a mockup.

## Fidelity

**High-fidelity.** Every value traces to `lib/theme.dart` or to the guide's own source, and both are quoted in the audit. The one thing that is *not* pinned is the welcome hero photograph, which does not exist in the repo yet.

## Root cause, in one line

The token layer landed and the screen layer did not. `AppTheme.goldGradient`, `AppText.hero`, `AppColors.chrome` and `AppColors.nav` are declared in theme.dart and referenced by zero widgets — those four are the guide's gold CTA, its 33px display headline, its branded header and its translucent tab bar.

## Files in this bundle

| File | What it is |
|---|---|
| `PROMPT.md` | The work order. Paste into Claude Code. |
| `dart/practest_guide_widgets.dart` | Primitives: `GoldButton`, `GhostButton`, `EyebrowPill`, `ChromeHeader`, `GuideCard`, `TickedClaim`. Highest leverage — repaints every screen. |
| `dart/i18n.dart` | EN/हिं layer, persisted to SharedPreferences, strings ported from `app/src/lib/i18n.js`. |
| `dart/welcome_screen.dart` | Welcome rebuilt to the guide. Replaces `intro_screen.dart`. |
| `dart/shell_five_tab.dart` | Five tabs, `nav` ground, flagged Store stub. Replaces `shell.dart`. |
| `assets/practest-logo-dark.png` | Derived dark-surface lockup. |
| `Practest UI Gap Audit.dc.html` | Screen-by-screen audit with severities. |
| `Practest Logo Usage.dc.html` | Logo in context on both palettes, and where it falls short. |

## Design tokens

Do not re-derive these. They are already correct in `lib/theme.dart`; this table is for reading the audit.

**Dark** — bg `#0B0F1A`, panel `#141B2B`, raised `#1B2438`, chrome `#12203A`, nav `#EB090D15`, text `#F3F6FF` / `#C7D0E4` / `#8A96B4`.
**Light** — bg `#EAEEF6`, panel `#FFFFFF`, raised `#F4F7FC`, chrome `#12203A` (chrome stays dark in both), text `#131722` / `#39424F` / `#616B7A`.
**Brand** — `#F5A623`; bright `#FFC968` on dark, `#A85F00` on light; onBrand `#1A1206`.
**Gold gradient** — `#FFC968` → `#F5A623` at 55% → `#E07C0A`, 135°, glow `0 16px 34px -12px rgba(245,166,35,.6)`.
**Secondary** royal blue `#3B6FF6` · **violet** `#8B5CF6` (Vajini only, violet→blue gradient) · **success** `#12B981` · **danger** `#E5484D`.
**Radii** — 10 / 14 / 20 / 999. Buttons and hero surfaces in the guide are 16 and 28.
**Type** — Sora (display), Plus Jakarta Sans (UI), JetBrains Mono (figures), Noto Sans Devanagari (हिं). Weight 800 is the ceiling.
**Motion** — route push 180ms easeOut; palette square 90ms.

## Assets

- `assets/practest-logo-dark.png` — 1000×500, transparent. Derived from the owner-supplied lockup by lifting black ink to `#F3F6FF` and navy to `#8FB0FF`; amber untouched. Goes to `assets/brand/practest-logo-dark.png`, and lets `BrandLockup` drop its white plate on dark surfaces.
- **Missing:** `assets/hero/welcome.jpg` — a students/classroom photograph, roughly 1200×1400, mid-dark so the scrim reads. `welcome_screen.dart` falls back to the guide's radial ink until it lands.
- **Note:** the small header mark cannot be cropped from the lockup — the amber P's descender runs through the wordmark. Keep using the repo's existing `practest-mark.png` at 1×/2×/3×.
