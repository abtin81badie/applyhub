#!/usr/bin/env bash
# -----------------------------------------------------------------------------
# Applies supabase/migrations to a throwaway PostgreSQL database and runs the
# SQL test suite in supabase/tests/rls (RLS policies, RPCs, triggers).
#
#   npm run db:test
#       Starts a temporary local cluster. Needs PostgreSQL 15+ server binaries
#       (initdb/pg_ctl on PATH or under /usr/lib/postgresql/<version>/bin).
#
#   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres npm run db:test
#       Uses an existing server (e.g. a CI service container) and creates a
#       fresh database named applyhub_test on it.
#
# The Supabase platform pieces (roles, auth.uid(), storage schema) are
# emulated by supabase/tests/shim/*.sql.
# -----------------------------------------------------------------------------
set -euo pipefail
shopt -s nullglob
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

db_setup

log "Installing test helpers"
run_psql -f "$TESTS_DIR/helpers.sql" >/dev/null

passed=0
failed=0
for file in "$TESTS_DIR"/rls/*.sql; do
  name="$(basename "$file")"
  if output="$(run_psql -o /dev/null -f "$file" 2>&1)"; then
    count="$(printf '%s\n' "$output" | grep -c 'ok - ' || true)"
    passed=$((passed + count))
    printf '   \033[32m✔\033[0m %s (%s assertions)\n' "$name" "$count"
  else
    failed=$((failed + 1))
    printf '   \033[31m✘\033[0m %s\n' "$name"
    printf '%s\n' "$output" | grep -vE 'NOTICE:  ok - ' | sed 's/^/      /'
  fi
done

if [[ "$failed" -gt 0 ]]; then
  echo
  echo "$failed test file(s) failed ($passed assertions passed)."
  exit 1
fi
echo
log "All database tests passed ($passed assertions)."
