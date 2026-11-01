#!/usr/bin/env bash
set -euo pipefail
tag=${1:?Usage: smoke-test.sh IMAGE_TAG}
suffix="coffee-ci-$$"
cleanup() { docker rm -f "$suffix-api" "$suffix-frontend" "$suffix-db" >/dev/null 2>&1 || true; }
trap cleanup EXIT
docker run -d --name "$suffix-db" -p 127.0.0.1:6543:5432 \
  -e POSTGRES_DB=coffee_ci -e POSTGRES_PASSWORD=ci-only-password postgres:16-bookworm >/dev/null
for attempt in {1..60}; do
  if docker exec "$suffix-db" pg_isready -U postgres -d coffee_ci >/dev/null 2>&1; then break; fi
  sleep 2
done
docker run -d --name "$suffix-api" --network host \
  -e HOST=127.0.0.1 -e PORT=3301 -e DB_HOST=127.0.0.1 -e DB_PORT=6543 \
  -e DB_USERNAME=postgres -e DB_PASSWORD=ci-only-password -e DB_DATABASE=coffee_ci \
  -e DB_SYNCHRONIZE=true -e DB_SEED=false \
  -e JWT_AT_SECRET=ci-access-secret -e JWT_RT_SECRET=ci-refresh-secret \
  -e CORS_ORIGIN=https://coffee.efnanbusinessplc.com \
  "coffee-api:$tag" >/dev/null
ready=false
for attempt in {1..90}; do
  if curl -fsS http://127.0.0.1:3301/api/health > /tmp/coffee-ci-health-$$ 2>/dev/null; then ready=true; break; fi
  sleep 2
done
if [[ $ready != true ]]; then docker logs "$suffix-api"; exit 1; fi
grep -q '"status":"ok"' /tmp/coffee-ci-health-$$
rm /tmp/coffee-ci-health-$$
[[ $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3301/api/auth/me) == 401 ]]
[[ $(curl -s -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' \
  -d '{"email":"missing@example.com","password":"invalid-password"}' \
  http://127.0.0.1:3301/api/auth/login) == 401 ]]
curl -fsS -X OPTIONS -H 'Origin: https://coffee.efnanbusinessplc.com' \
  -H 'Access-Control-Request-Method: POST' -D - -o /dev/null \
  http://127.0.0.1:3301/api/auth/login | tr -d '\r' | \
  grep -qi '^Access-Control-Allow-Origin: https://coffee.efnanbusinessplc.com$'
docker run -d --name "$suffix-frontend" --network host -e HOSTNAME=127.0.0.1 -e PORT=3300 \
  "coffee-frontend:$tag" >/dev/null
ready=false
for attempt in {1..60}; do
  if curl -fsS http://127.0.0.1:3300/login >/dev/null 2>&1; then ready=true; break; fi
  sleep 2
done
if [[ $ready != true ]]; then docker logs "$suffix-frontend"; exit 1; fi
echo 'Passed: database-backed API startup, health, auth protection, CORS, and frontend login page.'
