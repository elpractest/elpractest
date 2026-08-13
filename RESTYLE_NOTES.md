# Practest student SPA — restyle notes

A **visual-only** reskin of the student SPA (`app/`) to the "deep-ink + amber/gold"
design system. No business logic, routes, API calls, auth, or the server-authoritative
CBT engine were changed — behaviour and data flow are exactly as before.

## Design source

The three named sources were checked; only `Practest App - standalone.html` was on disk
(the `Practest App.dc.html` and `reference-screens/*.png` were **not present anywhere** under
`E:\vpd\apps`). The standalone is a runnable bundled build of the **same** design, so it was
used as the source of truth. Its two useful halves were extracted for reference while building:

- the **data model** (all demo content, exam categories, courses, CBT engine, colours), and
- the **per-screen markup template** (`<sc-if value="{{ showX }}">` sections with `{{ }}` bindings).

Both live in the scratchpad, not the repo.

## Foundation (already built by an earlier pass — verified, not rebuilt)

- `src/index.css` — full token layer, **both themes**, CBT palette locked, branded header,
  bottom-nav → sidebar at ≥1024px, `.cbt-root` light surface, chips/tiles/buttons.
- `src/lib/theme.js` — `useTheme()` + `tint(hue, isDark)` + persisted toggle (`localStorage
  practest-theme` + cross-site cookie), boot script in `index.html`.
- Fonts (Sora / Plus Jakarta Sans / JetBrains Mono / Noto Sans Devanagari) and i18n (EN / हिं).
- Shell components: `BrandHeader`, `BottomNav` (**5 tabs** Home·Tests·Study·Store·Profile +
  floating AI-Guru FAB), `Icon` (lucide-style set), `StudentShell`.

## New this pass

- **`src/lib/demoData.js`** — `USE_DEMO_DATA` flag (overridable via `VITE_USE_DEMO_DATA=false`)
  and fixtures ported from the design source. **Fallback only**: a page uses demo data *only*
  when its real API list is empty, so the populated reference layouts are visible before the
  DB is seeded. Real data always wins.
- **`src/pages/Welcome.jsx`** + a public `/welcome` route (additive; no auth flow changed).

## Per-screen changes

| Screen | File(s) | What changed |
|---|---|---|
| Home | `pages/Dashboard.jsx` | Full rebuild to reference order: Your-goal card → promo carousel → 4 quick-mode tiles → Continue card → Explore-by-exam 8-grid → Popular-series carousel → scholarship strip. All real fetches (courses, activation-requests, purchasable-courses, public settings) + `ActivationModal` + `StudentCheckout` preserved; "Enroll now"/"Attempt free" open the real activation modal. |
| — | `components/BannerCarousel.jsx` | Demo-banner fallback added when `/api/banners/public` is empty. |
| Tests list | `pages/StudentTestSeries.jsx` | Title + subtitle + horizontal filter chips + vertical horizontal-image row cards. Real `/api/student/test-series` preserved (mapped to card shape, with progress); demo fallback; chips filter client-side. |
| Course detail | `pages/TestSeriesDetail.jsx` | Reference **sales** page (hero + tags + rating + price card + What's inside + How-to-get-access + sticky enroll bar → `ActivationModal`) for demo/browse ids. **Real enrolled series keep their study-path + leaderboard** (restyled to tokens) — functionality retained, not replaced. |
| CBT room | `pages/TestTaking.jsx` | Render replaced with the reference **light** single-column layout (`.cbt-root`): section tabs, question card A/B/C/D, status legend, speech-bubble palette grid, sticky Mark/Clear/Save&Next/Submit bar. **Every engine handler (fetch/resume, timers, palette, answer save, mark, clear, section advance, submit) is byte-for-byte preserved.** Palette status colours verbatim from `index.css`. Added an **offline demo mode** (`/tests/demo`) so "Free test" reaches the CBT UI with no backend. |
| Result | `pages/TestResult.jsx` | Score ring + rank/percentile/accuracy stat cards + correct/wrong/skipped/time row + subject-wise accuracy bars + Retake/Review. Real result fetch preserved; question-by-question review kept and restyled; demo mode (`/tests/demo/result`). |
| Study zone | `pages/StudyZone.jsx` | Added the missing stat-header card (Tests done / accuracy / best rank); 6-tile grid already matched. |
| Store | `pages/Store.jsx` | Category tiles + hero banner + product grid. Real purchasable-courses + `StudentCheckout` (Razorpay) preserved and shown when present; demo product grid as fallback. |
| Notifications | `pages/Notifications.jsx` | Demo feed shown when the real derived feed is empty. |
| Search | `pages/SearchPage.jsx` | Empty state now shows trending chips + recent-search rows (demo); live client-side search over real series/courses unchanged. |
| Profile / AI Guru / Login | `pages/Profile.jsx`, `Vajini.jsx`, `Login.jsx` | Already reference-quality from the earlier pass (identity card + menu; violet chat UI over the real `/api/student/vajini/chat`; branded auth card with real 2FA/social/verify-email logic). Left as-is; added a "New to Practest?" link to `/welcome` on Login. |

## TODO stubs (no backend — clearly inert)

- Store demo "Add to cart" → `alert('Cart is coming soon.')`.
- Home "Change" goal, quick-mode deep-links, exam-category tiles → route to existing surfaces only.
- Store category chips are visual (no category filter endpoint).
- Welcome is presentational: "Get Started" → `/register`, "I already have an account" → `/login`.

## Intentionally left / could-not-fully-match (side-by-side)

- **Live visual verification is limited by the absence of a local backend/DB.** The redesigned
  in-app screens are auth-gated (`StudentGuard`), so they can't render without login. Verified
  instead via a clean production build **and** a live render check of the pre-auth screens
  (`/welcome`, `/login`): tokens resolve in **both** themes (`--bg` `#0b0f1a`↔`#eaeef6`), the
  gold gradient and Sora/Plus-Jakarta fonts apply. The demo CBT/Result are therefore reachable
  only once logged in — by design, since auth was not touched.
- **Course detail** keeps two modes: the reference sales page (browse/demo) *and* the app's real
  post-enrollment study-path + leaderboard (enrolled). The reference has only the sales page;
  deleting the study-path would have removed real functionality, so both are retained.
- **Result subject-wise bars** use a representative demo breakdown — the result API exposes
  overall accuracy but no per-subject field.
- **VerifyOtp** was not pixel-restyled; it already uses the design tokens, and the mockup has no
  distinct OTP screen (login/OTP is one combined auth surface).
- **Full-bleed vs shell** follows existing routing (unchanged): CBT / AI Guru / Notifications /
  Search render full-bleed; Result / Course detail render inside `StudentShell` (branded header
  above), so their reference "own header + back button" adapts to the shell rather than replacing it.

## Verification

- `npx oxlint` — warnings only (unused catch params / exhaustive-deps), all pre-existing patterns
  shared across the codebase (including the untouched CBT handlers).
- `npm run build` — ✓ built, no errors across every rewritten file.
- Live render check (production build, `vite preview`): `/welcome` and `/login` render correctly;
  Get-Started button = `linear-gradient(135deg,#FFC968,#F5A623…)`, headings in Sora, `data-theme`
  toggles `--bg`/`--card` between the dark and light palettes.
