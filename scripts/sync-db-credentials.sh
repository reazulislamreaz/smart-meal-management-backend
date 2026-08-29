#!/bin/sh
# ==============================================================================
# Aligns the PostgreSQL role password with POSTGRES_PASSWORD on every deploy.
#
# POSTGRES_PASSWORD is only applied when the data volume is first initialised,
# so without this the app and the database silently drift apart and every query
# fails with "authentication failed against the database server".
#
# Runs inside a postgres image as a one-shot compose service, connecting over
# the shared unix socket where pg_hba grants local trust — so it works even when
# the stored password no longer matches .env.
# ==============================================================================
set -eu

SOCKET_DIR="${PGHOST:-/var/run/postgresql}"
DB_USER="${POSTGRES_USER:-postgres}"
DB_PASSWORD="${POSTGRES_PASSWORD:-postgres}"

if [ "$DB_PASSWORD" = "postgres" ]; then
  echo "WARNING: POSTGRES_PASSWORD is still the default value. Set a strong password in .env."
fi

if ! psql -h "$SOCKET_DIR" -U "$DB_USER" -d postgres -tAc 'SELECT 1' >/dev/null 2>&1; then
  # Cannot even use the trusted local socket: the role is usually NOLOGIN or
  # missing. Exit 0 so the deploy is not deadlocked — the API fails fast with a
  # clear log instead — but make the required manual step obvious.
  echo "ERROR: cannot log in as role '$DB_USER' over the local socket."
  psql -h "$SOCKET_DIR" -U "$DB_USER" -d postgres -tAc 'SELECT 1' 2>&1 | sed 's/^/  /' || true
  echo "  The role is most likely NOLOGIN or dropped; a password change cannot repair that."
  echo "  Run ./scripts/repair-db-credentials.sh on the host to restore it."
  exit 0
fi

psql -h "$SOCKET_DIR" -U "$DB_USER" -d postgres -v ON_ERROR_STOP=1 \
  -c "ALTER ROLE \"$DB_USER\" WITH LOGIN PASSWORD '$DB_PASSWORD';" >/dev/null

echo "Database credentials synced for role '$DB_USER'."
