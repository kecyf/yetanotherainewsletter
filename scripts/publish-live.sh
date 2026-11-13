#!/usr/bin/env bash
# build the live site; deploy ONLY when CONFIRM_DEPLOY=1 (Kevin's explicit GO).
# dry by default. this script never reads, prints or sets secrets: the Cloudflare
# token/account env is inherited from the caller if (and only if) a deploy is confirmed.
set -euo pipefail
export PATH="$HOME/.hermes/node/bin:$HOME/.local/bin:$PATH"
cd "$(dirname "$0")/.."

bun run build:live
rm -rf dist/.prerender

if [ "${CONFIRM_DEPLOY:-}" != "1" ]; then
  echo "dry run: built dist/ for live, nothing deployed. set CONFIRM_DEPLOY=1 to deploy."
  exit 0
fi

WRANGLER="$HOME/.hermes/cache/scratch/wr/node_modules/.bin/wrangler"
if [ ! -x "$WRANGLER" ]; then
  echo "wrangler not found at $WRANGLER" >&2
  exit 1
fi
echo "CONFIRM_DEPLOY=1: deploying dist to Cloudflare Pages project yaan (branch main)"
exec "$WRANGLER" pages deploy dist --project-name yaan --branch main
