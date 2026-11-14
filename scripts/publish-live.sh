#!/usr/bin/env bash
# build the live site; deploy ONLY when CONFIRM_DEPLOY=1 (Kevin's explicit GO).
# dry by default. this script never reads, prints or sets secrets: the Cloudflare
# token/account env is inherited from the caller if (and only if) a deploy is confirmed.
set -euo pipefail
export PATH="$HOME/.hermes/node/bin:$HOME/.local/bin:$PATH"
cd "$(dirname "$0")/.."

bun run build:live
rm -rf dist/.prerender

# the kb api is public: refuse to ship it if it fails the contract, the public-safe rule or carries fixture data
node scripts/check-kb.mjs dist --prod

# Pages Functions (functions/: /api/v1/search and /mcp). `wrangler pages deploy` reads ./functions from the
# repo root (we cd'd there above), so nothing extra is needed to ship them; this just proves they bundle.
WRANGLER="$HOME/.hermes/cache/scratch/wr/node_modules/.bin/wrangler"
if [ -x "$WRANGLER" ]; then
  FN_OUT="$(mktemp -d "${TMPDIR:-/tmp}/yaan-fn.XXXXXX")"
  "$WRANGLER" pages functions build functions --outdir "$FN_OUT/worker" --output-routes-path "$FN_OUT/_routes.json" >/dev/null
  echo "functions bundle ok; routes: $(tr -d ' \n' < "$FN_OUT/_routes.json")"
  rm -rf "$FN_OUT"
fi

if [ "${CONFIRM_DEPLOY:-}" != "1" ]; then
  echo "dry run: built dist/ for live, nothing deployed. set CONFIRM_DEPLOY=1 to deploy."
  exit 0
fi

if [ ! -x "$WRANGLER" ]; then
  echo "wrangler not found at $WRANGLER" >&2
  exit 1
fi
echo "CONFIRM_DEPLOY=1: deploying dist to Cloudflare Pages project yaan (branch main)"
exec "$WRANGLER" pages deploy dist --project-name yaan --branch main
