#!/bin/sh
# Writes the schedule from BACKUP_SCHEDULE (default: 2:30am daily, container
# timezone from TZ, default Asia/Kolkata — see docker-compose.coolify.yml) into
# crontab, then runs crond in the foreground so the container has a long-lived
# process to supervise.
set -eu

SCHEDULE="${BACKUP_SCHEDULE:-30 2 * * *}"
echo "${SCHEDULE} /usr/local/bin/backup >> /proc/1/fd/1 2>&1" > /etc/crontabs/root

echo "backup: scheduled '${SCHEDULE}' ($(date))"
exec crond -f -l 2
