# Test Series & Teaching Layer — Build Spec

> Status: **APPROVED DESIGN, not yet built** (2026-07-22). Additive to the live production system.
> Model chosen: **Series-first** + **manual Study Path** (designed to become adaptive later).
> This spec is the source of truth for the build. Execute it in the phase order in §10.
> Companion: `CLAUDE.md` §17 (guardrails), `docs/INFRASTRUCTURE.md` (deploy).

---

## 1. Goal & non-negotiable principles

Adopt the Testbook/Oliveboard content richness (named series, typed tests, deep analytics) but add the
two things a **white-label, institute-owned** platform must have and they can't offer:
- **Reuse** — build a series once, assign it to many batches/years.
- **Teaching loop** — assign tests to a batch with deadlines; owner sees each student; students get a
  guided path, not a 2000-test catalog.

**Hard rules (same as `CLAUDE.md` §17.0):**
1. **Purely additive.** Never change an existing route path/method/payload/response shape. New tables,
   new nullable columns, new endpoints only. The 101-test suite must stay green.
2. New nullable columns with defaults → existing rows and existing tests are unaffected.
3. Migrations must run on **SQLite (tests) AND MariaDB 10.6 / MySQL 8 (prod)**. No `->after()` on
   columns that may not exist (that bug already bit us). Use `string` columns, not DB `enum`.
4. Follow existing patterns: `FormRequest` validation, `apiResource`, audit logging on admin writes,
   role guards, the `app/src/api.js` axios instance, KaTeX rendering, the CBT palette.
5. Every new endpoint gets a feature test. `npm run build` clean before any frontend commit.
6. Respect the admin/super-admin dashboard split (commit `14c323f`): admin-content screens live under
   the **admin** role + `/admin/*` routes.

---

## 2. Data model (additive)

### 2.1 New columns on `tests` (one migration)
| Column | Type | Notes |
|---|---|---|
| `test_series_id` | `foreignId nullable` → `test_series.id`, `nullOnDelete` | which series this test belongs to (optional) |
| `series_sort_order` | `integer default 0` | position within the series = the Study Path order |
| `category` | `string default 'full_mock'` | `full_mock` \| `sectional` \| `pyp` \| `topic` (NOT a DB enum) |
| `is_free` | `boolean default false` | free/sample hook flag |

Existing `type` (`practice`/`mock`), `course_id`, `batch_id` stay unchanged and keep working.
`category` is the exam-taxonomy label; `type` still drives timing behavior.

### 2.2 New table `test_series`
```
id, title (string), slug (string unique), description (text null),
exam_category (string),            // SSC, Banking, RRB, UPSC, State PCS
course_id (foreignId null → courses, nullOnDelete),   // optional grouping under a course
is_published (bool default false),
sort_order (int default 0),
created_by (foreignId → users),
timestamps, softDeletes
```

### 2.3 New table `assignments` (polymorphic — the "assign like homework" layer)
```
id,
batch_id (foreignId → batches, cascadeOnDelete),
assignable_type (string),          // 'App\Models\TestSeries' | 'App\Models\Test'
assignable_id (unsignedBigInteger),
available_from (timestamp null),
due_at (timestamp null),
assigned_by (foreignId → users),
is_active (bool default true),
timestamps
index (batch_id), index (assignable_type, assignable_id)
```
One series (or one test) can be assigned to many batches, each with its own schedule. This is what
makes a series **reusable** and a test **assignable with a deadline**.

### 2.4 What we deliberately do NOT add yet
- No `study_paths` table — the path IS `tests.series_sort_order` within a series (manual ordering).
  Phase 3 adaptive ordering swaps the *source* of the order without changing the student API contract.
- No new billing/subscription tables — access stays via existing **enrollment** (activation code / pay).

---

## 3. Models & relationships

- **`TestSeries`** (new): `hasMany(Test)` ordered by `series_sort_order`; `belongsTo(Course)`;
  `morphMany(Assignment, 'assignable')`; `belongsTo(User, 'created_by')`. Accessor `total_tests`,
  `free_tests_count`. `SoftDeletes`.
