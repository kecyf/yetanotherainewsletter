# yaan: design brief v1

`yetanotherainewsletter.org`: a daily ai veille. the agents assemble it, one human curates it, and every page is readable by an agent in one fetch.

decisions are marked **[decision]** in one line each. override them inline and nothing else needs to change.

---

## 1. design tokens

file: `src/styles/tokens.css`. this is the only file in the repo allowed to contain a raw colour, px size or font name. tailwind reads the tokens through a single `@theme inline` mapping, and components use only the mapped classes.

```css
:root {
  color-scheme: dark;

  /* colour: surfaces */
  --bg:          #0c0c0d;  /* page background, everywhere */
  --surface:     #141416;  /* blocks: agent block, fleet block, subscribe form, dropped list */
  --surface-2:   #1b1b1e;  /* inset inside a surface: <pre>, input fill, inline code */
  --line:        #26262a;  /* every 1px divider and block border */
  --line-strong: #3a3a40;  /* input border, signal rule, metadata strip edges */

  /* colour: text levels */
  --fg-1: #ececee;  /* titles, item titles, link text, emphasis */
  --fg-2: #b4b4ba;  /* body, intro, why-it-matters */
  --fg-3: #7c7c84;  /* micro: dates, labels, provenance, metadata keys (4.9:1 on --bg) */

  /* colour: accent + semantic */
  --accent:     #b8e986;     /* reserved for the agent cta, focus ring, link hover. nothing else */
  --accent-ink: #0c0c0d;     /* text on an --accent fill (copy button) */
  --link:       var(--fg-1); /* links read as text, underline carries the affordance */
  --link-line:  #4a4a52;     /* underline colour at rest */
  --link-hover: var(--accent);
  --success:    #8fd19e;     /* subscribe confirmed, "copied" */
  --warning:    #e6c27a;     /* subscribe pending, skipped-day marker */
  --danger:     #ef8a8a;     /* invalid email, service error */
  --muted:      var(--fg-3); /* alias used by prose: "less important than body" */

  /* type */
  --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; /* human text */
  --font-mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace;   /* machine text: dates, section names, strip, prompt, urls */
  --fs-title-1: 20px; --lh-title-1: 28px; /* h1 only: issue subject, page title */
  --fs-title-2: 14px; --lh-title-2: 22px; /* h2: section names (mono), block titles */
  --fs-body:    14px; --lh-body:    22px; /* all running text */
  --fs-micro:   12px; --lh-micro:   18px; /* everything secondary, <pre>, strip */
  --tr-title: -0.01em;  /* h1 only */
  --tr-mono:  0;        /* mono is never tracked */
  --fw-regular: 400; --fw-medium: 500; /* no bold. medium is the ceiling */

  /* spacing (4px base). gaps only, never stacked margins */
  --sp-1: 4px;  /* title ↔ its micro line */
  --sp-2: 8px;  /* inside a component */
  --sp-3: 12px; /* between items' internal groups */
  --sp-4: 16px; /* block padding, between rows in a list */
  --sp-6: 24px; /* between items in a section */
  --sp-8: 32px; /* between page header parts, page top padding mobile */
  --sp-12: 48px;/* between sections */

  /* shape */
  --r-1: 4px;  /* inputs, buttons, inline code, <pre> */
  --r-2: 8px;  /* surface blocks */
  --bw: 1px;   /* the only border width, except --bw-rule */
  --bw-rule: 2px; /* signal callout left rule, focus outline */

  /* layout */
  --w-read: 620px;  /* every page's column. one width, no wide variant */
  --gutter: 20px;   /* side padding < 768px */
  --gutter-md: 24px;/* side padding ≥ 768px */
  --w-date: 11ch;   /* dated-row date column, fits yyyy-mm-dd in mono */

  /* code / mono treatment */
  --code-bg: var(--surface-2);
  --code-fg: var(--fg-2);
  --code-pad: var(--sp-3) var(--sp-4);

  /* metadata strip */
  --strip-key: var(--fg-3);    /* "kept" */
  --strip-val: var(--fg-1);    /* "6" */
  --strip-sep: var(--line-strong); /* top/bottom edges */
}
```

tailwind mapping (`src/styles/global.css`):

