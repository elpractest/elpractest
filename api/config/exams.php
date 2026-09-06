<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Exam categories
    |--------------------------------------------------------------------------
    |
    | The single source of truth for the `exam_category` column on `courses`,
    | `test_series` and `banners`. Before this file the list lived as a
    | hard-coded `in:` rule in four FormRequests and as literal arrays in two
    | admin dropdowns — which had already drifted: the Test Series dropdown
    | offered Railways / Defence / Other, while the Course API rejected all
    | three with a 422. One list, read by the API and served to every frontend
    | via GET /api/settings/public, so the two cannot disagree again.
    |
    | The DB columns are plain strings, so adding an exam here needs no
    | migration. Removing one does NOT retro-invalidate existing rows, but it
    | does make them un-editable (the update request re-validates the field) —
    | so prune only after checking for rows still using the value.
    |
    */

    'categories' => [
        'SSC',
        'Banking',
        'RRB',
        'UPSC',
        'State PCS',
        'NEET',
        'JEE',
        'UGC NET',
        'Railways',
        'Defence',
        'Other',
    ],

    /*
    |--------------------------------------------------------------------------
    | Exam registry — the question bank's taxonomy
    |--------------------------------------------------------------------------
    |
    | `categories` above is deliberately coarse: it groups a whole family under
    | one label so a course or a banner can say "SSC". That is the wrong
    | granularity for a question, because SSC CGL and SSC CHSL do not share a
    | paper structure and a CGL previous-year question is not a CHSL one.
    |
    | So the bank classifies against THIS list instead — a finer code per exam,
    | each mapped back to the coarse category the rest of the app already uses,
    | and each declaring the papers it actually has. `papers` being empty means
    | the exam has no paper division and questions leave `paper` null.
    |
    | Adding an exam here needs a deploy but no migration (every taxonomy
    | column on `questions` is a plain string). This stays in config rather
    | than becoming a table for the same reason `categories` did: one list, one
    | place, no chance of the API and the dropdowns drifting apart. Promote it
    | to a table only when operators actually need to add exams themselves.
    |
    */

    'registry' => [
        // The owner's actual catalogue, 2026-09-06. Ordered as they teach it,
        // because this order is what the admin dropdowns show.
        //
        // Papers are VALIDATED on import: once an exam declares its list, a row
        // claiming any other paper is rejected. So this reflects the exams as
        // they are actually conducted, not every division they have ever had.
        'SSCCGL' => ['name' => 'SSC CGL', 'category' => 'SSC', 'papers' => ['T1', 'T2']],
        'SSCCHSL' => ['name' => 'SSC CHSL', 'category' => 'SSC', 'papers' => ['T1', 'T2']],
        'UGCNET' => ['name' => 'UGC NET', 'category' => 'UGC NET', 'papers' => ['P1', 'P2']],
        'RRBNTPC' => ['name' => 'RRB NTPC', 'category' => 'RRB', 'papers' => ['CBT1', 'CBT2']],
        // Single CBT, no divisions — so its questions carry no `paper` at all
        // and their codes simply omit that segment.
        'RRBGROUPD' => ['name' => 'Railway Group D', 'category' => 'RRB', 'papers' => []],
    ],

    /*
    |--------------------------------------------------------------------------
    | Where a question came from
    |--------------------------------------------------------------------------
    |
    | The two-letter form is what lands in `question_code`. `pyq` is the one
    | that carries a real year and shift; `mock` is an original written in
    | house; `practice` is drill material never intended to sit in a paper.
    |
    */

    'sources' => [
        'pyq' => ['name' => 'Previous year', 'code' => 'PY'],
        'mock' => ['name' => 'Mock', 'code' => 'MK'],
        'practice' => ['name' => 'Practice', 'code' => 'PR'],
    ],

    /*
    |--------------------------------------------------------------------------
    | Question medium
    |--------------------------------------------------------------------------
    |
    | Indian competitive papers are set in more than one language and the same
    | question exists as separate items per medium — they are NOT translations
    | sharing a row, because the options, the answer key position and the item
    | statistics all differ. Hence a column, and a segment in the code.
    |
    */

    'mediums' => [
        'en' => 'English',
        'hi' => 'Hindi',
        'bn' => 'Bengali',
        'mr' => 'Marathi',
        'ta' => 'Tamil',
        'te' => 'Telugu',
        'gu' => 'Gujarati',
        'kn' => 'Kannada',
        'ml' => 'Malayalam',
        'or' => 'Odia',
        'pa' => 'Punjabi',
        'as' => 'Assamese',
        'ur' => 'Urdu',
    ],

];
