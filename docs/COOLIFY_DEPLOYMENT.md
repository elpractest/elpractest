# Coolify deployment — e-Learning Practest

**This is the authoritative deploy runbook.** The cPanel model (root
`DEPLOYMENT_SETUP.md`, `docs/DEPLOYMENT.md`, `docs/INFRASTRUCTURE.md`) is retired
— those files describe the old tarball-over-SSH deploy and are kept only for
history. Trust this file for anything deploy-related.

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
2. **Application** → *Docker Compose* → source = this GitHub repo, branch `main`,
   compose file `docker-compose.coolify.yml`.
3. **Domains** — set per service: `api` → `api.practest.live`, `app` →
   `app.practest.live`, `web` → `practest.live` and `www.practest.live`.
4. **Environment variables** (below). `APP_KEY` is generated once and must stay
   stable — regenerating it invalidates every session and encrypted value.
5. **Turn OFF auto-deploy-on-push.** Deploys are gated by CI (see *CI*), so the
   only path to prod is a green `api-tests` run.
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

`.github/workflows/ci.yml`: `api-tests` (Laravel suite on MariaDB 10.6) is the
gate. On a green push to `main` the `deploy` job calls the Coolify deploy API.
Set these repo secrets:

```
COOLIFY_URL        https://<coolify-host>       (no trailing slash)
COOLIFY_TOKEN      <a Coolify API token>
COOLIFY_APP_UUID   <the Practest compose app's resource UUID>
```

## Rollback

DNS is the switch: repoint the four A records back to the cPanel IP (cPanel is
left intact until Coolify is proven). Coolify also keeps prior deployments for a
one-click redeploy. The DB is fresh, so rollback risks no data loss.

## Known follow-up — database backups

The DB is an **embedded compose service**, not a Coolify *managed database*, so it
has no automatic backups. Before this holds real user data long-term, add a
nightly `mariadb-dump` (Coolify scheduled task or a cron sidecar) to a preserved
volume / offsite — or migrate it to a Coolify-managed MariaDB resource.