```css
@import "tailwindcss";
@import "./tokens.css";
@theme inline {
  --color-bg: var(--bg); --color-surface: var(--surface); --color-surface-2: var(--surface-2);
  --color-line: var(--line); --color-line-strong: var(--line-strong);
  --color-fg-1: var(--fg-1); --color-fg-2: var(--fg-2); --color-fg-3: var(--fg-3);
  --color-accent: var(--accent); --color-accent-ink: var(--accent-ink);
  --color-success: var(--success); --color-warning: var(--warning); --color-danger: var(--danger);
  --font-sans: var(--font-sans); --font-mono: var(--font-mono);
  --text-micro: var(--fs-micro); --text-micro--line-height: var(--lh-micro);
  --text-body: var(--fs-body); --text-body--line-height: var(--lh-body);
  --text-t1: var(--fs-title-1); --text-t1--line-height: var(--lh-title-1);
  --text-t2: var(--fs-title-2); --text-t2--line-height: var(--lh-title-2);
  --radius-1: var(--r-1); --radius-2: var(--r-2);
}
```

classes allowed: `bg-bg bg-surface bg-surface-2 border-line border-line-strong text-fg-1/2/3 text-accent text-success/warning/danger text-micro text-body text-t1 text-t2 font-mono rounded-1 rounded-2`, plus tailwind's spacing utilities, which are set to the 4px base. arbitrary values (`[...]`) are banned.

---

## 2. page templates

breakpoints: mobile-first base; **one** breakpoint at `md: 768px`. at md: gutter becomes 24px, page top padding becomes 48px, and the metadata strip and item provenance go from wrapped to single-line where they fit. there is no multi-column layout anywhere. **[decision]** a single 620px column on every page.

shared shell: `<body class="bg-bg text-fg-2 text-body font-sans">`. the container is `mx-auto max-w-[--w-read]`, expressed as the `.col` utility defined once in global.css. it is a flex column, `gap-12`. top nav: `yaan` (link to `/`) on the left; `archive · about · subscribe` on the right, micro, fg-3. footer at the end. no sticky elements.

### issue page `/2026-10-26`
reading order:
1. nav
2. issue header: micro line, then h1 subject, then intro
3. metadata strip
4. sections in fixed order: labs → sota → tools → timeline → signal (only if present) → from the fleet
5. signoff
6. dropped list (`<details>`, closed)
7. agent block
8. subscribe form (compact)
9. footer

details:
- **[decision]** items are numbered 1–n across the whole issue, with anchors `/2026-10-26#3`. this makes citation and agent replies addressable.
- **[decision]** the full agent block sits after the signoff. the header micro line carries a `give it to your agent ↓` anchor link to it.
- `/` renders the latest issue, with a single hero line above the issue header.

states:
- **normal**.
- **signal absent**: the section is omitted entirely, with no empty header.
- **from the fleet absent**: this is a build error, because the section is required.
- **skipped date** (`/2026-10-27` with no issue): a static 404-style page using the skipped copy, linking prev/next issues. it is generated from a `skipped.json` list so the reason is shown.

### markdown twin `/2026-10-26.md`
- `content-type: text/markdown; charset=utf-8`, with no html, a yaml frontmatter and a body.
- it is generated from the same content entry as the html; see §6 for the serializer.
- also served: `/latest.md`.
- **[decision]** an html companion at `/2026-10-26/agent` (mockup c) shows the prompt block, the endpoints and the raw markdown in a `<pre>`. the issue page links to it as `view as markdown`.

### archive `/archive`
- h1 `archive`, then a micro count line, then a compact subscribe line.
- month groups (newest first). each group has a mono section header `2026-10`, followed by dated rows.
- a row is date · subject (link) · micro `6 items · .md`.
- **skipped days appear as rows**, with the reason in fg-3 and a warning-coloured `skipped` marker. they are never hidden.
- **[decision]** no pagination and no search. one page, plain html. split by year once it passes ~500 rows.
- empty state: one sentence; see the copy deck.

### about + how this is made `/about`
the h1, then h2 blocks (Title level 2, sans, not mono) in this order:
1. **what this is**: the long positioning line.
2. **the fleet**: dated-row variant with key column = agent name and value = job · model · source count. one row per agent.
3. **the human**: what curation means.
4. **the rule**: 3 items or skip; under 600 words.
5. **the pipeline**: utc times, as rows.
6. **citing yaan**.
7. **what yaan doesn't do**.
8. **model changelog**: dated rows.

### subscribe `/subscribe` + state routes
no js is required. the form posts to the provider, which redirects to a static state route.

- **[decision]** provider = buttondown: double opt-in, markdown email, open/click tracking disabled.

