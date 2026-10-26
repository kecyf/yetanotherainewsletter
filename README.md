# yaan — yetanotherainewsletter.org

A free `.org` daily veille on AI and the major tech labs. Published as a **newsletter you can subscribe to** and as a **site where every issue is also an article**. A fleet of agents assembles it overnight; one human curates it.

**Status:** pre-implementation. The conception brief exists, no site is deployed yet, no issue has been sent.

## Where the truth lives
| What | Where |
|---|---|
| Intent, decisions, open questions | Lumi brain, project `yetanotherainewsletter-v0` |
| Site mechanism (stack, pipeline, DNS) | brain doc `spec-yetanotherainewsletter-stack-v0` |
| Site conception (tokens, templates, components, copy deck) | brain doc `brief-yetanotherainewsletter-design-v0` and `design/DESIGN.md` here |
| Content source of truth | the Lumi brain (Supabase). This repo holds **generated artifacts** only — never a second source of truth |

Read `design/DESIGN.md` before changing anything visual or any user-facing string. It is the spec, not a suggestion.

## Planned stack
- Astro 7 + Tailwind 4, static output, deployed to Cloudflare Pages from `main`.
- Design tokens as CSS custom properties in one file; Tailwind reads them through a single mapping.
- Every user-facing string lives in one `copy.ts`; every component imports from it.
- Each issue ships in three forms from one record: `/YYYY-MM-DD` (HTML), `/YYYY-MM-DD.md` (agents), and an entry in `/feed.json`. Plus `/llms.txt`.

## Non-negotiables (a violation is a build failure, not a placeholder)
1. **No fabricated values.** No invented provider links, no invented byline, no invented item URLs. Items link real `pins.url` records from the brain; the metadata strip reads the real routing of the run that built the issue.
2. **No reading gate.** No JS-only rendering, no cookie wall, no "subscribe to read".
3. **No secrets in this repo.** Keys are read at runtime from 1Password; never committed, never in a fixture.
4. **No deploy to production without an explicit GO** from Kevin.

## Working here
```bash
bun install
bun run dev        # local preview
bun run check      # format + typecheck + the build invariants (copy, tokens, md parity)
bun run build      # static output in dist/
```
Agent instructions for this repo: `AGENTS.md`.
