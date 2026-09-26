#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Docker-free local Supabase-like stack for development and end-to-end tests
# (Linux x86_64). Prefer `supabase start` (Supabase CLI + Docker) when you can;
# this script exists for environments without Docker.
#
#   bash scripts/local/stack.sh start   # Postgres + Supabase Auth + PostgREST + gateway
#   bash scripts/local/stack.sh stop
#   bash scripts/local/stack.sh reset   # wipe the database and start again
#   bash scripts/local/stack.sh env     # print VITE_* variables for .env.local
#
# Services: gateway http://127.0.0.1:54321 (auth/v1, rest/v1, /__mail),
# Postgres 127.0.0.1:54322, SMTP sink 127.0.0.1:2500. Storage and Realtime are
# not emulated (file uploads and live feed updates need a real project).
# -----------------------------------------------------------------------------
set -euo pipefail
shopt -s nullglob

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STATE="$ROOT/.local/stack"
BIN="$ROOT/.local/bin"
PG_PORT=54322
JWT_SECRET="applyhub-local-dev-secret-at-least-32-characters-long"
POSTGREST_VERSION="v13.0.8"
AUTH_VERSION="v2.197.0"

log() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }

as_pg_user() {
  if [[ "$(id -u)" == "0" ]]; then runuser -u postgres -- "$@"; else "$@"; fi
}

pg_bin() {
  if command -v initdb >/dev/null 2>&1; then dirname "$(command -v initdb)"; else
    ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -n 1; fi
}

download_binaries() {
  mkdir -p "$BIN"
  if [[ ! -x "$BIN/postgrest" ]]; then
    log "Downloading PostgREST $POSTGREST_VERSION"
    curl -fsSL "https://github.com/PostgREST/postgrest/releases/download/$POSTGREST_VERSION/postgrest-$POSTGREST_VERSION-linux-static-x86-64.tar.xz" \
      | tar -xJ -C "$BIN"
  fi
  if [[ ! -x "$BIN/auth/auth" ]]; then
    log "Downloading Supabase Auth $AUTH_VERSION"
    mkdir -p "$BIN/auth"
    curl -fsSL "https://github.com/supabase/auth/releases/download/$AUTH_VERSION/auth-$AUTH_VERSION-x86.tar.gz" \
      | tar -xz -C "$BIN/auth"
  fi
}

psql_su() { psql -X -q -v ON_ERROR_STOP=1 "postgresql://postgres@127.0.0.1:$PG_PORT/postgres" "$@"; }

start_postgres() {
  local bin; bin="$(pg_bin)"
  mkdir -p "$STATE"
  if [[ "$(id -u)" == "0" ]]; then chown postgres "$STATE"; fi
  if [[ ! -d "$STATE/pg" ]]; then
    log "Initializing PostgreSQL cluster"
    as_pg_user "$bin/initdb" -D "$STATE/pg" -U postgres --auth=trust -E UTF8 >/dev/null
  fi
  if ! as_pg_user "$bin/pg_ctl" -D "$STATE/pg" status >/dev/null 2>&1; then
    log "Starting PostgreSQL on 127.0.0.1:$PG_PORT"
    as_pg_user "$bin/pg_ctl" -D "$STATE/pg" -l "$STATE/pg.log" -w \
      -o "-p $PG_PORT -k /tmp -c listen_addresses=127.0.0.1 -c wal_level=logical" start >/dev/null
  fi
}

