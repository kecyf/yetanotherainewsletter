# Compose contract: the draft issue JSON

The compose step reads ONE collector bundle (`scripts/collect.py --date YYYY-MM-DD`) and writes ONE draft,
`src/data-live/issues/YYYY-MM-DD.json` (file name = issue date). Validate it before anything else:

    node scripts/validate-issue.mjs src/data-live/issues/2026-11-13.json --bundle bundle.json

Exit 0 = publishable shape, exit 1 = readable errors. The schema is `src/content/schema.ts`; the spec is `design/DESIGN.md` §6.

## Shape

    { "fixture": false,                     // always false for a real issue (true = labelled stand-in, notice rendered)
      "date": "2026-11-13", "issue": 1,     // issue = running number, positive int
      "subject": "...",                     // sentence case, <= 80 chars (target 72), no trailing period, no ? or !
      "intro": "...", "curator": "kevin",
      "assembled": "2026-11-13T08:30:00Z",  // ISO UTC, the moment compose ran
      "stats": { "sources", "read", "proposed", "dropped", "hand", "kept" },
      "models": ["<model id actually used>", "..."],
      "sections": [ { "name": "labs|sota|tools|timeline",   // fixed order, each at most once
                      "items": [ { "n", "title", "url", "why", "agent", "hand"?, "lead"? } ] } ],
      "signal": { "text" },                 // optional, <= 400 chars
      "fleet": { "agent", "model", "text" },// text <= 400 chars
      "signoff": { "text" },
      "dropped": [ { "title", "url", "agent", "reason" } ],
      "prev": "YYYY-MM-DD|null", "next": "YYYY-MM-DD|null" }

## Rules (the compose run must obey, the validator enforces what it can)

1. **Never invent a URL.** Every `sections[].items[].url` and `dropped[].url` is copied verbatim from `bundle.items[].url`
   (use `--bundle` to check). No url from memory, no url from a digest body unless it is also an item.
2. **Never invent a model id.** `models` and `fleet.model` list exactly the models the compose run called. Add the
   suffix `(scouts)` only to a model that really scouted; the veille rail is not an LLM unless the bundle says so.
3. **Stats reconcile.** `kept = proposed - dropped + hand`; `items.length = kept`; `dropped.length = stats.dropped`;
   count of `hand: true` items = `stats.hand`; items numbered 1..n across sections; at most one `lead: true`.
   Suggested mapping from the bundle: `read` = `counts.candidates`, `proposed` = `counts.landed`, `sources` = distinct
   `items[].source`/lab sources polled (state what was counted, never estimate). Every number must come from the bundle.
4. **Curator is `kevin`.** No other byline.
5. **`kept >= 3` or no issue.** A day with fewer than 3 kept items is not an issue: add the date to
   `src/data-live/skipped.json` instead (never both, never neither, from launch to today).
6. **Body under 600 words** (intro + titles + whys + signal + fleet note + signoff). `why` <= 220 chars, 1-2 lines.
7. **Public-safe only.** Items come from the bundle only; the collector already drops x-bookmark, notion, manual*, github-stars.
   Never paste text from other brain records. `agent` is the real rail/agent slug that proposed the item (e.g. `veille-labs-rail`).
8. **No fixture data in live.** `fixture` must be false; a live build refuses `fixture: true`.
9. Write prose in English, lowercase style as in the fixtures. No claims the bundle does not support.

## Publish

    bun run build:live     # must pass with the new issue
    scripts/publish-live.sh   # dry by default; CONFIRM_DEPLOY=1 deploys (Kevin's GO only)