- **`Assignment`** (new): `belongsTo(Batch)`; `morphTo('assignable')`; `belongsTo(User, 'assigned_by')`.
- **`Test`** (extend): add `belongsTo(TestSeries)`; add `morphMany(Assignment, 'assignable')`; add
  `category`, `is_free`, `test_series_id`, `series_sort_order` to `$fillable`; cast `is_free` bool.
- **`Batch`** (extend): add `hasMany(Assignment)`; helpers `assignedSeries()`, `assignedTests()`.

---

## 4. API — Admin (all NEW routes, under the existing admin group + role guard)

Add audit logging to every write, matching existing admin controllers.

### 4.1 Test Series CRUD
```
apiResource('admin/test-series', TestSeriesController)   // index, store, show, update, destroy
POST   admin/test-series/{series}/publish
POST   admin/test-series/{series}/unpublish
```
`StoreTestSeriesRequest`: `title` required, `exam_category` required, `course_id` nullable exists,
`description` nullable. Publish guard: cannot publish a series with zero tests.

### 4.2 Series Builder (attach / reorder / categorize tests)
```
PUT    admin/test-series/{series}/tests    // body: [{test_id, series_sort_order, category, is_free}]
```
Sets `test_series_id`, `series_sort_order`, `category`, `is_free` on the given tests (bulk upsert).
Detaching = set `test_series_id = null`. Tests are picked from the EXISTING test list (reuse the
existing `GET admin/tests` with a `?unassigned=1` / `?series_id=` filter — additive query params only).

### 4.3 Extend test create/update payload (additive fields only)
`StoreTestRequest` / `UpdateTestRequest` gain OPTIONAL: `test_series_id` (nullable exists),
`category` (nullable in list), `is_free` (nullable boolean). Existing callers unaffected.

### 4.4 Assignments ("assign to batch with deadline")
```
GET    admin/batches/{batch}/assignments
POST   admin/assignments        // {batch_ids[], assignable_type, assignable_id, available_from?, due_at?}
PUT    admin/assignments/{assignment}
DELETE admin/assignments/{assignment}
```
Assign one series/test to one or many batches in a single call (loop → rows). `assignable_type`
restricted to `series|test` (map to FQCN server-side).

### 4.5 Cohort analytics (owner view)
```
GET    admin/batches/{batch}/analytics            // summary: enrolled, avg score, attempts, weak topics
GET    admin/batches/{batch}/students-progress    // per-student: tests done/total, avg accuracy, last active
GET    admin/tests/{test}/leaderboard             // rank students on that test
GET    admin/test-series/{series}/leaderboard     // aggregate rank across the series
```
Built as read-only queries over existing `test_sessions` + `test_analytics` joined to `enrollments`
(filtered to the batch). No new analytics tables.

---

## 5. API — Student (all NEW; existing test-taking routes untouched)

```
GET  student/test-series                    // series assigned to my active batches (cards)
GET  student/test-series/{series}           // series detail: tests grouped by category, in path order,
                                            //   each with my completion status + which is "next up"
GET  student/test-series/{series}/leaderboard   // my batch leaderboard for this series
```
`GET student/tests`, `start`, `saveAnswer`, `submit`, `result`, `palette` — **unchanged**. The series
detail links into the existing `POST student/tests/{test}/start` flow. Study Path = the ordered test
list + "first not-yet-submitted test" computed from the student's `test_sessions`.

**Forward-compat:** the series-detail response returns tests already ordered + a `next_test_id`. In
Phase 3, the ordering source changes from `series_sort_order` to an adaptive scorer, but this JSON
shape stays identical — the UI never changes.

---

## 6. Access & visibility

A student sees a series when it is **assigned (via `assignments`) to a batch they are actively
enrolled in** (reuse `Enrollment::active()`). Tests inside inherit that access. `is_free` tests are
flagged in the UI as "Free" (Phase 1); a public/sample-attempt flow for non-enrolled prospects is
Phase 2. Access is still ultimately gated by the institute's enrollment (activation code / online pay)
— no change to the business model.

Extend `Student\TestTakingController::availableTests` additively (it already filters by
course/batch/enrollment) so series-linked tests surface correctly; do not remove the existing
null-course/null-batch "open test" branch.