| state | route | what renders |
|---|---|---|
| idle | `/subscribe` | h1, micro promise line, form |
| invalid | native `type=email required` + `/subscribe?e=invalid` | message under the input in `text-danger`, input border `border-danger`, field keeps focus via `autofocus` |
| pending | `/subscribe/pending` | h1 + body, `text-warning` micro tag `pending` |
| confirmed | `/subscribe/confirmed` | h1 + body, `text-success` micro tag `confirmed`, link to latest issue + archive |
| already | `/subscribe/already` | body only |
| error | `/subscribe/error` | body in fg-2, `text-danger` tag `error`, links to rss + feed.json |
| unsubscribed | `/subscribe/bye` | one line |

### privacy + legal `/privacy`
h1, then h2 blocks: who runs it · what's stored · what isn't · email · logs · license · contact. it uses prose rows only, at the same column and scale as every other page.

---

## 3. component inventory

all components live in `src/components/`. every list is `flex flex-col gap-*`, and no child carries an outer margin.

**`Title.astro`** `{level: 1|2, mono?: boolean}`
- level 1: `text-t1 text-fg-1 font-medium tracking-[--tr-title]`. this is the one tracking token, exposed as the `.tr-title` utility, since arbitrary values are banned.
- level 2: `text-t2 text-fg-1 font-medium`. it adds `font-mono` when `mono`.
- trap prevented: ad-hoc `text-2xl`/`text-lg` headings. no other component may render h1/h2.

**`IssueHeader.astro`** `{date, weekday, issue, readMin, subject, intro}`
- anatomy: `flex-col gap-3`.
  - micro mono line `2026-10-26 · monday · issue 142 · 3 min · give it to your agent ↓`, in fg-3. the anchor uses the link style.
  - `<Title level=1>`.
  - intro `<p>` in fg-2.
- read time = `ceil(words / 200)`.
- trap prevented: date formats drifting. this is the only place the formatted date string is built, via `formatIssueDate()` in `src/lib/date.ts`.

**`MetaStrip.astro`** `{sources, read, proposed, kept, dropped, hand, models[], assembled, curator}`
- anatomy: a `<dl>` with `flex flex-wrap gap-x-4 gap-y-1`, border top and bottom in `border-line-strong`, and `py-3 font-mono text-micro`.
- each pair is `<div class="flex gap-1"><dt class="text-fg-3">kept</dt><dd class="text-fg-1">6</dd></div>`.
- models get their own full-width row: `<div class="basis-full">`.
- trap prevented: turning the strip into a "stats dashboard" with cards, icons or charts. it is one dry line of facts, and all numbers must reconcile: `kept = proposed − dropped + hand`. the build fails otherwise.

**`SectionHeader.astro`** `{name, descriptor}`
- `<Title level=2 mono>{name}</Title>` followed by a micro fg-3 descriptor, in a `flex items-baseline gap-2` row.
- trap prevented: section names styled differently per section, or capitalised.

**`ItemRow.astro`** `{n, title, url, why, source, agent, hand?: boolean}`
- anatomy: `<article id={n} class="flex flex-col gap-1">`.
  - `<a class="text-fg-1">` title.
  - `<p class="text-fg-2">` why.
  - micro mono fg-3 line: `{n} · {source domain} · {agent}`, plus ` · added by hand` when hand.
- items within a section use `gap-6`.
- trap prevented: excerpts/thumbnails/favicons creeping in. the why is 1–2 lines, and the build warns above 220 chars.

**`Signal.astro`** `{text}` is the only justified callout.
- `border-l-2 border-line-strong pl-4`,no fill, no icon and no label inside the rule.
- anatomy: `<div class="border-l-2 border-line-strong pl-4 flex flex-col gap-2">`, containing one `<p class="text-fg-2">` and then a micro fg-3 `— {curator}`.
- it renders under `<SectionHeader name="signal" …>` and only when `signal` exists in the entry.
- trap prevented: callouts multiplying ("note", "tip", "hot take", a highlighted quote). `Signal` is the only component in the repo with a left rule. It appears at most once per issue, and the build fails above 400 chars.

