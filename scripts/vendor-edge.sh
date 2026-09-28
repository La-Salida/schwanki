#!/usr/bin/env bash
# Vendors @schwanki/core, @schwanki/parsing and @schwanki/mnemonic sources
# into supabase/functions/_vendor so edge functions can import them.
#
# Why: the Supabase edge runtime bundles each function from inside
# supabase/functions only — import-map entries pointing at ../../packages
# (or symlinks) fail with "Module not found" at worker boot
# (supabase/cli#1028). These copies are generated; do not edit by hand.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR="$ROOT/supabase/functions/_vendor"

rm -rf "$VENDOR"
mkdir -p "$VENDOR/core" "$VENDOR/parsing/prompts" "$VENDOR/mnemonic"

for pkg in core parsing mnemonic; do
  while IFS= read -r f; do
    rel="${f#"$ROOT/packages/$pkg/src/"}"
    mkdir -p "$VENDOR/$pkg/$(dirname "$rel")"
    {
      echo "// GENERATED from packages/$pkg/src/$rel — edit the source, then re-run scripts/vendor-edge.sh"
      cat "$f"
    } > "$VENDOR/$pkg/$rel"
  done < <(find "$ROOT/packages/$pkg/src" -name '*.ts' ! -name '*.test.ts')
done

echo "vendored $(find "$VENDOR" -name '*.ts' | wc -l | tr -d ' ') files into $VENDOR"
