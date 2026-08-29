#!/usr/bin/env bash
# ==============================================================================
# Emergency repair for a PostgreSQL superuser that can no longer log in
# (NOLOGIN, revoked SUPERUSER, or an unknown password).
#
# Normal password drift is handled automatically by the db-credentials-sync
# compose service. This script is only needed when even the trusted local socket
# refuses the role, which cannot be fixed while the server is accepting
# connections. It stops PostgreSQL and applies the change in single-user mode.
#
# Usage (on the Docker host, from the backend directory):
#   ./scripts/repair-db-credentials.sh
# ==============================================================================
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "ERROR: .env not found in $(pwd)." >&2
  exit 1
fi

DB_USER="$(grep -E '^POSTGRES_USER=' .env | tail -1 | cut -d= -f2- | tr -d '"'"'"'' || true)"
DB_PASSWORD="$(grep -E '^POSTGRES_PASSWORD=' .env | tail -1 | cut -d= -f2- | tr -d '"'"'"'' || true)"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"

if [[ "$DB_PASSWORD" =~ [\'\\] ]]; then
  echo "ERROR: POSTGRES_PASSWORD contains a quote or backslash; choose a simpler password." >&2
  exit 1
fi

POSTGRES_IMAGE="$(docker compose config --images postgres 2>/dev/null | head -1)"
POSTGRES_IMAGE="${POSTGRES_IMAGE:-postgres:17-alpine}"

container_id="$(docker compose ps -q postgres || true)"
if [ -z "$container_id" ]; then
  echo "ERROR: the postgres service is not created yet. Run 'docker compose up -d postgres' first." >&2
  exit 1
fi

data_volume="$(docker inspect "$container_id" \
  --format '{{range .Mounts}}{{if eq .Destination "/var/lib/postgresql/data"}}{{.Name}}{{end}}{{end}}')"

if [ -z "$data_volume" ]; then
  echo "ERROR: could not resolve the postgres data volume." >&2
  exit 1
fi

echo "==> Data volume: $data_volume"
echo "==> Stopping services that hold database connections"
docker compose stop backend postgres >/dev/null

echo "==> Restoring LOGIN + SUPERUSER and resetting the password in single-user mode"
docker run --rm -i \
  -v "$data_volume":/var/lib/postgresql/data \
  --user postgres \
  --entrypoint postgres \
  "$POSTGRES_IMAGE" \
  --single -D /var/lib/postgresql/data postgres <<SQL
ALTER ROLE "$DB_USER" WITH LOGIN SUPERUSER CREATEDB CREATEROLE PASSWORD '$DB_PASSWORD';
SQL

echo "==> Bringing the stack back up"
docker compose up -d

echo "==> Waiting for the API to report healthy"
for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:"${BACKEND_HOST_PORT:-8888}"/api/v1/health 2>/dev/null | grep -q '"database":"up"'; then
    echo "Repair complete: database reachable and API healthy."
    exit 0
  fi
  sleep 3
done

echo "Repair applied, but the API did not report a healthy database yet." >&2
echo "Check: docker compose logs --tail=50 backend db-credentials-sync" >&2
exit 1