**`AgentBlock.astro`** `{date, issue, mdUrl, agentUrl}`
- anatomy: `<section id="agent" class="bg-surface border border-line rounded-2 p-4 flex flex-col gap-3">`.
  - `<Title level=2>give it to your agent</Title>`. it uses sans, not mono, because it is addressed to the human.
  - micro fg-3 instruction line.
  - `<pre id="prompt">` with the prompt from §4. the url is always the **dated** `.md`, never `latest.md`.
  - action row `flex flex-wrap items-baseline gap-3`: the copy button (`bg-accent text-accent-ink rounded-1 px-4 py-2 font-mono text-micro font-medium`, rendered `hidden`), a `role="status"` micro span in `text-success`, then micro links `view as markdown` and `{date}.md`.
- the copy button is the only element in the product with an accent fill. an 8-line inline script un-hides it when `navigator.clipboard` exists. without js the `<pre>` is still selectable and nothing is lost.
- the prompt string lives in `src/lib/prompt.ts` (`agentPrompt(date, issue)`). the issue page, the agent view and `llms.txt` all call it.
- trap prevented: a second accent use ("subscribe" in green, section names in green). grep `accent` in `src/components`: it may appear only in `AgentBlock.astro` and global.css (focus ring, link hover).

**`FleetNote.astro`** `{agent, model, text}`
- anatomy: `<SectionHeader name="from the fleet" …>`, then a `bg-surface border border-line rounded-2 p-4 flex flex-col gap-2` block containing `<p class="text-fg-2">` and a micro mono fg-3 `— {agent} · {model}`.
- it is required. a missing or empty `fleet` field is a schema error, not a hidden section.
- trap prevented: the note written in the curator's voice, or as marketing ("our agents worked hard…"). the note is first-person from the agent, about what it did or got wrong, and stays under 400 chars.

**`Signoff.astro`** `{text, curator}`
- `<div class="flex flex-col gap-1">` containing `<p class="text-fg-2">{text}</p>`, then a micro fg-3 `— {curator}, for the fleet`.
- trap prevented: a signature block with avatar, socials or a "reply to this email" button.

**`DroppedList.astro`** `{items: {title, url, agent, reason}[]}`
- `<details class="bg-surface border border-line rounded-2 p-4">`, closed by default.
- `<summary>` is micro mono fg-3: `+ dropped · 4 · proposed by the fleet, cut by the curator`. the `+` becomes `−` when open, via `details[open]`, and the default marker is removed.
- the open body is a `ul flex flex-col gap-3 pt-3`. each `li` is `flex flex-col gap-1`: the title link, then micro mono fg-3 `{agent} · {reason}`.
- `items.length` must equal `stats.dropped`. the build fails otherwise.
- trap prevented: dropping the dropped list "because it looks negative". it is the evidence that curation happened, so it is required whenever `dropped > 0`.

**`SubscribeForm.astro`** `{variant: "full" | "compact", state?: "invalid"}`
- `<form method="post" action="https://buttondown.com/api/emails/embed-subscribe/yaan" class="flex flex-col gap-2">`.
  - the compact variant starts with a micro fg-3 promise line.
  - field row `flex flex-wrap gap-2`. the input is `type=email name=email required autocomplete=email`, styled `bg-surface-2 border border-line-strong rounded-1 px-3 py-2 text-fg-1 flex-1 min-w-55`. the button is `bg-surface-2 border border-line-strong rounded-1 px-4 py-2 text-fg-1 font-medium`.
  - the `<label>` is visually hidden, never omitted.
  - when `state=invalid`, the input gets `border-danger` and `aria-describedby`, and a micro `text-danger` message appears under the row.
- the full variant (on `/subscribe`) is the same form preceded by the h1 and the promise line. there is no third variant.
- trap prevented: an accent-filled subscribe button, a modal, or a sticky bar. subscribe is deliberately quieter than the agent cta.

**`Nav.astro`**
- `<nav class="flex justify-between items-baseline">`. on the left, `yaan` in mono fg-1 with no underline. on the right, micro links `archive · about · subscribe` in fg-3, with the separators in fg-3.
- `aria-current="page"` turns the current link fg-1.
- trap prevented: a logo, a hamburger, or a theme toggle. there is one theme.

**`Footer.astro`**
- `<footer class="border-t border-line pt-4 flex flex-col gap-1 text-micro text-fg-3">`, with three lines from §4. links in the footer are fg-3 with the standard underline.
- trap prevented: a multi-column "sitemap" footer.

**`DatedRow.astro`** `{date, children, state?: "skipped"}`
- `.dated` utility (defined once in global.css): `grid grid-cols-[var(--w-date)_1fr] gap-4 items-baseline`. this is the single sanctioned grid, and it is written in css, not as an arbitrary class.
- the date cell is micro mono fg-3. the value cell is `flex flex-wrap items-baseline gap-x-3`.
- it is used by the archive, the about page (fleet, pipeline, changelog) and the agent view endpoints, where the "date" column holds the key.
- trap prevented: a second table style per page.

