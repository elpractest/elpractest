# Coolify deployment — e-Learning Practest

**This is the authoritative — and only — deploy runbook.** Practest deploys
exclusively to Coolify (Docker). The old cPanel tarball-over-SSH model has been
fully removed from the repo; there is no cPanel dependency anywhere in the build
or runtime.

## What runs

Practest is one **Coolify Docker Compose application** built from
[`docker-compose.coolify.yml`](../docker-compose.coolify.yml), with four services
plus an embedded database:

| service  | image (built on the host)     | domain                          | port |
|----------|-------------------------------|---------------------------------|------|
| `web`    | Astro static → nginx          | `practest.live`, `www.`         | 80   |
| `app`    | React SPA (Vite) → nginx      | `app.practest.live`             | 80   |
| `api`    | Laravel 12, serversideup fpm  | `api.practest.live`             | 8080 |
| `worker` | Laravel (queue:work)          | — (no domain)                   | —    |
| `mariadb`| mariadb:10.6                  | — (internal only)               | 3306 |

Traefik (Coolify's proxy) terminates TLS and routes each domain. The API image
runs migrations + `artisan optimize` + `storage:link` at boot (serversideup
`AUTORUN_*`). Frontends bake their `VITE_*` / `PUBLIC_*` values at **build** time.

## First-time setup in Coolify

1. **Project** → new project `practest`, environment `production`.
2. **Application** → *Docker Compose* → source = this GitHub repo, branch
   `deploy/coolify`, compose file `docker-compose.coolify.yml`. The tracked
   branch **must** be `deploy/coolify`: Coolify builds from its own configured
   branch regardless of what triggers the deploy, so pointing it at `main`
   (which is stale) would ship the wrong code.
3. **Domains** — set per service: `api` → `api.practest.live`, `app` →
   `app.practest.live`, `web` → `practest.live` and `www.practest.live`.
4. **Environment variables** (below). `APP_KEY` is generated once and must stay
   stable — regenerating it invalidates every session and encrypted value.
5. **Turn OFF Coolify's own auto-deploy-on-push.** Deploys are gated by CI (see
   *CI*), so the only path to prod is a green `api-tests` run on `deploy/coolify`
   — which then calls Coolify's deploy API. Coolify's built-in webhook deploy
   would bypass that gate, so keep it off.
6. Deploy. Watch the build logs; all five containers should go healthy.

### Required env (set in Coolify)

```
APP_KEY=base64:...            # generate once: `php artisan key:generate --show`
APP_ENV=production
APP_DEBUG=false
APP_URL=https://api.practest.live
DB_DATABASE=practest
DB_USERNAME=practest
DB_PASSWORD=<random>
DB_ROOT_PASSWORD=<random>
SESSION_DOMAIN=.practest.live
SANCTUM_STATEFUL_DOMAINS=app.practest.live
CORS_ALLOWED_ORIGINS=https://app.practest.live
FRONTEND_URL=https://app.practest.live
VITE_API_URL=https://api.practest.live      # build arg for the app image
PUBLIC_API_URL=https://api.practest.live     # build arg for the web image
PUBLIC_SPA_URL=https://app.practest.live     # build arg for the web image
SUPER_ADMIN_NAME=Thevi Institution
SUPER_ADMIN_EMAIL=thevinstitution@gmail.com
SUPER_ADMIN_PASSWORD=<set a real one>
```

### Optional / feature-gated env

`MAIL_MAILER` (+ `MAIL_*` — a real mailer for notifications; MSG91 handles OTP),
`GOOGLE_CLIENT_ID/SECRET`, `FACEBOOK_CLIENT_ID/SECRET` (redirect URIs are
unchanged by the move), `MSG91_*`, `RAZORPAY_*`, `RECAPTCHA_SECRET_KEY` +
`VITE_RECAPTCHA_SITE_KEY` (build arg), `OPENAI_API_KEY` (Vajini — returns 503
without it, nothing else affected; run `php artisan vajini:index` once after
setting). reCAPTCHA/GTM keys that the frontends use are **build args**, so a
change to them needs a rebuild, not just a restart.

### After the first deploy — seed the super-admin (one-off)

Migrations autorun, but seeding does **not** (so it never re-runs on restart).
Once, via a Coolify terminal on the `api` container:

```bash
php artisan db:seed --force
```

## DNS cutover

Same hostnames as before, so OAuth / reCAPTCHA / MSG91 configs need no change.

1. Lower TTL on `practest.live`, `www`, `app`, `api` ahead of time.
2. Verify the stack is healthy on the box first (see *Verification*).
3. Point all four A records at the Coolify host IP. Remove old cPanel A/AAAA.
4. Traefik issues Let's Encrypt certs on first request after DNS propagates.

## Verification

