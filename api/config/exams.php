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

];