**`StateTag.astro`** `{state: "pending" | "confirmed" | "error" | "skipped"}`
- a micro mono span with no fill and no border. the colour is `text-warning`, `text-success` or `text-danger`, and the text is the state name itself.
- trap prevented: pill badges.

**`Hero.astro`**
- renders on `/` only. it is one `<p class="text-fg-1">` line above the issue header, plus a micro fg-3 line when today's issue hasn't landed (§4).
- trap prevented: a marketing hero with a big title, a subtitle and a button pair.

**`Prose.astro`**
- the wrapper for about and privacy: `flex flex-col gap-8` around `{h2, p+}` blocks, with `<p>` in fg-2 and `<code>` in `bg-surface-2 rounded-1 px-1 font-mono text-micro`.
- trap prevented: a separate "docs" typography plugin.

**`src/lib/toMarkdown.ts`** (not a component, but listed here because the issue page depends on it)
- `toMarkdown(entry): string` is the only producer of `.md`. the agent view renders its output escaped inside `<pre>`.

---

## 4. copy deck

all copy is lowercase except proper nouns inside source titles, urls and model ids. strings live in `src/content/copy.ts`. placeholders are `{like_this}`.

### positioning

- **short** (meta description, og, rss channel description):
  `a daily ai veille. agents assemble it, a human curates it, your agent can read it.`
- **long** (about → what this is, llms.txt intro):
  `yaan is a daily ai veille: what the labs shipped, what moved the state of the art, which tools are worth installing, and which dates are coming. a fleet of agents reads a couple of hundred sources overnight and proposes items. one human keeps the ones that earn it, cuts the rest and says why. if fewer than three items earn it, there is no issue that day. every issue has a markdown twin, so your agent can read it in one fetch and tell you what matters to you.`

### hero (`/` only)

- line: `yet another ai newsletter. assembled by agents, curated by a human, readable by your agent in one fetch.`
- before today's issue lands (a build later than 00:00 utc with no entry for today): `today's issue lands around 06:00 utc. this is the latest one.`

### issue header

- micro line: `{yyyy-mm-dd} · {weekday} · issue {n} · {m} min · give it to your agent ↓`
- `<title>`: `{subject} · yaan {n}`

### metadata strip labels (in this order)

`sources` `read` `proposed` `dropped` `by hand` `kept`, then on their own rows `models` `assembled` `curator`.

The rendered example below shows each label followed by its value:

`sources 214  read 61  proposed 9  dropped 4  by hand 1  kept 6`
`models claude-sonnet-4.5 (scouts), gpt-5-mini (dedupe), claude-opus-4.1 (draft)`
`assembled 05:40 utc  curator léa`

### section names, as rendered (name + descriptor)

| name | descriptor |
|---|---|
| `labs` | `what the labs shipped or said` |
| `sota` | `results that moved a number` |
| `tools` | `things you can install today` |
| `timeline` | `dates worth writing down` |
| `signal` | `one thing the curator thinks is underpriced` |
| `from the fleet` | `a note from an agent that built this issue` |

### item provenance

- `{n} · {domain} · {agent}`
- hand: `{n} · {domain} · {curator} · added by hand`. the agent slot holds the curator's name, so it is never blank and never `human`.
- examples:
  `3 · anthropic.com · scout-labs`
  `5 · github.com · scout-tools`
  `7 · arxiv.org · léa · added by hand`
- domain is the registrable domain with `www.` stripped. `arxiv.org`, not `arxiv.org/abs`. it is computed by `domainOf(url)` in `src/lib/url.ts` and never typed into content.

### signal + fleet signatures

- signal: `— {curator}`
- fleet: `— {agent} · {model}`. example: `— scout-sota · claude-sonnet-4.5`
- fleet note voice, as an example: `i proposed two papers that turned out to be the same result posted twice. dedupe caught one; léa caught the other. i've added author-overlap to my check.`

### signoff

- text: written per issue by the curator, one or two sentences. it says what the day was like and points at the cuts. no "see you tomorrow", no exclamation marks.
- example: `six kept, four cut. a slow monday for the labs and a busy one for tools. the cuts are below if you think i got one wrong.`
- signature: `— {curator}, for the fleet`

### dropped list

