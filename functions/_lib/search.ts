// ranking for /api/v1/search and the MCP `search` tool. case-insensitive word-prefix match over
// title, tags and text; title counts most, then tags, then text; newer wins ties.

export type IndexEntry = {
  id: string;
  kind: 'item' | 'pool' | 'signal';
  title: string;
  url: string | null;
  date: string;
  tags: string[];
  text: string;
};

export type Hit = IndexEntry & { score: number; api_url: string };

export const KINDS = ['item', 'pool', 'signal'] as const;
export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 50;

const STOP = new Set(['the', 'a', 'an', 'of', 'and', 'or', 'to', 'in', 'on', 'for', 'is', 'are', 'what', 'whats', 'with', 'about', 'new', 'any']);

const fold = (s: string) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function tokenize(q: string): string[] {
  const out: string[] = [];
  for (const raw of fold(q).split(/[^\p{L}\p{N}.]+/u)) {
    const t = raw.replace(/^\.+|\.+$/g, '');
    if (t.length >= 2 && !STOP.has(t) && !out.includes(t)) out.push(t);
  }
  // "new" is a stop word for prose queries but a real filter value: keep it when it is the only token
  if (out.length === 0) {
    const t = fold(q).trim();
    if (t.length >= 2) out.push(t);
  }
  return out.slice(0, 12);
}

/** occurrences of tok at a word start in hay (hay and tok already folded). */
function wordStarts(hay: string, tok: string): number {
  let n = 0;
  let i = hay.indexOf(tok);
  while (i !== -1) {
    if (i === 0 || !/[\p{L}\p{N}]/u.test(hay[i - 1])) n++;
    i = hay.indexOf(tok, i + 1);
  }
  return n;
}

export function apiUrlFor(origin: string, e: IndexEntry): string {
  if (e.kind === 'item') return `${origin}/api/v1/items/${e.id.replace('#', '-')}.json`;
  if (e.kind === 'pool') return `${origin}/api/v1/pool/${e.date}.json`;
  return `${origin}/api/v1/models/signals/${e.date}.json`;
}

export function rank(
  entries: IndexEntry[],
  o: { q: string; kind?: string | null; tag?: string | null; since?: string | null; limit: number; origin: string },
): { total: number; hits: Hit[] } {
  const toks = tokenize(o.q);
  const phrase = fold(o.q).trim();
  const need = Math.max(1, Math.ceil(toks.length / 2));
  const tag = o.tag ? fold(o.tag).trim() : null;
  const scored: { e: IndexEntry; score: number; matched: number }[] = [];
  for (const e of entries) {
    if (o.kind && e.kind !== o.kind) continue;
    if (o.since && e.date < o.since) continue;
    const tags = e.tags.map(fold);
    if (tag && !tags.includes(tag)) continue;
    const title = fold(e.title);
    const text = fold(e.text);
    let score = 0;
    let matched = 0;
    for (const t of toks) {
      let s = 0;
      if (wordStarts(title, t)) s += 6;
      if (tags.some((g) => g === t || g.startsWith(t))) s += tags.includes(t) ? 5 : 4;
      const c = wordStarts(text, t);
      if (c) s += 2 + (c > 1 ? 1 : 0);
      if (s > 0) matched++;
      score += s;
    }
    if (matched < need) continue;
    if (phrase.length >= 3 && title.includes(phrase)) score += 5;
    score += (matched / toks.length) * 4; // coverage
    scored.push({ e, score, matched });
  }
  scored.sort(
    (a, b) =>
      b.score - a.score ||
      (a.e.date < b.e.date ? 1 : a.e.date > b.e.date ? -1 : 0) ||
      (a.e.id < b.e.id ? -1 : 1),
  );
  return {
    total: scored.length,
    hits: scored.slice(0, o.limit).map(({ e, score }) => ({ ...e, score: Math.round(score * 100) / 100, api_url: apiUrlFor(o.origin, e) })),
  };
}

/** parse the shared query params. returns an error string or the clean values. */
export function parseParams(p: {
  q?: unknown;
  kind?: unknown;
  tag?: unknown;
  since?: unknown;
  limit?: unknown;
}): { error: string } | { q: string; kind: string | null; tag: string | null; since: string | null; limit: number } {
  const q = typeof p.q === 'string' ? p.q.trim() : '';
  if (!q) return { error: 'q is required: a non-empty search string' };
  if (q.length > 200) return { error: 'q must be at most 200 characters' };
  let kind: string | null = null;
  if (p.kind !== undefined && p.kind !== null && p.kind !== '') {
    if (typeof p.kind !== 'string' || !(KINDS as readonly string[]).includes(p.kind)) return { error: `kind must be one of: ${KINDS.join(', ')}` };
    kind = p.kind;
  }
  let tag: string | null = null;
  if (p.tag !== undefined && p.tag !== null && p.tag !== '') {
    if (typeof p.tag !== 'string' || p.tag.length > 60) return { error: 'tag must be a string of at most 60 characters' };
    tag = p.tag;
  }
  let since: string | null = null;
  if (p.since !== undefined && p.since !== null && p.since !== '') {
    if (typeof p.since !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(p.since) || Number.isNaN(Date.parse(`${p.since}T00:00:00Z`)))
      return { error: 'since must be a date like 2026-11-01' };
    since = p.since;
  }
  let limit = DEFAULT_LIMIT;
  if (p.limit !== undefined && p.limit !== null && p.limit !== '') {
    const n = typeof p.limit === 'number' ? p.limit : Number(p.limit);
    if (!Number.isInteger(n) || n < 1) return { error: `limit must be an integer between 1 and ${MAX_LIMIT}` };
    limit = Math.min(n, MAX_LIMIT);
  }
  return { q, kind, tag, since, limit };
}
