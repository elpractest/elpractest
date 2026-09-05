# Question bank redesign — taxonomy, two doors, pool entitlements

Status: **implemented, unreleased.** Built 2026-09-05, not yet pushed.
Supersedes nothing; extends the question bank and test authoring that shipped
through 2026-09-04.

## The problem

Two different jobs were being forced through one mechanism.

**Job A — accumulate a durable, well-classified question asset.** The bank had
exactly one exam dimension: `exam_tags`, a free-text JSON array. `"UGC NET"`,
`"UGC-NET"` and `"ugc net"` were three different tags and nothing validated any
of them. There were no columns for paper, year, shift, medium or source, so
"every Paper-1 PYQ from 2024, English medium" was not a question the database
could answer. And `questions` had **no unique constraint at all** — uploading
the same CSV twice silently doubled the bank.

**Job B — publish an exam-faithful paper, fast.** A test was assembled by
clicking questions one at a time out of a searchable list into sections
(`AdminTests.jsx`). A 100-question mock was 100 selections, and there was no
CSV path to a test anywhere in the codebase.

Both jobs went through the same funnel: CSV → bank → click 100 times → test.
Slow, and lossy at the classification step.

## What was rejected, and why

The obvious fix is to split the store: let test series own their own questions,
uploaded per-test, and leave the bank for practice. That was considered and
rejected. It costs three things:

1. **Item analytics die where they matter most.** `difficulty_index`,
   `discrimination_index` and `stats_sample_size` live on `questions` and are
   computed from real sessions by `ComputeTestAnalytics`. Test-series questions
   get the most exposure and therefore produce the best statistics. A separate
   silo means the most-answered questions generate no item analysis — losing
   the negative-discrimination flag ("this answer key is probably wrong")
   precisely where a wrong key is most expensive.
2. **Practice loses its anchor.** `PracticeTestBuilder::pool()` defines a
   student's practice pool as *questions appearing in a test they are entitled
   to sit*. Sever bank from tests and practice either becomes free-for-all
   (giving away the asset) or needs a new entitlement primitive anyway.
3. **Two importers, two schemas, two review queues, forever.**

A compound code as the *identity* was also rejected. `UGCNTP1PY24E1` is
unindexable for range queries, breaks on positional parsing the moment an exam
code is 5 characters instead of 4 — and it collides on the very first intended
upload: UGC NET 2024 Paper 1 morning and evening shift both have a Question 1
in English, and the shift is not in the code.

## The design: one store, two doors

Keep a single `questions` table. Add a second ingestion door.

```
Door A — Bank import     classify and park            → feeds practice
Door B — Paper import    one upload = one finished    → feeds test series
                         test + N classified questions
```

Both doors write to the same bank. Door B additionally builds the test
structure in the same transaction. No picking, no choosing, and the asset stays
whole.

### Taxonomy: columns are queried, the code is read

Seven columns on `questions`, plus one derived identifier:

| column | example | notes |
|---|---|---|
| `exam_code` | `UGCNET` | validated against `config/exams.php` registry |
| `paper` | `P1` | validated against that exam's declared papers |
| `source` | `pyq` | `pyq` \| `mock` \| `practice` |
| `year` | `2024` | nullable |
| `shift` | `2` | **the axis the compound code lost** |
| `medium` | `en` | `en` \| `hi` — genuinely new, nothing in the schema had it |
| `serial` | `1` | position within its paper; auto-assigned when absent |
| `question_code` | `UGCNET-P1-PY-2024-S2-EN-001` | derived, stored, **UNIQUE** |

Every segment of the code is self-identifying (`P1`, `PY`, `S2`, `EN`), so
optional segments can be omitted without making the rest positional. The code
is a projection of the columns, never the identity: filters run against indexed
columns, humans read and cite the code.

The unique index is what makes re-upload idempotent. A repeat upload now fails
loudly with a per-row duplicate report instead of silently doubling the bank.

**Serial assignment.** Supplied explicitly for a PYQ (it is the real question
number on the paper). When absent, it is assigned as `max(serial) + 1` within
the `(exam_code, paper, source, year, shift, medium)` group, inside the row's
own transaction. Imports process rows sequentially in one job, so there is no
concurrency in practice; the unique index is the backstop if that ever changes.

### Facets ride the upload, not every row

The upload carries `exam_code / paper / source / year / shift / medium` **once**
— as form fields on Door A, or in the meta block on Door B. Row-level override
columns exist and are optional. This avoids retyping `UGC NET, P1, pyq, 2024,
shift 2, en` into 200 rows, which is both tedious and the most likely source of
classification drift.

### Door B — paper import

`POST /api/admin/tests/import-paper`

Two inputs: a CSV of questions in exam order with a `section` column, and a
`meta` JSON block carrying everything the exam pattern needs — title, exam
facets, duration, per-section durations and cutoffs, shuffle flags,
normalization method, shift group/label, instructions, series or course
binding, and inline passage bodies.

One transaction: upsert questions into the bank (tagged with the facets,
`serial` from row order) → create the `Test` → create `TestSection`s → create
`TestSectionQuestion`s in row order.

Four things built into it deliberately:

- **Dry run first.** `dry_run=true` parses and validates everything and returns
  a report — what would be created, which rows duplicate existing codes, which
  are malformed, and whether the paper will need review before it can be
  published — while creating nothing. Door B writes to two subsystems at once;
  without a dry run a bad file is a bad file in two places.
- **Inline passages.** `passage_id` previously demanded that an admin
  hand-create the DI table or RC passage in the UI and paste an integer. For
  UGC NET Paper 1 that is the common case, not an edge case. Rows now carry a
  `passage_ref` label and the meta block declares the passage bodies; the
  import creates them and wires the foreign keys.