- summary: `+ dropped · {count} · proposed by the fleet, cut by the curator` (`−` when open)
- row: `{agent} · {reason}`
- reasons are short and specific. examples: `duplicate of #3` · `press release, no numbers` · `same paper as last week, v2 only fixes typos` · `paywalled, no abstract`
- when `dropped = 0`: the component is not rendered, and the strip shows `dropped 0`.

### cta: give it to your agent (every occurrence)

| where | string |
|---|---|
| issue header micro line | `give it to your agent ↓` (links `#agent`) |
| agent block title | `give it to your agent` |
| agent block instruction | `paste this into claude, chatgpt or any agent that can fetch a url. it reads the markdown twin, not this page.` |
| copy button | `copy prompt` |
| status, success | `copied` |
| status, failure (`text-danger`) | `couldn't copy. select the text above.` |
| action links | `view as markdown` (→ `/{date}/agent`) · `{date}.md` (→ `/{date}.md`) |
| agent view h1 | `{date}, for your agent` |
| agent view endpoints, keys | `this issue` `latest` `rss` `feed.json` `llms.txt` |

### the prompt

this is `agentPrompt(date, issue)`, output verbatim in the `<pre>`. the line breaks are part of the string.

```
read https://yetanotherainewsletter.org/{date}.md once. it is issue {issue} of yaan, a daily ai veille, as plain markdown with yaml frontmatter. don't open the html page or follow links unless i ask.

using what you know about me, my work and my projects, tell me:
1. the one or two items worth my time, and why for me specifically, not in general
2. anything in tools i could install or try today, with the exact link or command from the issue
3. any date in timeline i should put in my calendar

skip everything else. cite each item by number as https://yetanotherainewsletter.org/{date}#{n}. if nothing in this issue matters to me, say so in one line. don't summarise the whole issue, and don't add anything that isn't in it.
```

### cta: subscribe (every occurrence)

| where | string |
|---|---|
| nav | `subscribe` |
| compact promise line (issue page, archive) | `one email on days with an issue, around 06:00 utc. no tracking.` |
| hidden label | `email address` |
| placeholder | `you@example.com` |
| button | `subscribe` |
| `/subscribe` h1 | `subscribe` |
| `/subscribe` promise | `the issue in your inbox around 06:00 utc, only on days there is one. plain text-first email, no tracking pixels, no rewritten links, one-click unsubscribe. you can also follow by rss or feed.json without giving anyone an address.` |
| invalid | `that doesn't look like an email address.` |
| pending h1 / body | `check your inbox` / `a confirmation link is on its way. nothing arrives until you click it. if it isn't there in five minutes, check spam.` |
| confirmed h1 / body | `you're in` / `the next issue lands around 06:00 utc.` then links `read the latest` · `browse the archive` |
| already | `that address is already subscribed. nothing changed.` |
| error | `the email service didn't answer, so nothing was saved. try again later, or follow by rss or feed.json, which don't need an address.` |
| bye | `unsubscribed. no more email. the site and the .md twins stay open.` |

### archive

- count line: `{issues} issues · {skipped} skipped days · since {first_date}`
- row micro: `{kept} items · .md`
- skipped row: `{reason}` in fg-3, followed by `<StateTag skipped>`

### skipped day `/{date}`

- h1: `no issue on {date}`
- body (default reason): `the fleet proposed {proposed} items and {kept} earned a place. the rule is three or nothing, so there was no issue.`
- custom reason from `skipped.json` replaces the body verbatim. example: `pipeline outage from 02:10 to 07:30 utc. we'd rather skip than ship half an issue.`
- links: `← {prev_date}` · `{next_date} →`. a missing neighbour is omitted, not greyed.

### empty + first-visit states

- `/` with zero issues: the hero line, then `no issue yet. the first one lands around 06:00 utc on {launch_date}. subscribe and it'll be the first email you get.`, then the compact form.
- `/archive` with zero issues: `nothing here yet. the first issue lands on {launch_date}.`
- `/latest.md` with zero issues: 404, `text/markdown`, body `no issue yet. first issue: {launch_date}.`
- first visit to `/` with issues: there is no special state. the hero line *is* the first-visit copy, and it renders for everyone. no banners, no "new here?", no cookie notice, because there are no cookies.

### footer (three lines, every page)

1. `yaan · a daily ai veille · rss · feed.json · llms.txt · latest.md`
2. `text cc by 4.0 · code mit · items link to their sources, which keep their own rights`
3. `no cookies, no tracking · privacy · hello@yetanotherainewsletter.org`

