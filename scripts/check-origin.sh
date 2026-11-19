#!/bin/bash
# check-origin.sh — I22 oracle: exactly one origin across identity files.
# Usage: check-origin.sh [ROOT=.]. Fails loud listing every disagreeing file.
# Self-test: --self-test builds a fake tree with dirty/clean variants.
set -u

ORIGIN="https://priceanchor.applair.in"

check_tree() {
  local root="$1" fail=0
  disagree() { echo "ORIGIN-MISMATCH: $1"; fail=1; }

  grep -q "application_url = \"$ORIGIN\"" "$root/shopify.app.toml" 2>/dev/null \
    || disagree "shopify.app.toml application_url"
  grep -q "redirect_urls = \[ \"$ORIGIN/api/auth\" \]" "$root/shopify.app.toml" 2>/dev/null \
    || disagree "shopify.app.toml redirect_urls"
  grep -q "\"SHOPIFY_APP_URL\": \"$ORIGIN\"" "$root/wrangler.jsonc" 2>/dev/null \
    || disagree "wrangler.jsonc SHOPIFY_APP_URL"
  if grep -rhoE "https://[a-zA-Z0-9.-]+" "$root/docs/SUBMISSION.md" 2>/dev/null \
     | grep -v -x -F -e "$ORIGIN" -e "https://shopify.dev" -e "https://developers.cloudflare.com" \
     -e "https://neon.com" -e "https://console.neon.tech" -e "https://github.com" | grep -q .; then
    disagree "docs/SUBMISSION.md lists a foreign app origin"
  fi
  grep -q 'APP_URL: ${{ secrets.APP_URL }}' "$root/.github/workflows/snapshot.yml" 2>/dev/null \
    || disagree "snapshot.yml APP_URL secret reference"
  return "$fail"
}

if [ "${1:-}" = "--self-test" ]; then
  tmp=$(mktemp -d)
  mkdir -p "$tmp/docs" "$tmp/.github/workflows"
  printf 'application_url = "%s"\nredirect_urls = [ "%s/api/auth" ]\n' "$ORIGIN" "$ORIGIN" > "$tmp/shopify.app.toml"
  printf '"SHOPIFY_APP_URL": "%s"\n' "$ORIGIN" > "$tmp/wrangler.jsonc"
  printf 'see %s for details\n' "$ORIGIN" > "$tmp/docs/SUBMISSION.md"
  printf 'APP_URL: ${{ secrets.APP_URL }}\n' > "$tmp/.github/workflows/snapshot.yml"
  # Exercise the shipped entrypoint as a subprocess (not the function
  # directly), so exit-code regressions fail the self-test too.
  clean_out=$("$0" "$tmp" 2>&1); clean_code=$?
  printf 'application_url = "https://example.com"\n' > "$tmp/shopify.app.toml"
  dirty_out=$("$0" "$tmp" 2>&1); dirty_code=$?
  rm -rf "$tmp"
  if [ "$dirty_code" -ne 1 ] || [ "$clean_code" -ne 0 ]; then
    echo "SELF-TEST FAILED (dirty=$dirty_code clean=$clean_code)"
    echo "$dirty_out"
    exit 1
  fi
  echo "self-test OK"
  exit 0
fi

check_tree "${1:-.}" || exit 1
echo "single origin OK: $ORIGIN"
