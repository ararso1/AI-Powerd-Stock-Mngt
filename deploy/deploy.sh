#!/usr/bin/env bash
set -euo pipefail
[[ $EUID == 0 ]] || { echo 'Run as root (or with passwordless sudo).'; exit 1; }
tag=${1:?Usage: deploy.sh GIT_COMMIT_SHA}
[[ $tag =~ ^[a-f0-9]{40}$ ]] || { echo 'Expected a full Git commit SHA.'; exit 1; }
release=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
[[ $release == "/opt/coffee/releases/$tag" ]] || { echo 'Unexpected release path.'; exit 1; }
install -d -m 700 /opt/coffee /var/backups/coffee
exec 9>/opt/coffee/deploy.lock
flock -n 9 || { echo 'Another deployment is running.'; exit 1; }
cd "$release"
sha256sum -c SHA256SUMS
test -s /etc/coffee/api.env
test -d /var/lib/coffee/uploads
gzip -dc images.tar.gz | docker load
export IMAGE_TAG=$tag
docker compose -f compose.production.yml config --quiet
previous=''
if [[ -f /opt/coffee/current.env ]]; then
  previous=$(sed -n 's/^IMAGE_TAG=//p' /opt/coffee/current.env)
  [[ $previous =~ ^[a-f0-9]{40}$ ]] || exit 1
fi
# Keep a database backup before running forward migrations. Never synchronize production.
runuser -u postgres -- pg_dump -Fc coffee > "/var/backups/coffee/$(date -u +%Y%m%dT%H%M%SZ)-$tag.dump"
chmod 600 /var/backups/coffee/*.dump
docker compose -f compose.production.yml run --rm --no-deps api \
  node node_modules/typeorm/cli.js migration:run -d dist/database/data-source.js
switched=false
rollback() {
  result=$?
  if [[ $result != 0 && $switched == true ]]; then
    echo 'Deployment failed; restoring previous application services.'
    if [[ -n $previous ]]; then
      IMAGE_TAG=$previous docker compose -f "/opt/coffee/releases/$previous/compose.production.yml" \
        up -d --wait --wait-timeout 180 || true
    else
      docker compose -f compose.production.yml down || true
      systemctl enable --now coffee-api coffee-frontend || true
    fi
    echo 'Database migrations are not automatically reversed. Inspect the backup if needed.'
  fi
  exit "$result"
}
trap rollback EXIT
switched=true
# First container release replaces the original systemd processes on the same loopback ports.
systemctl disable --now coffee-api coffee-frontend
docker compose -f compose.production.yml up -d --wait --wait-timeout 180
curl --retry 5 --retry-delay 3 --retry-all-errors -fsS https://api.efnanbusinessplc.com/api/health
curl --retry 5 --retry-delay 3 --retry-all-errors -fsS https://coffee.efnanbusinessplc.com/login >/dev/null
if [[ -f /opt/coffee/current.env ]]; then cp /opt/coffee/current.env /opt/coffee/previous.env; fi
printf 'IMAGE_TAG=%s\n' "$tag" > /opt/coffee/current.env
chmod 600 /opt/coffee/current.env
echo "Deployed tested release $tag"