```bash
# Before DNS (from a shell on the Coolify host, hitting the internal service):
#   /up 200, /api/settings/public 200, /api/admin/test-series 401 (route cache OK)
# After DNS:
curl -fsS -o /dev/null -w '%{http_code}\n' https://practest.live/
curl -fsS -o /dev/null -w '%{http_code}\n' https://app.practest.live/
curl -fsS -o /dev/null -w '%{http_code}\n' https://api.practest.live/up
```

Then log in from the SPA (proves Sanctum cross-origin cookie + XSRF) and upload a
banner in admin (proves the `public` disk + `storage:link`).

## CI (the deploy gate)

`.github/workflows/ci.yml` uses a **promotion-branch** model, not a deploy API
call: push to `main` → `api-tests` runs (Laravel suite on MariaDB 10.6) → only
if green, CI fast-forwards `deploy/coolify` to that exact tested commit using
the automatic `GITHUB_TOKEN` — no Coolify credential involved. Coolify's own
GitHub-App webhook watches `deploy/coolify` and rebuilds when it moves, so the
gate is structural: that branch cannot advance unless the tests passed, because
nothing else advances it. Keep Coolify's tracked branch as `deploy/coolify` and
its auto-deploy-on-push **on** — that webhook is what applies the promotion. A
direct push to `deploy/coolify` bypasses the gate, so avoid pushing there
directly; push to `main` instead.

## Rollback

Coolify keeps prior deployments — roll back with a one-click redeploy of the
previous image from the application's Deployments tab. Because the database is an
embedded compose service, a rollback that predates a migration can leave schema
ahead of code; take a backup (see *Database backups* below, or a manual
`mariadb-dump`) before deploying anything with migrations so you can restore if
you roll code back.

## Database backups

The DB is an **embedded compose service**, not a Coolify *managed database*, so
it has no backups on its own. A `backup` service in `docker-compose.coolify.yml`
handles this: nightly (default 2:30am IST, `BACKUP_SCHEDULE` to change) it dumps
MariaDB and pushes an encrypted, deduplicated snapshot offsite via
[restic](https://restic.net/), to any S3-compatible bucket. **It no-ops until
configured** — the stack builds and deploys fine before a bucket exists, same
as the FCM/OpenAI integrations.

### One-time setup — Cloudflare R2

R2 is the recommended target: same account you already use for DNS, S3-compatible,
no egress fees, and a free tier that comfortably covers years of nightly SQL
dumps for one institute's database.

1. Cloudflare dashboard → **R2** → **Create bucket** → name it `practest-backups`.
2. **R2** → **Manage API tokens** → **Create API token** → permission *Object
   Read & Write*, scoped to that bucket only. Copy the **Access Key ID**,
   **Secret Access Key**, and the **Account ID** shown on the token page.
3. Generate a strong passphrase for `BACKUP_RESTIC_PASSWORD` (e.g.
   `openssl rand -base64 32`) and **save it somewhere outside this server** — a
   password manager, not a note on the box being backed up. This encrypts every
   snapshot; losing it makes the backups permanently unreadable, so it is worth
   treating with the same care as a database root password.
4. Set in Coolify (`backup` service reads these; empty = disabled):

   ```
   BACKUP_RESTIC_REPOSITORY=s3:https://<ACCOUNT_ID>.r2.cloudflarestorage.com/practest-backups
   BACKUP_RESTIC_PASSWORD=<the passphrase from step 3>
   BACKUP_S3_ACCESS_KEY_ID=<from step 2>
   BACKUP_S3_SECRET_ACCESS_KEY=<from step 2>
   ```

   Optional: `BACKUP_SCHEDULE` (cron expression, default `30 2 * * *`),
   `TZ` (default `Asia/Kolkata`), `BACKUP_KEEP_DAILY`/`_WEEKLY`/`_MONTHLY`
   (defaults 14/8/6).

5. Redeploy — this adds the `backup` container to the stack.

### Verify a backup actually ran

```bash
# From a Coolify terminal on the backup container, or `docker exec`:
backup                  # trigger one immediately, don't wait for 2:30am
restic snapshots         # should list what you just took
```

### Restore rehearsal — do this once, not just when you need it

An untested backup is a hope, not a plan. From the `backup` container:

```bash
# 1. See what's available.
restic snapshots

# 2. Restore the latest snapshot's SQL dump to disk.
restic restore latest --target /tmp/restore

# 3. Load it into a THROWAWAY database, never straight into prod, to prove the
#    dump is actually valid and complete.
mysql -h mariadb -u root -p"$DB_ROOT_PASSWORD" -e "CREATE DATABASE restore_check"
mysql -h mariadb -u root -p"$DB_ROOT_PASSWORD" restore_check < /tmp/restore/practest-*.sql

# 4. Sanity-check row counts against prod, then drop it.
mysql -h mariadb -u root -p"$DB_ROOT_PASSWORD" -e "SELECT COUNT(*) FROM restore_check.users; DROP DATABASE restore_check"
```

A real disaster restore is the same steps 1–2, then loading into the live
`practest` database instead of a throwaway one (take the app offline first).