### privacy blocks (h2 → body)

- **who runs it**: `yaan is run by {curator}, an individual, from {country}. it is not a company and has no investors or sponsors.`
- **what's stored**: `if you subscribe: your email address and the date you confirmed. it is held by buttondown, our email provider.`
- **what isn't**: `no cookies, no analytics, no fingerprinting, no open or click tracking. links in the email go straight to the source.`
- **email**: `one email on days with an issue. unsubscribe with the link in any email; your address is deleted, not archived.`
- **logs**: `the host keeps standard request logs (ip, path, user agent) for up to 30 days for abuse and debugging. we don't read them for anything else.`
- **license**: `issue text is cc by 4.0: quote, translate or feed it to an agent, with a link back. source titles and linked content belong to their owners. site code is mit.`
- **contact**: `hello@yetanotherainewsletter.org. a human reads it.`

### citing yaan (about)

`cite an item as yetanotherainewsletter.org/{date}#{n}. those urls never change. issues are never edited after 12:00 utc on their day; corrections go in the next issue's intro.`

### subject / headline style

- one line, lowercase, ≤ 72 chars, no trailing period.
- it names the one or two most consequential concrete things, with actors and objects: who did what. use a semicolon or "and" to join two clauses.
- no questions, no colons-as-teasers ("big news:"), no emoji, no "this week in", no adjectives the item can't back up ("massive", "game-changing").
- the same string serves as h1, `<title>` prefix, email subject (`{subject} · yaan {n}`), rss title and the frontmatter `title`.
- worked examples for monday 2026-10-26, issue 142 (illustrative):
  1. `deepmind opens gemini's computer-use api; a 9b model clears swe-bench verified 60%`
  2. `openai publishes its eval harness, and uv learns to resolve cuda wheels`
  3. `a quiet lab day: two point releases, one benchmark that held up, iclr deadlines`
- rejected: `🚀 huge week for agents!` · `is open source finally winning?` · `yaan 142: the agentic future arrives`

---

## 6. implementation notes

### the markdown serializer

`toMarkdown(entry)` emits exactly this shape. it is the contract the parity check parses, so the format is fixed:

```
---
title: "{subject}"
date: 2026-10-26
issue: 142
url: https://yetanotherainewsletter.org/2026-10-26
curator: léa
assembled: 2026-10-26T05:40:00Z
stats: {sources: 214, read: 61, proposed: 9, dropped: 4, hand: 1, kept: 6}
models: ["claude-sonnet-4.5 (scouts)", "gpt-5-mini (dedupe)", "claude-opus-4.1 (draft)"]
prev: 2026-10-25
next: null
---

# {subject}

{intro}

## labs

### 1. [{title}]({url})

{why}

`1 · {domain} · {agent}`

## signal

> {text}
>
> — {curator}

## from the fleet

> {text}
>
> — {agent} · {model}

{signoff text}

— {curator}, for the fleet

## dropped

- [{title}]({url}) · {agent} · {reason}
```

sections appear in the fixed order and are omitted exactly when the html omits them. no html, no reference-style links, and the `.md` contains no emoji the html lacks.

### build order

1. `tokens.css`, `global.css`, and the lint guards (stylelint: no colour or px literals outside tokens.css; a grep for `\[` inside `class=`; a grep for `accent` outside the allowed files). guards come first so nothing gets in.
2. content schema in `src/content/config.ts` (zod), with every invariant below as a refinement. then `date.ts`, `url.ts`, `copy.ts`, `prompt.ts`.
3. `toMarkdown.ts` and the routes `/[date].md.ts` and `/latest.md.ts`, with the content-type set in both the endpoint response and the host headers file. **the twin ships before the html**, since it is the spec of what an issue contains.
4. primitives: `Title`, `DatedRow`, `StateTag`, `Prose`, `Nav`, `Footer`.
5. issue components, then `/[date]` and `/`.
6. skipped pages from `skipped.json`, then `/archive`.
7. `/[date]/agent`.
8. `/about`, `/privacy`, `/subscribe` and its six state routes.
9. `rss.xml`, `feed.json`, `llms.txt`. all three take their content from the same entry: rss and feed.json use `toMarkdown` output for content and the subject for the title; `llms.txt` uses the long positioning line and `agentPrompt`.
10. the acceptance checks as `npm run check`, run in ci on every build. a failing check blocks deploy.

### invariants (the build fails if any breaks)