---

## 7. Admin UI (new React pages, admin role, `/admin/*`)

- **`AdminTestSeries.jsx`** — list series (title, exam, total/free counts, published toggle) + create/edit.
- **Series Builder** (panel within the series page) — search the existing test bank, add tests, set each
  test's `category`, drag/▲▼ reorder (writes `series_sort_order`), mark `is_free`, publish.
- **Assign modal** (from a series or test) — pick batch(es), set `available_from` + `due_at` → calls §4.4.
- **`AdminBatchAnalytics.jsx`** — cohort dashboard: per-student progress table, weak-topic heat, batch
  leaderboard, overdue-assignment flags.
- Reuse existing styling (`glass-panel`, `btn-primary`, tokens), the axios instance, and the KaTeX/CSV
  patterns already in `AdminTests.jsx` / `AdminQuestions.jsx`.

## 8. Student UI (new React pages)

- **`StudentTestSeries.jsx`** — series cards ("40 tests · 6 free · 12 attempted", batch rank chip).
- **`TestSeriesDetail.jsx` (Study Path)** — tests grouped by category tabs (Full mock / Sectional / PYP /
  Topic), shown in path order with completion ticks and a prominent **"Continue → next test"**; each
  row links to the existing TestTaking start. Batch leaderboard tab.
- Enhance existing results history to show which series an attempt belonged to (additive field).

## 9. Analytics detail

- **Reuse** existing per-attempt `TestAnalytic` (score, accuracy, rank, percentile, subject/topic
  breakdown, time-per-question) — unchanged.
- **Cohort** = aggregate those over a batch's enrolled students (new read queries/endpoints §4.5).
- **Batch leaderboard** = rank enrolled students by best/last score for a test or summed series score.
- **Phase 2:** all-institute rank (widen the rank scope from batch to all attempters — additive option).
- **Phase 3:** adaptive "recommended next" — read each student's weakest topics from existing analytics
  and reorder the path / surface topic tests. No schema change; it's a scorer over existing data.

---

## 10. Phasing (build in this order)

**Phase 1 — Series + Assignment + Study Path (the core unique model)**
Migrations (§2.1–2.3) · models (§3) · admin Series CRUD + Builder (§4.1–4.3) · series→batch assignment
(§4.4) · student series list + Study Path detail (§5) · basic batch leaderboard · feature tests for all.
_Deliverable: build a series once, assign to a batch, students follow a guided path._

**Phase 2 — Teaching depth + analytics**
Cohort dashboard + per-student weak areas (§4.5) · individual-test homework with `due_at` + overdue
tracking · `is_free` public-sample attempt flow · all-institute ranking option.

**Phase 3 — Smart + advanced**
Adaptive "recommended next test" (weak-topic driven) · Live Tests (scheduled, synchronized start,
live ranking) · current-affairs / GK test category.

---

## 11. Compatibility, testing, deployment

- **Suite:** keep 101 green; add feature tests per new endpoint (series CRUD, assignment, student
  series view, leaderboard, cohort analytics). Target: no regressions.
- **Migrations:** SQLite + MariaDB compatible; nullable/defaulted columns; no `->after()`; `string`
  not `enum`. Test `migrate:fresh` on SQLite and a MariaDB check before prod.
- **Deploy (per `docs/INFRASTRUCTURE.md` §7):** backend = push → `git pull` on server → `migrate
  --force` → `config/route/view:cache`. Frontend = `npm run build` → upload `dist`. If new composer
  deps are added (none expected), build `vendor` locally + upload (server `composer install` is killed
  by the resource limit).
- **Cron reminder:** analytics/imports need the `queue:work` cron — already on the pre-launch checklist.

---

## 12. Open items to confirm before Phase 1 code
- Exact `category` label set (proposed: full_mock, sectional, pyp, topic — add `current_affairs` now or
  in Phase 3?).
- Whether a Test Series must belong to a Course, or can stand alone (spec allows nullable `course_id` —
  recommend standalone-allowed).
- Leaderboard default scope for launch: batch-only (recommended Phase 1) vs all-institute (Phase 2).