bootstrap_database() {
  log "Bootstrapping roles and schemas"
  psql_su -f "$ROOT/supabase/tests/shim/00_platform.sql" >/dev/null 2>&1
  psql_su -c "alter role postgres set search_path = public, extensions" >/dev/null
  psql_su -c "alter role supabase_auth_admin set search_path = auth" >/dev/null

  log "Running Supabase Auth migrations"
  (cd "$BIN/auth" && GOTRUE_DB_DRIVER=postgres \
    DATABASE_URL="postgres://supabase_auth_admin:supabase_auth_admin@127.0.0.1:$PG_PORT/postgres?sslmode=disable" \
    GOTRUE_DB_NAMESPACE=auth API_EXTERNAL_URL="http://127.0.0.1:54321/auth/v1" \
    GOTRUE_SITE_URL="http://localhost:5173" GOTRUE_JWT_SECRET="$JWT_SECRET" \
    GOTRUE_DB_MIGRATIONS_PATH="$BIN/auth/migrations" \
    ./auth migrate >"$STATE/auth-migrate.log" 2>&1) || { cat "$STATE/auth-migrate.log"; exit 1; }
  psql_su -c "grant usage on schema auth to anon, authenticated, service_role;
              grant execute on all functions in schema auth to anon, authenticated, service_role;" >/dev/null

  psql_su -f "$ROOT/supabase/tests/shim/20_storage.sql" >/dev/null 2>&1
  psql_su -c "create schema if not exists local_meta;
              create table if not exists local_meta.applied_migrations (name text primary key, applied_at timestamptz default now());" >/dev/null

  local file name
  for file in "$ROOT"/supabase/migrations/*.sql; do
    name="$(basename "$file")"
    if [[ -z "$(psql_su -At -c "select 1 from local_meta.applied_migrations where name = '$name'")" ]]; then
      log "Applying $name"
      psql_su --single-transaction -f "$file" -c "insert into local_meta.applied_migrations (name) values ('$name')" >/dev/null
    fi
  done
  psql_su -c "notify pgrst, 'reload schema'" >/dev/null
}

start_bg() {
  local name="$1"; shift
  if [[ -f "$STATE/$name.pid" ]] && kill -0 "$(cat "$STATE/$name.pid")" 2>/dev/null; then return; fi
  nohup "$@" >"$STATE/$name.log" 2>&1 &
  echo $! >"$STATE/$name.pid"
}

start_services() {
  log "Starting Supabase Auth on :9999"
  (cd "$BIN/auth" && start_bg auth env \
    GOTRUE_API_HOST=127.0.0.1 PORT=9999 \
    API_EXTERNAL_URL="http://127.0.0.1:54321/auth/v1" \
    GOTRUE_DB_DRIVER=postgres GOTRUE_DB_NAMESPACE=auth \
    DATABASE_URL="postgres://supabase_auth_admin:supabase_auth_admin@127.0.0.1:$PG_PORT/postgres?sslmode=disable" \
    GOTRUE_SITE_URL="http://localhost:5173" \
    GOTRUE_URI_ALLOW_LIST="http://localhost:5173/**,http://localhost:4173/**,http://127.0.0.1:5173/**,http://127.0.0.1:4173/**" \
    GOTRUE_JWT_SECRET="$JWT_SECRET" GOTRUE_JWT_EXP=3600 GOTRUE_JWT_AUD=authenticated \
    GOTRUE_JWT_ADMIN_ROLES=service_role GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated \
    GOTRUE_DISABLE_SIGNUP=false GOTRUE_EXTERNAL_EMAIL_ENABLED=true \
    GOTRUE_MAILER_AUTOCONFIRM=false GOTRUE_MAILER_OTP_EXP=3600 \
    GOTRUE_SMTP_HOST=127.0.0.1 GOTRUE_SMTP_PORT=2500 GOTRUE_SMTP_USER=local GOTRUE_SMTP_PASS=local \
    GOTRUE_SMTP_ADMIN_EMAIL=noreply@applyhub.local GOTRUE_SMTP_SENDER_NAME=ApplyHub \
    GOTRUE_RATE_LIMIT_EMAIL_SENT=1000 GOTRUE_SMTP_MAX_FREQUENCY=1s \
    GOTRUE_PASSWORD_MIN_LENGTH=8 \
    GOTRUE_MAILER_URLPATHS_INVITE=/auth/v1/verify GOTRUE_MAILER_URLPATHS_CONFIRMATION=/auth/v1/verify \
    GOTRUE_MAILER_URLPATHS_RECOVERY=/auth/v1/verify GOTRUE_MAILER_URLPATHS_EMAIL_CHANGE=/auth/v1/verify \
    ./auth serve)

  log "Starting PostgREST on :3000"
  start_bg postgrest env \
    PGRST_DB_URI="postgres://authenticator:authenticator@127.0.0.1:$PG_PORT/postgres" \
    PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon PGRST_JWT_SECRET="$JWT_SECRET" \
    PGRST_DB_EXTRA_SEARCH_PATH=public,extensions PGRST_SERVER_PORT=3000 PGRST_DB_MAX_ROWS=1000 \
    PGRST_DB_CHANNEL_ENABLED=true \
    "$BIN/postgrest"

  log "Starting gateway on :54321 (SMTP sink on :2500)"
  start_bg gateway node "$ROOT/scripts/local/gateway.mjs"
  sleep 2
}

print_env() {
  echo "VITE_SUPABASE_URL=http://127.0.0.1:54321"
  echo "VITE_SUPABASE_ANON_KEY=$(node "$ROOT/scripts/local/jwt.mjs" "$JWT_SECRET" anon)"
}

stop_all() {
  local name
  for name in gateway postgrest auth; do
    if [[ -f "$STATE/$name.pid" ]]; then
      kill "$(cat "$STATE/$name.pid")" 2>/dev/null || true
      rm -f "$STATE/$name.pid"
    fi
  done
  if [[ -d "$STATE/pg" ]]; then
    as_pg_user "$(pg_bin)/pg_ctl" -D "$STATE/pg" -m fast stop >/dev/null 2>&1 || true
  fi
}

case "${1:-start}" in
  start)
    download_binaries
    start_postgres
    bootstrap_database
    start_services
    log "Stack is up. Put these in .env.local:"
    print_env
    ;;
  stop) stop_all ;;
  reset) stop_all; rm -rf "$STATE"; "$0" start ;;
  env) print_env ;;
  *) echo "usage: $0 start|stop|reset|env" >&2; exit 1 ;;
esac
