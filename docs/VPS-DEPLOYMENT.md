# Docker and GitHub Actions deployment

## Production addresses

| Component | Address |
| --- | --- |
| Frontend | `https://coffee.efnanbusinessplc.com` |
| API base | `https://api.efnanbusinessplc.com/api` |
| API health | `https://api.efnanbusinessplc.com/api/health` |
| VPS | `201.79.85.180` (Ubuntu 24.04, linux/amd64) |

Nginx terminates HTTPS and proxies the frontend to `127.0.0.1:3000` and API
to `127.0.0.1:3001`. The frontend build embeds the API base URL above.
Changing `NEXT_PUBLIC_API_URL` requires a new image build.
The original frontend `/api/` proxy is retained for older browser sessions.

## How CI/CD works

The active workflow is **`.github/workflows/deploy.yml` at the repository root**.
Older FTP workflows under each application's `.github` directory are inactive
in this combined repository and are not used for VPS deployment.

1. Every pull request and push to `main` builds the API and frontend images
   with `npm ci`, compiling the API and running Next.js build/type checks.
2. `deploy/smoke-test.sh` starts an isolated PostgreSQL container and the exact
   runtime images. It checks database-backed API startup, health, authentication
   protection, CORS, and the frontend login page. Production data is not used.
3. Only successful builds on `main` package images, tagged with the full Git SHA,
   into a short-lived workflow artifact. PRs never receive deployment secrets.
4. The dependent deployment job transfers that artifact over SSH. It verifies
   the VPS's pinned host key and the release checksums, then loads the images.
5. The server locks deployment, backs up PostgreSQL, applies pending migrations,
   and starts both containers with Docker Compose. It checks container health
   and both public HTTPS endpoints before marking the release current.
6. Failed application starts restore the previous application images. Database
   migrations are not automatically reversed: make migrations compatible with
   the previous release and plan separately for destructive changes.

Builds happen on GitHub runners, not on the 2 GB VPS. Deployment jobs are
serialized; an older build skips deployment if a newer commit is already on
`main`. There is a brief restart window when replacing the containers.

## GitHub setup

In this repository's **Settings -> Secrets and variables -> Actions**, set:

| Repository secret | Value |
| --- | --- |
| `HOST` | `201.79.85.180` |
| `USERNAME` | `root` |
| `SSH_PRIVATE_KEY` | Complete unencrypted deployment private key, including header/footer |

The matching public key must be in `/root/.ssh/authorized_keys`. These are the
three existing SSH secrets; no registry token is needed because CI transfers
the built images directly. The key must work without an interactive passphrase.

The workflow pins the verified VPS ED25519 public host key. If the VPS is
reinstalled, verify its new host key out of band and update the workflow before
deployment. Do not disable host verification or replace it with unverified
`ssh-keyscan` output.

Enable Actions, push the workflow to `main`, and inspect **Actions -> CI and VPS
deployment**. You may also run it manually on `main`. Configure branch protection
to require **Build and integration checks** before merging; this is a repository
setting, not something a workflow file enables automatically.

## VPS prerequisites and persistent files

This deployment intentionally keeps the existing host PostgreSQL database and
Nginx/Certbot installation. Docker Compose uses Linux host networking so the
API can reach PostgreSQL on `127.0.0.1`; both application processes also bind
only to loopback. Do not add public Docker port mappings.

The server needs Docker Engine with Compose v2+ (`docker compose`), PostgreSQL
client tools, `flock`, curl, Nginx, Certbot, and enough free disk for image
archives, two application versions, and database backups. Docker must start at
boot. The shipped deployment script requires root.

| Path | Purpose |
| --- | --- |
| `/etc/coffee/api.env` | Server-only API and database secrets, mode `600` |
| `/var/lib/coffee/uploads` | Persistent documents, writable by container UID/GID `1000:1000` |
| `/opt/coffee/releases/<SHA>` | Tested images, checksums, Compose file, deployment script |
| `/opt/coffee/current.env` | Active image tag |
| `/opt/coffee/previous.env` | Previous successful image tag |
| `/var/backups/coffee/*.dump` | PostgreSQL custom-format backups before migrations |

The existing database is `coffee`, owned by PostgreSQL role `coffee`. Preserve
the existing database password, JWT secrets, administrator, and data. The server
environment file includes:

```dotenv
NODE_ENV=production
HOST=127.0.0.1
PORT=3001
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USERNAME=coffee
DB_PASSWORD=REPLACE_WITH_EXISTING_DATABASE_PASSWORD
DB_DATABASE=coffee
DB_SYNCHRONIZE=false
DB_SEED=false
JWT_AT_SECRET=REPLACE_WITH_EXISTING_ACCESS_SECRET
JWT_RT_SECRET=REPLACE_WITH_EXISTING_REFRESH_SECRET
CORS_ORIGIN=https://coffee.efnanbusinessplc.com
FRONTEND_URL=https://coffee.efnanbusinessplc.com
PASSWORD_RESET_EXPIRES_MINUTES=60
SMTP_HOST=REPLACE_WITH_SMTP_HOST
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=REPLACE_WITH_SMTP_USER
SMTP_PASS=REPLACE_WITH_SMTP_PASSWORD
SMTP_FROM=noreply@efnanbusinessplc.com
MARKET_ALLOW_DEMO_FALLBACK=false
```

Keep secrets on the VPS. They are excluded from Docker build contexts and are
never uploaded as GitHub artifacts. CORS must allow the frontend's origin;
DNS accepting subdomains does not configure browser CORS automatically.

The first container deployment replaces the original `coffee-api` and
`coffee-frontend` systemd processes. It retains those service definitions for
first-deployment rollback. Nginx, PostgreSQL, and Certbot stay on the host.
Uploads have been copied from the original repository into the persistent
directory. The original clone is no longer the deployment source.

## Domains and HTTPS

Both domain A records must point to the VPS. Nginx virtual hosts forward
`coffee.efnanbusinessplc.com` to port 3000 and `api.efnanbusinessplc.com` to port
3001, retaining the `/api` path. The upload limit is currently 20 MB.
Existing configurations are in `/etc/nginx/sites-available/coffee`.

```bash
nginx -t
systemctl reload nginx
certbot --nginx -d coffee.efnanbusinessplc.com -d api.efnanbusinessplc.com
systemctl status certbot.timer
```

Certificates for both addresses are installed with automatic renewal.
Do not overwrite other sites hosted on the same VPS. Only SSH, HTTP, and HTTPS
need to be public; PostgreSQL and application ports remain private.

## Logs and verification

```bash
cd /opt/coffee
tag=$(sed -n 's/^IMAGE_TAG=//p' current.env)
export IMAGE_TAG=$tag
docker compose -f "releases/$tag/compose.production.yml" ps
docker compose -f "releases/$tag/compose.production.yml" logs --tail=100 api frontend
curl -fsS https://api.efnanbusinessplc.com/api/health
curl -I https://coffee.efnanbusinessplc.com/login
```

The administrator is `admin@efnanbusinessplc.com`. The original generated
password is in `/root/coffee-deployment/admin-password`; it may have been changed
since deployment. Demo users and stock are not seeded in production.

## Migrations, backup, and rollback

The original empty production database was initialized from the entities and
its existing migrations were marked applied. There is no initial schema migration
in this repository: the incremental migrations cannot initialize an empty
database. This pipeline targets the existing initialized VPS database.
For a new server, prepare and validate a baseline schema/migration separately
before enabling deployment. Never turn on synchronization for a populated
production database.

Add a TypeORM migration for every schema change. CI's disposable database is
created from current entities, so also test migration upgrades against a restored
staging backup. A schema build check cannot prove a production migration safe.

To manually restore the previous application version:

```bash
cd /opt/coffee
previous=$(sed -n 's/^IMAGE_TAG=//p' previous.env)
IMAGE_TAG=$previous docker compose -f "releases/$previous/compose.production.yml" \
  up -d --wait --wait-timeout 180
cp current.env failed.env
cp previous.env current.env
```

Do not blindly restore a database backup over live writes. Put the app into
maintenance, preserve the current database, and restore the chosen dump into a
separate database with `pg_restore` to validate recovery before switching.

Back up `/var/lib/coffee/uploads`, `/etc/coffee/api.env`, and PostgreSQL off the
VPS regularly. Pre-deployment backups do not replace scheduled off-server backups.
Monitor disk use and remove old release archives, backups, and unused image tags
according to a retention policy, keeping current and previous images.
Avoid global Docker cleanup commands: this VPS also hosts other applications.
