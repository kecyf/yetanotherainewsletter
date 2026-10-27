## 10. Revision v1.1 — two renderings, one record (human page hierarchy)

**Why this exists.** Kevin read the built site: *"je vois l'intention de structure, mais paradoxalement je le trouve très imbuvable pour un humain."* Measured against the shipped tokens, the cause is a hierarchy failure, not taste: section `h2` was **14px/22 — identical in size and leading to body text**, the subject `h1` was 20px, body and the `why it matters` lines sat at `--fg-2` (#b4b4ba), the weight ceiling was 500 with no bold, the single accent was used once, and **the metadata strip occupied the above-the-fold space while the first item of the day sat below it**.

**Root cause, stated plainly:** the brief was written machine-first and the human page inherited the machine's typography. "Agents read this" is a claim about distribution and provenance, not a licence to typeset the human page like a terminal.

**Decision (Kevin, "B en autonomie"): the split already present in the artifact becomes the typography.** `/…/agent`, `/…/md`, `/feed.json` and `/llms.txt` are the machine surface and keep the v1 dense mono treatment. The human page becomes editorial.

### 10.1 Implementation shape
One record, two token scopes. The page root carries `data-view="reader"` (human pages) or `data-view="agent"` (the agent view and any machine-facing rendering). Components are shared and resolve their sizes and colours through the tokens; the scope overrides the token values, not the markup. **No component forks.** A rule that only applies to one view is expressed as a scoped token, never as a conditional in a component.

### 10.2 Token additions (and the only changed values)
All of it goes in the single token file; components still consume mapped classes only.

```css
/* --- reading ink: raise the payload --- */
--fg-reading: #c9c9cf;          /* body + why-it-matters on the reader view */

/* --- reader scale (v1.1): real size contrast, still no bold --- */
--fs-subject: 26px;  --lh-subject: 34px;   /* page h1, the day's subject (was 20/28) */
--fs-lead:    20px;  --lh-lead:    28px;   /* the lead item's title */
--fs-lead-why:17px;  --lh-lead-why:26px;   /* the lead item's why-it-matters */
--fs-item:    17px;  --lh-item:    25px;   /* every other item title */
--fs-body-r:  16.5px;--lh-body-r:  27px;   /* reader running text (was 14/22) */
--fs-kicker:  13px;  --lh-kicker:  20px;   /* section names, rendered uppercase */
--tr-kicker:  0.08em;

/* --- air --- */
--sp-16: 64px;                   /* between reader sections (was 48) */

/* --- provenance, demoted --- */
--strip-key: var(--fg-3);
--strip-val: var(--fg-3);        /* the strip is a whisper on the reader view */
```

The `agent` scope keeps every v1 value untouched (`--fs-body: 14px`, `--fs-title-2: 14px` mono, `--fg-2` body, 48px section gaps, the strip's `--fg-1` values).

### 10.3 Reader page order and hierarchy
1. **Subject** (`h1`, `--fs-subject`), then the date line (mono, micro — the only mono above the items), then the intro (`--fg-reading`, `--fs-body-r`).
2. **The lead item**, immediately after the intro. Its title at `--fs-lead`, its why at `--fs-lead-why` in `--fg-reading`, separated from the rest by `--sp-12` above and below. The lead is the single most consequential item of the day: the record carries an optional `lead: true` on exactly one item; when no item is flagged, the first item of the first section is the lead and must not be repeated in its section. Size and air only — no badge, no colour, no border.
3. **Sections** (`labs`, `sota`, `tools`, `timeline`, `signal`, `from the fleet`): a **kicker** — the section name rendered `text-transform: uppercase` at `--fs-kicker` with `--tr-kicker`, `--fw-medium`, `--fg-3` — followed on the same line by the descriptor in normal case at `--fs-kicker`, `--fg-3`. The authored names stay lowercase in the data; the kicker is a display transform, so `copy.ts` and the `.md` twin are unaffected. Items inside: title `--fs-item` `--fg-1`, why `--fs-body-r` `--fg-reading`, provenance line micro mono `--fg-3`.
4. **Signoff**, then the **signoff line**, then the **metadata strip** — one line, micro mono, `--fg-3` values, no rules, now at the *end* of the page. Provenance is a footnote for a reader and the payload for a machine; the machine reads the frontmatter and the strip end anyway.
5. **Footer** unchanged.

### 10.4 Copy deck amendment (the only string rule that changes)
- **Subject: sentence case, not lowercase.** `Gemma 4 goes open with a 1M-token context; open weights clear 80% on SWE-bench Verified`. The same authored string serves the `h1`, `<title>`, the `.md` frontmatter, the feed and the email subject, and **all of them render it as authored** — no CSS `text-transform` on headlines, ever (it breaks proper nouns). Length target ≤ 72 chars, hard ceiling 80.
- Everything else in §4 stands, including the rejected-subject list and the lowercase treatment of machine-flavoured labels (dates, provenance, the strip, the prompt, the agent view).
- The fixture's subject is rewritten in sentence case to match.

### 10.5 Acceptance checks added for this revision
1. The metadata strip appears **after** the signoff in DOM order on the reader page.
2. The reader page renders at least three distinct type sizes above the strip (subject, item title or lead, body) — no single-size page.
3. Section names are rendered uppercase via CSS while `copy.ts` keeps them lowercase, and the `.md` twin is byte-identical to what it was before the revision apart from the subject case.
4. The agent view is unchanged: same tokens as v1, same mono treatment.
5. No `text-transform` applied to any headline string.
