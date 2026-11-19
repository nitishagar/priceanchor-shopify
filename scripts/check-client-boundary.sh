#!/bin/bash
# check-client-boundary.sh — I20 oracle: no server-only code in the client bundle.
# Fails loud naming the file+string. Self-test: --self-test with temp fixtures.
set -u

STRINGS=(drizzle-orm/neon-http shopify-app-react-router price-history timingSafeEqual metafieldsSet)

if [ "${1:-}" = "--self-test" ]; then
  tmp=$(mktemp -d)
  echo "price-history leak" > "$tmp/dirty.js"
  echo "clean client code" > "$tmp/clean.js"
  dirty_out=$("$0" "$tmp/dirty.js" 2>&1); dirty_code=$?
  clean_out=$("$0" "$tmp/clean.js" 2>&1); clean_code=$?
  rm -rf "$tmp"
  if [ "$dirty_code" -ne 1 ] || [ "$clean_code" -ne 0 ]; then
    echo "SELF-TEST FAILED (dirty=$dirty_code clean=$clean_code)"
    echo "$dirty_out"
    exit 1
  fi
  echo "self-test OK"
  exit 0
fi

shopt -s nullglob
targets=("$@")
if [ "${#targets[@]}" -eq 0 ]; then
  # shellcheck disable=SC2206
  targets=(build/client/assets/*.js)
fi
if [ "${#targets[@]}" -eq 0 ]; then
  echo "LEAK-CHECK misconfigured: no client assets found — run build first"
  exit 1
fi

fail=0
scanned=0
for file in "${targets[@]}"; do
  [ -f "$file" ] || continue
  scanned=$((scanned + 1))
  for needle in "${STRINGS[@]}"; do
    if grep -qF "$needle" "$file"; then
      echo "LEAK: $file contains server-only string: $needle"
      fail=1
    fi
  done
done
if [ "$scanned" -eq 0 ]; then
  echo "LEAK-CHECK misconfigured: no scannable files among targets"
  exit 1
fi
[ "$fail" -eq 0 ] && echo "client boundary OK ($scanned files)"
exit "$fail"
