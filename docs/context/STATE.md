# Current state

Where Practest work stopped. Keep short and current — history goes in JOURNAL.md.

_Last updated: 2026-09-05_

## In flight

Nothing mid-build. Everything below is live on prod (`main` → CI →
`deploy/coolify` → Coolify), verified against the real domains after deploy.

## What just happened: the question-bank redesign

Commit `1cbf409`. The bank is now **classified**, and a whole paper can arrive
in **one upload** instead of a hundred clicks.

Full rationale, rejected alternatives and the decisions taken live in
**[docs/QUESTION-BANK-REDESIGN.md](../QUESTION-BANK-REDESIGN.md)** — read that
before changing any of it. The short version:

- **Taxonomy.** Seven columns on `questions` (`exam_code`, `paper`, `source`,
  `year`, `shift`, `medium`, `serial`) plus a derived, stored, **UNIQUE**
  `question_code` like `UGCNET-P1-PY-2024-S2-EN-001`. Columns are what gets
  queried; the code is for humans to cite and for re-uploads to collide on.
  Nothing parses the code back. Exams live in `config/exams.php` next to the
  categories — one list, so the API and the dropdowns cannot drift.
- **Two doors, one store.** Door A (bank CSV import) now carries its facets on
  the *upload* rather than on every row. Door B (`POST
  /api/admin/tests/import-paper`, new) turns one upload into one draft paper
  **and** N classified questions in a single transaction. Both write to the
  same `questions` table, and share `QuestionRowBuilder` so "is this row
  scoreable" has one definition.
- **Door B always dry-runs first.** It is the only importer that writes to two
  subsystems at once. `dry_run=true` returns the full report and creates
  nothing.
- **Question pools.** A saved *filter* over the taxonomy (not a list of ids),
  grantable and sellable. `entitlements` / `product_items` were already
  polymorphic so this needed no new payment or granting code. The practice pool
  now unions the pool rail with the existing test rail — **purely additive**,
  every existing student keeps exactly the access they had.

## Next step

1. **Import a real paper through Door B.** The bank is still empty on prod —
   this is now the fastest path to a non-sparse site, and it replaces what used
   to be "seed content by hand". Templates download from inside the admin
   import modal, or `GET /api/admin/tests/import-paper/template?part=csv|meta`.
2. **Check the exam registry matches the real catalogue.** `config/exams.php`
   ships with 20 exams that were chosen, not sourced from the owner. It is now
   the live vocabulary for every admin dropdown. Correcting it is a config edit
   + deploy (no migration) — and much cheaper *before* content is classified
   against the wrong codes.
3. Set `FIREBASE_CREDENTIALS_JSON` + `FIREBASE_PROJECT_ID` on the Coolify api
   container — FCM push backend has been live for weeks, just never configured.
   Project id under "Prod facts".
4. Ship a release Flutter build once (3) is done — the Android client's FCM +
   native Google sign-in code is complete and committed but has never sent or
   received a real push on a device.

## Open / blocked

- **Nothing blocked.** Owner decisions: whether the shipped exam registry is the
  right list; when to configure Firebase creds; whether/when to cut a Flutter
  release build.
- **Never verified live:** real FCM device send (no service account configured);
  Flutter token-registration and push-tap deep-link on an actual device; the two
  FCM migrations have never run on prod.
- **Bank is empty on prod.** One course (`UGC NET`, no batches), zero banners,
  zero questions. The site renders honest empty states — it is not broken, it is
  unseeded. See next step (1).
- **Pools have no student-facing storefront copy yet.** A `question_bank`
  product type exists and the Store will list one, but nobody has written what a
  "question bank" product actually says to a buyer.

## Prod facts worth not re-deriving

- Firebase project: **`practest-24732`**. Android package:
  `com.practest.practest_app`.
- Admin panel is the SPA at **`/admin/dashboard`** (one tabbed page).
  **Super-admin is a superset of admin** — no separate login needed.
- Seeded accounts: super-admin `thevinstitution@gmail.com`, admin
  `vsn.educare@gmail.com` (both seeded with a **default password** — rotate the
  admin one if unused, and note: as of 2026-09-03 the super-admin's actual DB
  password no longer matches whatever `SUPER_ADMIN_PASSWORD` says in `.env` —
  it was changed at some point without updating that doc value; don't trust
  `.env` for it, ask the owner). Student test acct: `vmedics.ps@gmail.com`
  (anant).
- **Google login is fully configured.** `GOOGLE_MOBILE_CLIENT_ID` is set on the
  api container — `/api/settings/public` serves `688814926066-1b0pv…` as
  `google_client_id`, which is correct: `SettingsController` deliberately
  prefers the mobile client (the Firebase project's web client) because that is
  the audience the backend checks mobile ID tokens against. Web login's own
  `GOOGLE_CLIENT_ID` is `904862810932-…`, a different Google project — leave it
  alone. SHA-1 `E1:F1:54:75:9E:E5:F2:5A:9B:BC:50:88:9A:35:C8:25:C2:03:6E:4E` is
  registered; debug/release share it (no release keystore yet).
- **Store rule:** a course lists in the Store only when
  `Course.is_published=true` AND it has an `is_active` batch with `price_paise`
  set.
- **An unscoped test is world-readable.** `EntitlementService::accessibleTestIds()`
  treats a test with no course, batch *or* series as accessible to everyone.
  Door B refuses to create one; anything else that creates tests must not either.
- **Imported questions need review.** Both doors land questions in
  `pending_review` unless `auto_approve` is set, and `TestController::publish()`
  refuses a test containing unapproved questions. So an imported paper arrives as
  a draft by design — that is not a bug to route around.
- Mobile auth = Sanctum bearer via `/mobile/login`; token in
  `shared_preferences` (`auth_token`). API base already includes `/api`; app
  paths are like `/student/device-tokens`.
- Backend tests run on sqlite `:memory:`, `QUEUE_CONNECTION=sync`. Full suite:
  **417 pass** (386 before the redesign). CI re-runs the same suite on MariaDB
  10.6, and that is the run which actually gates a deploy — sqlite and MariaDB
  differ on index and NULL-uniqueness behaviour, so trust the CI run over a
  local one.
- Deploy model: push to `main` → CI runs the backend suite on MariaDB → passing
  run fast-forwards `deploy/coolify` → Coolify's webhook deploys. Roughly 7
  minutes end to end. See `.github/workflows/ci.yml`'s header comment for the
  rationale (promotion-branch model, no deploy credential in CI).
- CSV templates live in **`api/resources/templates/`** —
  `question_import_sample.csv` (Door A), `paper_import_sample.csv` +
  `paper_import_meta.json` (Door B). They are in `resources/`, **not**
  `storage/app/`, because `storage/app` is a persistent Docker volume that
  shadows anything baked into the image (that mistake caused a prod 404 on
  2026-09-03).
