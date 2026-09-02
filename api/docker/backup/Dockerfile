# syntax=docker/dockerfile:1

# ─────────────────────────────────────────────────────────────────────────────
# Nightly offsite backup sidecar for the embedded MariaDB (see the "Known
# follow-up — database backups" note this replaces in docker-compose.coolify.yml
# and the runbook in docs/COOLIFY_DEPLOYMENT.md).
#
# restic does the actual dump shipping: encrypted, deduplicated, S3-compatible
# (Cloudflare R2 by default — see docs), with retention/pruning built in, so
# backup.sh stays a thin wrapper instead of hand-rolled upload/prune logic.
# ─────────────────────────────────────────────────────────────────────────────
FROM alpine:3.20

RUN apk add --no-cache mariadb-client restic tzdata

COPY api/docker/backup/backup.sh /usr/local/bin/backup
COPY api/docker/backup/entrypoint.sh /usr/local/bin/entrypoint
RUN chmod +x /usr/local/bin/backup /usr/local/bin/entrypoint

ENTRYPOINT ["entrypoint"]
