# Door B runbook — putting a paper on the platform

How a real paper gets from a spreadsheet to a student sitting it. Written by
walking one through end to end on 2026-09-06; every error message quoted below
is one the importer actually produced.

Design rationale is in [QUESTION-BANK-REDESIGN.md](QUESTION-BANK-REDESIGN.md).
This file is the operator's path.

## The shape of it

```
templates → edit → DRY RUN → fix → commit → review/approve → publish → student
                      ↑_______|
                   (repeat until clean — nothing is written yet)
```

One upload produces **two** things: a draft `Test` with its sections, and N
classified questions in the bank. That is the whole point — you are not
building a test *and* seeding a bank as separate jobs.

## 1. Get the templates

Admin → **Tests manager** → **Import a paper** → *Sample CSV* / *Sample meta*.

Or directly:

```bash
curl -o paper.csv  'https://api.practest.live/api/admin/tests/import-paper/template?part=csv'
curl -o meta.json  'https://api.practest.live/api/admin/tests/import-paper/template?part=meta'
```

## 2. The CSV

One row per question, **in exam order**. Row order becomes question order, so
you do not renumber anything by hand.

Required: `section`, `question_text`, `option_a`…`option_d`, `correct_option`.

Useful optional columns:

| column | why |
|---|---|
| `serial` | The real question number on the paper. Omit and it defaults to row position. |
| `subject` / `topic` | Default to the section title. Only set them if the section is not the subject. |
| `marks` / `negative_marks` | Override the section or paper default for one question. |
| `passage_ref` | Groups rows onto a shared RC passage or DI table (see meta below). |
| `question_type` | `single_choice` (default), `multi_select`, `numeric`. |
| `explanation`, `difficulty` | As you would expect. |
| `*_image_url` | Diagrams, fetched at import. An option may be image-only. |

Multi-select keys are pipe-separated: `a|c`.

## 3. The meta block

Carries the exam pattern once, so the CSV stays about questions.

```json
{
  "title": "UGC NET 2023 Paper 1 — Shift 1",
  "test_series_id": 2,
  "type": "mock",
  "duration_minutes": 60,
  "exam_code": "UGCNET", "paper": "P1", "source": "pyq",
  "year": 2023, "shift": "1", "medium": "en",
  "marks": 2, "negative_marks": 0,
  "sections": [
    { "title": "Teaching Aptitude" },
    { "title": "Research Aptitude", "duration_minutes": 30, "is_qualifying": false }
  ],
  "passages": [
    { "ref": "DI1", "title": "Enrolment",
      "body": "Enrolment over three years.",
      "table_data": { "headers": ["Year","A"], "rows": [["2023","120"],["2024","150"]] } }
  ]
}
```

Things worth knowing:

- **`test_series_id` or `course_id` is mandatory.** A test with no course, batch
  or series is visible to *every user on the platform* — so the import refuses
  to create one rather than letting a paid paper leak.
- **Every `section` in the CSV must be declared here**, and in the order you
  want them to appear.
- **`exam_code` and `paper` are validated** against `config/exams.php`. The five
  exams and their papers are listed in `docs/context/STATE.md`.
- **`shift_group` is derived** (`UGCNET-P1-2023`) so the shifts of one exam run
  can be normalised against each other later. You do not set it.
- **`category` is derived**: `source: "pyq"` produces a `pyp` test, which is
  what the student test-series UI already filters on.
- **Marks cascade**: row → section → paper. Set the paper default once.
- `auto_approve: true` skips the review queue. Leave it off unless the paper has
  already been proofed by a human — see step 5.

## 4. Dry run, and read the report

Click **Dry run**. It validates the whole file and **creates nothing**.

The report tells you three separate things:

**Paper-level errors** — one mistake in the meta, reported once:

```
meta: Exam 'UGCNET' has no paper 'P3' (expected: P1, P2).
```

**Row-level errors** — everything wrong with the rows, in one pass:

```
row 3 correct_option: correct_option must name exactly one option (found 2).
row 4 section:        Section 'General Awareness' is not declared in the meta file.
row 5 passage_ref:    Passage 'DI9' is not declared in the meta file.
```

**Duplicates** — questions already in the bank:

```
3 question(s) are already in the bank. Re-importing a paper that already exists
would double it — change the shift, year or medium if this is genuinely a
different sitting.
```

That last one is the guard against the single most likely operator mistake.
Every question carries a unique `question_code` built from its exam facets
(`UGCNET-P1-PY-2023-S1-EN-001`), so re-uploading the same paper fails loudly
instead of silently doubling your bank. If it *is* a different sitting, change
`shift` — that is exactly the axis that keeps morning and evening apart.

**Commit is disabled until the dry run is clean.** That is deliberate: this
importer writes to the bank and the test builder in one transaction, and a
half-imported paper is far more work to unpick than to re-upload.

## 5. Commit, then review

**Create the paper** imports it. You get a **draft** test — never published,
never automatic.

Its questions land in `pending_review`, and publishing is gated on that:

```
422 — 5 question(s) in this test have not been approved.
```

This is not a bug to route around. A wrong answer key discovered after the fact
cannot be un-marked, only re-scored, and by then candidates have made decisions
on a false premise. So: Admin → **Question bank**, filter to the paper you just
imported, and approve.

Filtering to exactly this paper:

```
Exam = UGC NET · Paper = P1 · Year = 2023 · (Review = Pending)
```

Select the rows and **Approve** in bulk. Or approve them one at a time while
actually reading them, which is the point of the queue.

## 6. Publish

Back in **Tests manager**, publish the paper. It succeeds once every question is
approved, and fans a "new mock" notification out to enrolled students.

## 7. What the student sees

A student entitled to the series (bought it, or assigned via their batch) sees
the paper in Test series and can sit it on the normal exam engine — sectional
timers, palette, per-candidate shuffling, the scorecard, all unchanged.

**And the bank grew.** If a question pool's filter matches the questions you
just imported, that pool grew too — with no re-sync, because a pool stores a
*filter*, not a list of ids. Walking this runbook, importing a 2023 paper took
the "UGC NET Paper 1 — PYQ" pool from 6 questions to 11 automatically.

## Failure modes seen while walking this

| symptom | cause | fix |
|---|---|---|
| One error repeated on every row | *(fixed 2026-09-06)* paper-level facets were checked per row | Update; it is reported once now |
| "Section X has no rows" but X clearly has rows | *(fixed)* its rows failed another check first | Update |
| Duplicate serial only appears after fixing other errors | *(fixed)* collisions now surface in the same pass | Update |
| `422` naming `test_series_id` | No scope on the paper | Pick a series in the modal, or set `course_id` |
| Every row rejected for an unknown exam | `exam_code` not in the registry | Check `config/exams.php`; adding one is a config edit + deploy |
| Import succeeds, publish refuses | Working as designed | Approve the questions (step 5) |

## Doing this against production

Same steps, at `https://app.practest.live/admin/dashboard`.

**Content must be real.** This platform deliberately removed every piece of
fabricated content in 2026-09-03 (`d0d9982`) — invented questions in a paid
paper are worse than an empty site, because a student pays for them and
prepares against them. Import papers you actually hold, and proof them through
the review queue rather than `auto_approve`.
