#!/usr/bin/env bash
# Drift guard: re-vendor packages into supabase/functions/_vendor and fail if
# the committed copies differ. Run before deploying edge functions or in CI
# after any change to packages/core or packages/parsing.
set -euo pipefail
cd "$(dirname "$0")/.."
./scripts/vendor-edge.sh
if ! git diff --exit-code --quiet supabase/functions/_vendor; then
  echo "ERROR: supabase/functions/_vendor is stale. Commit the re-vendored output." >&2
  exit 1
fi
echo "vendor check: _vendor/ is up to date"