- **Section defaults.** `marks` / `negative_marks` stay per-question (correct —
  real papers vary marks by section), but the meta block sets a section default
  so they need not be retyped on 100 rows.
- **Mandatory scope.** `EntitlementService::accessibleTestIds()` treats a test
  with null `course_id`, `batch_id` *and* `test_series_id` as accessible to
  everyone. An unscoped import would silently publish a paid PYQ paper to the
  world, so Door B requires a series or a course.

**Review policy.** Door B follows Door A: imported questions land in
`pending_review` unless `auto_approve` is set. `TestController::publish()`
already refuses a test containing unapproved questions, so an imported paper
arrives as a draft and cannot reach a candidate until someone has proofed it.
The dry-run report says so explicitly rather than letting it be discovered at
publish time.

### Pool entitlements

`entitlements` and `product_items` were already polymorphic
(`grantable_type` / `grantable_id`, `Course | TestSeries`). A third grantable —
`QuestionPool`, a saved named filter over the taxonomy — therefore costs no new
payment, checkout or entitlement code.

```php
PracticeTestBuilder::pool() =
      questions in entitled tests      // today's rule, unchanged
    ∪ questions matching entitled pools // new, purely additive
```

Existing students keep exactly today's access. The addition makes the bank
sellable through machinery that already shipped: *"UGC NET Paper-1 Bank —
12,000 PYQs, unlimited practice"* becomes a Store product like any other.

## Decisions taken

These were the open questions at design time. Recorded here so they are not
re-litigated silently.

1. **Exam registry lives in `config/exams.php`**, extended from a flat category
   list into a structured registry (code → name, category, papers). A database
   table would let operators add an exam without a deploy; config keeps the
   existing single-source-of-truth property that `config/exams.php` was created
   for, at the cost of a deploy per new exam. Promote to a table only if
   operators actually need self-service.
2. **Non-PYQ codes use group-relative serials**, not an upload-batch token. A
   mock question with no natural question number gets the next serial in its
   group. Simpler than threading a batch id through, and the code stays
   meaningful.
3. **Re-upload is rejected, not upserted.** A duplicate `question_code` fails
   that row with a report naming the conflict. Silent overwrite of a question
   that may already have item statistics and live test placements is worse than
   an explicit failure.
4. **Door B does not auto-approve.** A transcribed PYQ paper deserves the same
   proofing as any other bulk import; a wrong key in a PYQ paper is just as
   costly. `auto_approve` remains an explicit opt-out.

## Migration and rollout

Production has one course and zero seeded questions, so there is nothing to
backfill: `question_code` is nullable and a unique index permits many NULLs, so
pre-existing rows (none, in practice) keep working unclassified. This is the
cheapest possible moment to change the shape of `questions`, and it gets
materially more expensive after content seeding.

Order of deployment is a single migration; no data migration step, no downtime,
and every new column is nullable or defaulted.

## What is deliberately not built

- A separate question store for test series — see *What was rejected*.
- Code-as-identity.
- Per-row facet repetition.
- Merging shifts away. Shifts are pooled in the bank (one bank, filterable) but
  `shift` remains a column, because reconstructing "UGC NET 2024 Shift 2 as it
  was actually sat" is the PYQ product.

## Files

| area | file |
|---|---|
| schema | `database/migrations/2026_09_05_000010_add_exam_taxonomy_to_questions_table.php` |
| | `database/migrations/2026_09_05_000020_create_question_pools_table.php` |
| registry | `config/exams.php` |
| code derivation | `app/Services/QuestionCodeService.php` |
| Door A | `app/Imports/QuestionImport.php`, `app/Http/Controllers/Admin/QuestionController.php` |
| Door B | `app/Services/PaperImportService.php`, `app/Http/Controllers/Admin/PaperImportController.php` |
| pools | `app/Models/QuestionPool.php`, `app/Http/Controllers/Admin/QuestionPoolController.php` |
| entitlement | `app/Services/EntitlementService.php`, `app/Services/PracticeTestBuilder.php` |
| shared row rules | `app/Services/QuestionRowBuilder.php` (both doors) |
| templates | `resources/templates/question_import_sample.csv`, `resources/templates/paper_import_sample.csv`, `resources/templates/paper_import_meta.json` |
| admin UI | `app/src/pages/AdminQuestions.jsx`, `app/src/pages/AdminTests.jsx`, `app/src/pages/AdminQuestionPools.jsx`, `app/src/lib/examCategories.js` |
| student UI | `app/src/pages/PracticeConsole.jsx` |
| tests | `tests/Feature/PaperImportTest.php` (16), `tests/Feature/QuestionPoolTest.php` (11), `tests/Feature/QuestionImportTest.php` (extended) |

## Verified

Backend suite **417 passing** (was 390 before this work; 27 new). Driven end to
end in a local browser against the real endpoints:

- Dry run reports and writes nothing; commit creates the paper and classifies
  every question, deriving `category=pyp` and `shift_group=UGCNET-P1-2024`.
- Re-importing the same paper is refused with all three duplicate codes named.
- The same paper as shift 1 imports cleanly beside shift 2 — no collision.
- An unscoped paper is refused, citing the world-readable consequence.
- Bank filters, unclassified-only, and search-by-code all narrow correctly.
- A student owning **only** a pool — no course, no series, no test — sees the
  exam facets, builds a 5-question practice paper from bank questions that are
  in no test at all, and sits it on the normal exam engine.
- The review gate holds throughout: a pool matched 0 while its questions were
  pending, 6 once approved.
