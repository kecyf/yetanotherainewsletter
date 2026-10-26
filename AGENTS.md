# yaan — instructions for agents landing in this repo

**Repo:** `kecyf/yetanotherainewsletter` — the public site for `yetanotherainewsletter.org`.
**You are a worker, not the owner.** Build what the spec says; do not invent product or design decisions.

## Constraints (top)
**MUST**
- Read `design/DESIGN.md` first. It is the conception spec (tokens, page templates, component inventory, copy deck, implementation notes, acceptance checks). Follow it literally.
- Every user-facing string comes from `copy.ts`. Every colour, size and font comes from `design/tokens.css`. Components consume the mapped classes only.
- Run `bun run check` and `bun run build` before you claim anything works. Report the real output; a green claim without a real run is a lie.
- Keep the issue HTML and its `.md` twin carrying the same content — the check script enforces parity.
- Commit small, message in the imperative, and never commit a secret.
- Content is generated from the brain; a fixture is a stand-in for a brain record and must be labelled as such.

**NEVER**
- Invent data: no fabricated provider links (the conception mockup wrongly pointed unsubscribe at buttondown.com), no invented byline (`curator léa` was a placeholder — the curator is Kevin), no invented model names in the metadata strip, no invented item URLs. These four are explicit failure conditions.
- Add a reading gate: no JS-only rendering, no cookie wall, no "subscribe to read". Agents must be able to fetch an issue in one request.
- Put secrets, tokens or keys in the repo, in a fixture, or in a committed `.env`.
- Deploy to production, create a Cloudflare/DNS record, or buy anything without an explicit GO from Kevin.
- Add a dependency that is not needed to satisfy the spec; no CSS framework beyond Tailwind, no JS framework beyond Astro islands.

## Truth order
1. Lumi brain — project `yetanotherainewsletter-v0`, docs `spec-yetanotherainewsletter-stack-v0` and `brief-yetanotherainewsletter-design-v0` (SSOT for intent, mechanism, design).
2. `design/DESIGN.md` in this repo (the conception spec).
3. This file + README.
4. Everything else on disk.

If the spec and your instinct disagree, the spec wins until a human changes it — report the disagreement instead of silently choosing.

## Scope boundaries
- The **content pipeline** (brain → issue record → generated MDX) is not this repo's job in the first pass; it is tracked in the brain. Build the site against a labelled fixture until the pipeline lands.
- The **sender** (list, subscribe backend, sending relay) is parked in the brain; do not wire a real subscription backend. The subscribe form must exist and must be visibly inert until the backend is connected.

## Constraints (bottom)
**MUST:** spec first · real runs reported · no invented data · tokens + `copy.ts` only.
**NEVER:** secrets · fabricated links/byline · read gate · production deploy without GO.
