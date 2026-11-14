#!/usr/bin/env bash
# approve + publish one drafted issue. usage: scripts/approve.sh YYYY-MM-DD
# draft lives in src/data-live/drafts/D.json (written by the compose run, never built).
# steps: validate -> move into issues/ -> commit -> build:live -> deploy -> read the live url back.
# deploy needs CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID in the caller env; this script never reads secrets.
set -euo pipefail
export PATH="$HOME/.hermes/node/bin:$HOME/.local/bin:$PATH"
cd "$(dirname "$0")/.."
D="${1:?usage: approve.sh YYYY-MM-DD}"
DRAFT="src/data-live/drafts/$D.json"
ISSUE="src/data-live/issues/$D.json"
BUNDLE="src/data-live/drafts/$D.bundle.json"
[ -f "$DRAFT" ] || [ -f "$ISSUE" ] || { echo "no draft for $D" >&2; exit 1; }
if [ -f "$DRAFT" ]; then
  if [ -f "$BUNDLE" ]; then node scripts/validate-issue.mjs "$DRAFT" --bundle "$BUNDLE"; else node scripts/validate-issue.mjs "$DRAFT"; fi
  mv "$DRAFT" "$ISSUE"
fi
node scripts/validate-issue.mjs "$ISSUE"
python3 scripts/fill-skipped.py
# optional (off by default): refresh the kb snapshots of the day so the api ships fresh pool + model signals
if [ "${YAAN_EXPORT_KB:-0}" = "1" ]; then python3 scripts/export-kb.py --date "$D"; git add src/data-live/kb; fi
git add "$ISSUE" src/data-live/skipped.json
git commit -m "yaan: publish issue for $D" -q || true
CONFIRM_DEPLOY=1 scripts/publish-live.sh
git push -q origin HEAD:main
SITE="https://yetanotherainewsletter.org"
sleep 6
code=$(curl -4 -sL -o /dev/null -w '%{http_code}' "$SITE/$D")
echo "live check: $SITE/$D -> $code"
[ "$code" = "200" ] || { echo "live check FAILED" >&2; exit 2; }
