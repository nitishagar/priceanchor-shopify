#!/bin/bash
# check-placeholders.sh — I16 guard: fail on placeholder/example URLs.
# Contract: if argv paths given, check those; else check the fixed list.
# Fails loud naming the file. Self-test: --self-test with temp fixtures.
set -u

if [ "${1:-}" = "--self-test" ]; then
  tmp=$(mktemp -d)
  printf 'x example.com y' > "$tmp/dirty.txt"
  printf 'clean content here' > "$tmp/clean.txt"
  dirty_out=$("$0" "$tmp/dirty.txt" 2>&1); dirty_code=$?
  clean_out=$("$0" "$tmp/clean.txt" 2>&1); clean_code=$?
  rm -rf "$tmp"
  if [ "$dirty_code" -ne 1 ] || [ "$clean_code" -ne 0 ]; then
    echo "SELF-TEST FAILED (dirty=$dirty_code clean=$clean_code)"
    echo "$dirty_out"
    exit 1
  fi
  echo "self-test OK"
  exit 0
fi

targets=("$@")
if [ "${#targets[@]}" -eq 0 ]; then
  targets=(
    shopify.app.toml
    app/routes/support.tsx
    app/routes/privacy.tsx
    packages/site/support.html
    packages/site/privacy.html
    docs/SUBMISSION.md
  )
fi

fail=0
for file in "${targets[@]}"; do
  [ -f "$file" ] || continue
  if grep -q "example\.com" "$file"; then
    echo "PLACEHOLDER: $file contains example.com"
    fail=1
  fi
done
[ "$fail" -eq 0 ] && echo "placeholders check OK"
exit "$fail"