- `kept ≥ 3` or the date is in `skipped.json`. never both, never neither, for any date from launch to today.
- `kept = proposed − dropped + hand`. `items.length = kept`. `dropped[].length = stats.dropped`. the count of items with `hand: true` = `stats.hand`.
- the issue body (intro + whys + signal + fleet + signoff) is under 600 words.
- items are numbered 1…n continuously in section order. numbering never restarts per section, and the anchor `#n` equals the rendered number.
- `fleet` is present and non-empty. `signal` occurs 0 or 1 times and is ≤ 400 chars. fleet note ≤ 400 chars. why ≤ 220 chars is a warning, not a failure.
- all dates are computed in utc. `formatIssueDate` is the only formatter, and the weekday derives from the date, never from content.
- `.md` comes only from `toMarkdown`. the agent view, rss and feed.json call it rather than re-deriving.
- the prompt always contains the dated `.md` url and never `latest`.
- accent appears in exactly one component. no arbitrary tailwind values. no `font-bold`.
- every page works with js disabled. the only script is the copy-button script, and it is inline.
- no third-party requests on page load: no fonts, analytics or embeds. buttondown is contacted only on form post.
- issue urls are permanent. a published date never 404s and never redirects.

### how a cheaper implementing agent will get this wrong

1. **writing the twin twice.** the agent writes `[date].md.ts` as its own template, or converts the rendered html back to markdown, and the two drift on the first content change (signal shown in one and not the other, numbering off by one). the fix: one serializer, and a parity check that compares rendered outputs, not the entry.
2. **local time.** the agent uses `new Date(date).toLocaleDateString()` or `getDay()` in the build machine's timezone. that puts the weekday a day off for half the world, and builds after 00:00 utc mislabel "today". the fix: parse as `${date}T00:00:00Z`, use `getUTCDay()`, and have one function do it.
3. **"helpfully" softening the rules.** the agent hides the empty fleet section instead of failing, renders a skipped day as a bare 404, drops the dropped list when it's short, adds `font-bold` to item titles, colours the subscribe button with accent, or restarts numbering in each section because it "looks cleaner". every one of these is an invariant above. treat any such diff as a bug, not a style choice.

also watch for: `.md` served as `text/html` or downloaded as `application/octet-stream` because the static host ignores the endpoint headers. set the content-type in the host config too.

### acceptance checks (`npm run check`)

1. **parity.** for every issue in `dist/`:
   - from the html, extract with a dom parser scoped to `main`: subject (h1), intro, stats (`dl` pairs), every `article[id]` as `{n, title, href, why, provenance}`, signal text and signature, fleet text and signature, signoff, and dropped rows `{title, href, agent, reason}`.
   - from the `.md`, parse the frontmatter and the body using the fixed shape above.
   - normalise both sides: nfc unicode, collapsed whitespace, decoded entities, markdown inline marks stripped.
   - assert deep equality, including order, the set of sections present, and word count.
   - a single mismatch fails the build and prints the diff.
2. **twin headers.** `curl -sI /{date}.md` returns `content-type: text/markdown; charset=utf-8` and `200`. the same holds for `/latest.md`, and `/latest.md` equals the newest dated `.md` byte for byte.
3. **calendar completeness.** every date from launch to the build date resolves to either an issue page or a skipped page. the archive row count = issues + skipped.
4. **prompt.** the `<pre id="prompt">` text on `/{date}`, on `/{date}/agent`, and the copy in `llms.txt` all equal `agentPrompt(date, issue)`, and each contains `/{date}.md`.
5. **anchors.** every `#n` referenced in a curator's dropped reason (`duplicate of #3`) and every item id exists on the page.
6. **no-js.** playwright with js disabled: the issue page renders every section, `<details>` opens, the prompt is selectable, the copy button is not visible, and the subscribe form posts.
7. **js.** with js enabled, clicking `copy prompt` puts the exact prompt on the clipboard and the status reads `copied`.
8. **style guards.** the lint and grep rules from build step 1 pass. axe reports zero contrast or label violations on every template, including the subscribe state routes.
9. **network.** loading `/{date}` makes requests only to the site's own origin.
10. **budget.** an issue page is ≤ 30 kb of html+css gzipped, with ≤ 1 kb of inline js. `.md` is ≤ 12 kb.
11. **copy.** every user-facing string in components resolves from `copy.ts`. a grep for quoted lowercase sentences in `.astro` files outside `copy.ts` returns nothing.