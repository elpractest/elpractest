#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# Dumps the MariaDB database and pushes it to the offsite restic repository.
#
# No-ops (exits 0) until RESTIC_REPOSITORY + RESTIC_PASSWORD are set — same
# "deploys safely ahead of the secret" idiom as FcmService / OPENAI_API_KEY
# elsewhere in this codebase, so the stack builds and runs before anyone has
# created a bucket. See docs/COOLIFY_DEPLOYMENT.md for the required env and
# the restore runbook.
# ─────────────────────────────────────────────────────────────────────────────
set -eu

if [ -z "${RESTIC_REPOSITORY:-}" ] || [ -z "${RESTIC_PASSWORD:-}" ]; then
    echo "backup: RESTIC_REPOSITORY/RESTIC_PASSWORD not set - skipping (see docs/COOLIFY_DEPLOYMENT.md)"
    exit 0
fi

DB_HOST="${DB_HOST:-mariadb}"
DB_DATABASE="${DB_DATABASE:-practest}"
DB_USERNAME="${DB_USERNAME:-practest}"

echo "backup: starting $(date -u +%Y-%m-%dT%H:%M:%SZ)"

# First run against a fresh repository: initialize it. `snapshots` fails on an
# uninitialized repo (and on a genuine connectivity/auth problem, in which case
# `init` fails too and `set -e` aborts the script loudly, which is the point).
restic snapshots >/dev/null 2>&1 || restic init

mysqldump \
    --host="$DB_HOST" \
    --user="$DB_USERNAME" \
    --password="$DB_PASSWORD" \
    --single-transaction \
    --routines \
    --triggers \
    "$DB_DATABASE" \
    | restic backup --stdin --stdin-filename "practest-${DB_DATABASE}.sql" --host practest-coolify --tag nightly

restic forget \
    --keep-daily "${BACKUP_KEEP_DAILY:-14}" \
    --keep-weekly "${BACKUP_KEEP_WEEKLY:-8}" \
    --keep-monthly "${BACKUP_KEEP_MONTHLY:-6}" \
    --prune

echo "backup: done $(date -u +%Y-%m-%dT%H:%M:%SZ)"
