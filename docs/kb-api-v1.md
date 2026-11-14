# yaan KB API v1: contract

Status: design contract (2026-11-14, Kevin: "no newsletter yet, focus on the public API so their agents can pull from our yaan KB"). Workers build to this file; if reality forces a change, edit this file in the same commit and say why.

## Principles
- Public, read-only, no key, no cookie, no tracking, CORS `*`, CC BY 4.0 (text) and MIT (code), items link to sources that keep their own rights.
- **Static first.** Everything under `/api/v1/` is JSON generated at build time from `src/data-live/` (issues, skipped days, `kb/` snapshots exported from the brain). No runtime link to the home server. Immutable per URL where possible (`/api/v1/issues/2026-11-13.json` never changes after publication); listing endpoints are `Cache-Control: public, max-age=300, stale-while-revalidate=3600`; dated files `max-age=31536000, immutable`.
- **Public-safe sources only**, asserted in code: `veille`, `github-trending`, filtered `agent` paper/lab pins, the OpenRouter catalog diff. Never x-bookmark, notion, manual*, github-stars, no brain ids, no internal slugs, no pin bodies. Only title, url, short description, tags, dates.
- **Honest data.** Every record says where it came from (`source`) and how it got there (`status`). No invented fields; absent = null.
- **Agent-first ergonomics.** Small stable shapes, ISO dates, stable ids, one-fetch bulk files, a search index, an OpenAPI 3.1 spec, a remote MCP server.

## Envelope
Every JSON file: `{ "api": "yaan-kb", "version": "1", "generated_at": ISO, "license": "CC-BY-4.0", "self": "<absolute url>", "data": ... }`. Lists add `"count"`.

## Endpoints (all GET, all under https://yetanotherainewsletter.org)
| path | what |
|---|---|
| `/api/v1/` (`/api/v1/index.json`) | map: links to every resource below, counts, `latest_issue`, `last_updated`, data freshness per dataset |
| `/api/v1/issues.json` | list of issues `{date, issue, title, url, md_url, api_url, stats, item_count}` newest first |
| `/api/v1/issues/{date}.json` | one full issue, structured (sections, items, dropped with reasons, fleet note, stats, models, curator) |
| `/api/v1/items.json` | every kept item ever, flattened, newest first |
| `/api/v1/items/{date}-{n}.json` | one item (id `2026-11-13#3`, file `2026-11-13-3.json`) |
| `/api/v1/pool/{date}.json` | the day's candidate pool: every public-safe item the veille rail saw, with `status`: `kept`, `dropped` (with `reason`) or `unreviewed` |
| `/api/v1/models/signals.json` | newest 200 model-market signals (new model, expiring, price move, context change) from the OpenRouter catalog diff |
| `/api/v1/models/signals/{date}.json` | the day's signals |
| `/api/v1/models/pareto.json` | latest quality x price Pareto table if the exporter has one, else 404-free `data: null` |
| `/api/v1/tags.json` | tag -> counts |
| `/api/v1/search-index.json` | compact client-side index: `[ {id, kind, title, url, date, tags, text} ]` over items, pool titles, signals |
| `/openapi.json` | OpenAPI 3.1 for all of the above, plus the search function |
| `/llms.txt`, `/llms-full.txt` | human/agent entry point; `llms-full.txt` = every issue as markdown concatenated + the endpoint map (one fetch) |
| `/.well-known/mcp.json` | MCP server card pointing at `/mcp` |

Dynamic (Cloudflare Pages Functions, in `functions/`, tiny, reading the static assets, no state):
- `GET /api/v1/search?q=&kind=&tag=&since=&limit=` ranks over the search index (case-insensitive token match, title boost, recency tiebreak), returns the same item shapes.
- `POST /mcp` remote MCP server (Streamable HTTP, stateless JSON-RPC 2.0: `initialize`, `tools/list`, `tools/call`; also answers `GET /mcp` with a short JSON card). Tools: `latest_issue`, `get_issue(date)`, `search(query, kind?, tag?, since?, limit?)`, `list_model_signals(type?, since?, limit?)`, `get_pool(date)`. Read-only, descriptions written for an LLM, every tool returns the same JSON the REST endpoints return plus a short text summary.

## Record shapes
- **Item** `{ id: "2026-11-13#3", issue: "2026-11-13", n: 3, title, url, source_domain, section: "labs|sota|tools|dates", lead: bool, why, agent, tags: [], issue_url, md_url, api_url }`
- **Pool entry** `{ id: "p_<first 12 hex of sha1(url)>", date, title, url, source_domain, source: "veille|github-trending|agent", published_at|null, short_description|null, tags: [], status: "kept|dropped|unreviewed", reason|null, item_id|null }`
- **Model signal** `{ id: "2026-11-13:new:<model_id>", date, type: "new|expiring|price|context", model_id, name, provider, details: { ... typed per type, numbers as numbers, prices in USD per 1M tokens }, source: "openrouter-catalog" }`
- Dates are UTC `YYYY-MM-DD`; timestamps ISO-8601 with `Z`.

## Export (brain -> repo snapshot)
`scripts/export-kb.py --date D` reads the brain read-only (same safety rules as `collect.py`: workspace `connivence` join, bounded reads, public-safe assertion) and writes `src/data-live/kb/pool/D.json` and `src/data-live/kb/models/signals/D.json` (+ `pareto.json` when present). These snapshots are committed: the KB history is auditable in git. The Astro build turns `src/data-live/**` into the endpoints above; `scripts/check.mjs` (or a new `scripts/check-kb.mjs`) validates every generated file against the shapes here and against the public-safe rule, and runs in `bun run check`.

## Out of scope for v1
Write endpoints, auth, API keys, per-user state, email, a database. A scheduled refresh (daily export -> build -> deploy without human approval) is armed only on Kevin's go.

## As built: deviations from the contract above (2026-11-14)
- **Section names**: items use `labs|sota|tools|timeline` (what `src/content/schema.ts` enforces), not `dates`. Items also carry `hand: bool` (curator-added) next to `lead`: additive.
- **`/api/v1/`** is emitted as `api/v1/index.html` (a static host cannot hold both a file `v1` and a directory `v1/`); `_headers` pins `Content-Type: application/json` on `/api/*`. Same document as `index.json`.
- **Caching**: `pool/*` and `models/signals/*` day files are `max-age=3600, stale-while-revalidate=86400`, not immutable: a pool entry's `status` follows later issues (a pin dropped on day D can be kept on day D+1) and a day can be re-exported. `issues/*` and `items/*` stay `immutable`.
- **Extra envelope fields** where the contract was silent: `total` (signals.json, search), `query` (search), `truncated` (signals day: the watcher prints at most 12 lines per type, the header count is kept), `fixture: true` on fixture builds (the fixture build does produce `/api`, labelled; the live build never carries it, `check-kb.mjs --build-live` asserts that).
- **Model signals**: the digests carry display names, not ids. `model_id_basis: "catalog"` when the name matched exactly one id of the OpenRouter catalog snapshot, `"derived"` when it is a stable `provider/slug` built from provider and name. Prices are numbers, USD per 1M tokens.
- **Unknown paths**: the site has no 404 page, so Cloudflare Pages answers any unmatched path with `200 text/html` (the SPA fallback), `/api/v1/x.json` included. Adding `src/pages/404.astro` (design lane) makes Pages return a real 404. The functions treat a non-JSON answer as "not found".
- **`GET /mcp`** answers the JSON card unless the client asks for `Accept: text/event-stream` only, which gets `405` (the transport spec wants SSE or 405; there is no stream).
