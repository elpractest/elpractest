<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Storage disk for study-material PDFs
    |--------------------------------------------------------------------------
    |
    | Deliberately a PRIVATE disk. These are paid course assets: the student
    | reader never receives a file URL, it streams the bytes through
    | `GET /api/student/study-materials/{material}/file`, which re-checks the
    | entitlement on every request. Point this at 's3' in an environment that
    | has one — the stream endpoint falls back to a short-lived signed URL when
    | the driver supports it.
    |
    */

    'disk' => env('STUDY_MATERIAL_DISK', 'local'),

    /*
    | Directory inside that disk. Uploads land in <disk>/<directory>/.
    */
    'directory' => env('STUDY_MATERIAL_DIRECTORY', 'study-materials'),

    /*
    | Upload ceiling in kilobytes. 40 MB covers a scanned 300-page booklet;
    | anything larger is a sign the PDF should have been compressed first.
    */
    'max_upload_kb' => (int) env('STUDY_MATERIAL_MAX_UPLOAD_KB', 40960),

    /*
    | Lifetime of the signed URL handed out when the disk is a cloud driver.
    */
    'signed_url_minutes' => (int) env('STUDY_MATERIAL_SIGNED_URL_MINUTES', 10),

];
