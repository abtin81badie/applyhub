#!/usr/bin/env bash
# Shared helpers for scripts/db/*.sh: start a throwaway PostgreSQL (or use
# DATABASE_URL), install the Supabase shim and apply all migrations.
# After `db_setup`, TEST_URL points at a fully migrated database.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MIGRATIONS_DIR="$ROOT/supabase/migrations"
TESTS_DIR="$ROOT/supabase/tests"
DB_NAME="${DB_NAME:-applyhub_test}"
TMP_DIR=""
PG_BIN=""
TEST_URL=""

log() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }

as_pg_user() {
  if [[ "$(id -u)" == "0" ]]; then
    runuser -u postgres -- "$@"
  else
    "$@"
  fi
}

db_cleanup() {
  if [[ -n "$TMP_DIR" && -d "$TMP_DIR/data" ]]; then
    as_pg_user "$PG_BIN/pg_ctl" -D "$TMP_DIR/data" -m immediate stop >/dev/null 2>&1 || true
  fi
  if [[ -n "$TMP_DIR" ]]; then
    rm -rf "$TMP_DIR"
  fi
}

run_psql() {
  psql -X -q -v ON_ERROR_STOP=1 "$TEST_URL" "$@"
}

db_start() {
  if [[ -n "${DATABASE_URL:-}" ]]; then
    log "Using existing server from DATABASE_URL"
    psql -X -q -v ON_ERROR_STOP=1 "$DATABASE_URL" \
      -c "drop database if exists $DB_NAME with (force)" \
      -c "create database $DB_NAME"
    TEST_URL="$(printf '%s' "$DATABASE_URL" | sed -E "s#^(postgres(ql)?://[^/]+)/[^?]*#\1/$DB_NAME#")"
    return
  fi

  if command -v initdb >/dev/null 2>&1; then
    PG_BIN="$(dirname "$(command -v initdb)")"
  else
    PG_BIN="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -n 1 || true)"
  fi
  if [[ -z "$PG_BIN" || ! -x "$PG_BIN/initdb" ]]; then
    echo "PostgreSQL server binaries not found. Install PostgreSQL 15+ or set DATABASE_URL." >&2
    exit 1
  fi

  TMP_DIR="$(mktemp -d)"
  chmod 755 "$TMP_DIR"
  if [[ "$(id -u)" == "0" ]]; then chown postgres "$TMP_DIR"; fi
  local port="${DB_TEST_PORT:-55432}"

  log "Starting temporary PostgreSQL ($("$PG_BIN/postgres" --version)) on port $port"
  as_pg_user "$PG_BIN/initdb" -D "$TMP_DIR/data" -U postgres --auth=trust -E UTF8 >/dev/null
  as_pg_user "$PG_BIN/pg_ctl" -D "$TMP_DIR/data" -l "$TMP_DIR/postgres.log" -w \
    -o "-p $port -k $TMP_DIR -c listen_addresses='' -c wal_level=logical" start >/dev/null
  as_pg_user "$PG_BIN/createdb" -h "$TMP_DIR" -p "$port" -U postgres "$DB_NAME"
  TEST_URL="postgresql://postgres@/$DB_NAME?host=$TMP_DIR&port=$port"
}

db_migrate() {
  log "Installing Supabase platform shim"
  run_psql -f "$TESTS_DIR/shim/00_platform.sql" \
           -f "$TESTS_DIR/shim/10_auth.sql" \
           -f "$TESTS_DIR/shim/20_storage.sql" >/dev/null 2>&1

  log "Applying migrations"
  local file
  for file in "$MIGRATIONS_DIR"/*.sql; do
    printf '   %s\n' "$(basename "$file")"
    run_psql --single-transaction -f "$file" >/dev/null
  done
}

db_setup() {
  trap db_cleanup EXIT
  db_start
  db_migrate
}
