#!/usr/bin/env bash
# Site smoke: serve packages/site and assert reachability + theme var-set equality.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f index.html ]; then
  echo "smoke: index.html missing" >&2
  exit 1
fi

PORT=8148
python3 -m http.server "$PORT" --bind 127.0.0.1 --directory . >/tmp/priceanchor-site-smoke.log 2>&1 &
PID=$!
cleanup() { kill "$PID" 2>/dev/null || true; }
trap cleanup EXIT

sleep 1
for p in "" pricing.html privacy.html support.html tokens.css styles.css demo.js engine/priceanchor.js; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${PORT}/${p}")
  if [ "$code" != "200" ]; then
    echo "smoke: expected HTTP 200 on /${p}, got $code" >&2
    exit 1
  fi
done
echo "smoke: all pages and assets answer 200"

# Both theme blocks define the identical CSS var set.
dark_vars=$(sed -n '/^:root {/,/^}/p' tokens.css | grep -o '\-\-[a-z-]*' | sort -u)
light_vars=$(sed -n '/^:root\[data-theme="light"\]/,/^}/p' tokens.css | grep -o '\-\-[a-z-]*' | sort -u)
if [ "$dark_vars" != "$light_vars" ]; then
  echo "smoke: theme var sets differ" >&2
  diff <(echo "$dark_vars") <(echo "$light_vars") >&2 || true
  exit 1
fi
echo "smoke: theme var sets match"
echo "smoke: OK"
