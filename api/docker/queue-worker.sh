#!/bin/sh
# ─────────────────────────────────────────────────────────────────────────────
# Supervises `queue:work` so the WORKER PROCESS recycles without the CONTAINER
# exiting.
#
# `queue:work --max-time=3600` deliberately ends the PHP process every hour so a
# long-lived worker cannot leak memory. If that exit is also the container's
# exit, Docker's `restart: unless-stopped` policy restarts it and bumps the
# container's RestartCount once an hour — and Coolify reads *any* RestartCount
# increase as a crash. At `max_restart_count` (default 10, i.e. ~10 hours)
# Coolify stops the whole application and prunes its images, which is what took
# practest.live down on 2026-08-16, 08-22, 08-27 and 08-31.
#
# Looping here keeps the recycle inside the container, so RestartCount stays 0
# and a genuine crash loop is still visible as one.
#
# SIGTERM (what `docker stop` sends) is forwarded to the worker so it finishes
# the job in hand and exits cleanly, then this script exits WITHOUT restarting
# it — otherwise shutdown would spin forever.
# ─────────────────────────────────────────────────────────────────────────────
set -e

child=""
stopping=0

forward_term() {
    stopping=1
    if [ -n "$child" ]; then
        kill -TERM "$child" 2>/dev/null || true
        # Let the worker drain its current job before the container goes away.
        wait "$child" 2>/dev/null || true
    fi
    exit 0
}
trap forward_term TERM INT

while [ "$stopping" -eq 0 ]; do
    "$@" &
    child=$!
    # `|| true` so a non-zero worker exit recycles rather than killing the
    # container; `set -e` would otherwise abort the loop.
    wait "$child" || true
done
