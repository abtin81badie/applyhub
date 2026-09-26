#!/usr/bin/env bash
# Regenerates src/lib/database.types.ts from a temporary database with every
# migration applied (see scripts/db/gen-types.mjs).
set -euo pipefail
shopt -s nullglob
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

db_setup
log "Generating TypeScript types"
DATABASE_URL="$TEST_URL" node "$ROOT/scripts/db/gen-types.mjs" "$ROOT/src/lib/database.types.ts"
