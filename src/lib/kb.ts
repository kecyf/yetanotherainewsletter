// yaan KB API v1: the data layer. every /api/v1 endpoint, /openapi.json, /llms-full.txt and the
// search index are built from this one module, from the data root (src/data-live in production,
// src/data fixtures in dev and `check`). docs/kb-api-v1.md is the contract.
//
// no clock, no network: generated_at is the instant the data in a file was produced (issue
// `assembled`, or the UTC day of a kb snapshot), so rebuilding identical data gives identical files.

import fs from 'node:fs';
import path from 'node:path';
import { getIssues, getSkipped, ORIGIN } from './issues';
import { domainOf } from './url';
import { toMarkdown } from './toMarkdown';
import type { IssueEntry } from '../content/schema';

export const API_VERSION = '1';
export const LICENSE = 'CC-BY-4.0';
export const API = `${ORIGIN}/api/v1`;

const DATA_DIR = path.resolve(process.cwd(), process.env.YAAN_DATA_DIR ?? 'src/data');
const KB_DIR = path.join(DATA_DIR, 'kb');

// ---------------------------------------------------------------------------- types

export type Item = {
  id: string;
  issue: string;
  n: number;
  title: string;
  url: string;
  source_domain: string;
  section: string;
  lead: boolean;
  hand: boolean;
  why: string;
  agent: string;
  tags: string[];
  issue_url: string;
  md_url: string;
  api_url: string;
};

export type PoolEntry = {
  id: string;
  date: string;
  title: string;
  url: string;
  source_domain: string;
  source: 'veille' | 'github-trending' | 'agent';
  published_at: string | null;
  short_description: string | null;
  tags: string[];
  status: 'kept' | 'dropped' | 'unreviewed';
  reason: string | null;
  item_id: string | null;
};

export type Signal = {
  id: string;
  date: string;
  type: 'new' | 'expiring' | 'price' | 'context';
  model_id: string;
  model_id_basis: 'catalog' | 'derived';
  name: string;
  provider: string | null;
  details: Record<string, unknown>;
  source: 'openrouter-catalog';
};

export type SignalDay = {
  date: string;
  signals: Signal[];
  totals: Record<string, number>;
  listed: Record<string, number>;
};

export type SearchEntry = {
  id: string;
  kind: 'item' | 'pool' | 'signal';
  title: string;
  url: string | null;
  date: string;
  tags: string[];
  text: string;
};

// ---------------------------------------------------------------------------- helpers

export const SIGNAL_TYPES = ['new', 'expiring', 'price', 'context'] as const;
const TYPE_ORDER: Record<string, number> = { new: 0, expiring: 1, price: 2, context: 3 };

export const itemFile = (issue: string, n: number) => `${issue}-${n}`;
export const itemApiUrl = (issue: string, n: number) => `${API}/items/${itemFile(issue, n)}.json`;
const normUrl = (u: string) => u.split('#')[0].replace(/\/+$/, '');

function readJson<T>(p: string): T {
  return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
}

function listJson(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .map((f) => f.replace(/\.json$/, ''))
    .sort();
}

/** the one place where a response is wrapped. key order is part of the contract. */
export function envelope(
  self: string,
  data: unknown,
  generatedAt: string,
  opts: { count?: number; extra?: Record<string, unknown>; fixture?: boolean } = {},
) {
  return {
    api: 'yaan-kb',
    version: API_VERSION,
    generated_at: generatedAt,
    license: LICENSE,
    self,
    ...(opts.fixture ? { fixture: true } : {}),
    ...(opts.count !== undefined ? { count: opts.count } : {}),
    ...(opts.extra ?? {}),
    data,
  };
}

export function json(obj: unknown, pretty = true): Response {
  return new Response(JSON.stringify(obj, null, pretty ? 2 : undefined) + '\n', {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

const dayStamp = (d: string) => `${d}T00:00:00Z`;

// ---------------------------------------------------------------------------- the store

export type Kb = ReturnType<typeof buildKb>;
let cache: Kb | null = null;

export function getKb(): Kb {
  if (!cache) cache = buildKb();
  return cache;
}

function buildKb() {
  const issues = getIssues(); // oldest first, schema-validated
  const fixture = issues.some((i) => i.fixture);
  const skipped = [...getSkipped().entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, v]) => ({ date, reason: v.reason ?? null }));

  // ---- pool snapshots, status re-derived from the issues (a later issue may keep an older pin)
  const kept = new Map<string, string>(); // normUrl -> item id
  const dropped = new Map<string, string>(); // normUrl -> reason
  for (const e of issues) {
    for (const s of e.sections) for (const it of s.items) kept.set(normUrl(it.url), `${e.date}#${it.n}`);
    for (const d of e.dropped) if (!dropped.has(normUrl(d.url))) dropped.set(normUrl(d.url), d.reason);
  }
  const poolDays = listJson(path.join(KB_DIR, 'pool'));
  const pool: PoolEntry[] = [];
  for (const day of poolDays) {
    const snap = readJson<{ date: string; entries: PoolEntry[] }>(path.join(KB_DIR, 'pool', `${day}.json`));
    if (snap.date !== day) throw new Error(`kb/pool/${day}.json carries date ${snap.date}`);
    for (const e of snap.entries) {
      const k = normUrl(e.url);
      const status: PoolEntry['status'] = kept.has(k) ? 'kept' : dropped.has(k) ? 'dropped' : 'unreviewed';
      pool.push({
        id: e.id,
        date: e.date,
        title: e.title,
        url: e.url,
        source_domain: e.source_domain,
        source: e.source,
        published_at: e.published_at ?? null,
        short_description: e.short_description ?? null,
        tags: e.tags,
        status,
        reason: status === 'dropped' ? (dropped.get(k) ?? null) : null,
        item_id: status === 'kept' ? (kept.get(k) ?? null) : null,
      });
    }
  }
  const poolByDay = new Map<string, PoolEntry[]>();
  for (const e of pool) poolByDay.set(e.date, [...(poolByDay.get(e.date) ?? []), e]);
  const tagsByUrl = new Map<string, string[]>();
  for (const e of pool) tagsByUrl.set(normUrl(e.url), e.tags);

  // ---- items
  const items: Item[] = [];
  for (const e of issues) {
    const flagged = e.sections.flatMap((s) => s.items).some((i) => i.lead);
    e.sections.forEach((s, si) =>
      s.items.forEach((it, ii) => {
        items.push({
          id: `${e.date}#${it.n}`,
          issue: e.date,
          n: it.n,
          title: it.title,
          url: it.url,
          source_domain: domainOf(it.url),
          section: s.name,
          lead: flagged ? it.lead === true : si === 0 && ii === 0,
          hand: it.hand === true,
          why: it.why,
          agent: it.agent,
          tags: tagsByUrl.get(normUrl(it.url)) ?? [],
          issue_url: `${ORIGIN}/${e.date}`,
          md_url: `${ORIGIN}/${e.date}.md`,
          api_url: itemApiUrl(e.date, it.n),
        });
      }),
    );
  }
  items.sort((a, b) => (a.issue === b.issue ? a.n - b.n : a.issue < b.issue ? 1 : -1)); // newest first
  const itemsByIssue = new Map<string, Item[]>();
  for (const it of items) itemsByIssue.set(it.issue, [...(itemsByIssue.get(it.issue) ?? []), it]);

  // ---- model signals
  const signalDays = listJson(path.join(KB_DIR, 'models', 'signals'));
  const signalSnaps = new Map<string, SignalDay>();
  for (const day of signalDays) {
    const snap = readJson<SignalDay>(path.join(KB_DIR, 'models', 'signals', `${day}.json`));
    if (snap.date !== day) throw new Error(`kb/models/signals/${day}.json carries date ${snap.date}`);
    snap.signals.sort((a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type] || (a.id < b.id ? -1 : 1));
    signalSnaps.set(day, snap);
  }
  const signalsNewest: Signal[] = [...signalDays].reverse().flatMap((d) => signalSnaps.get(d)!.signals);

  const paretoPath = path.join(KB_DIR, 'models', 'pareto.json');
  const pareto = fs.existsSync(paretoPath) ? readJson<{ date: string } & Record<string, unknown>>(paretoPath) : null;

  // ---- tags
  const tagCounts = new Map<string, { items: number; pool: number }>();
  const bump = (t: string, k: 'items' | 'pool') => {
    const c = tagCounts.get(t) ?? { items: 0, pool: 0 };
    c[k] += 1;
    tagCounts.set(t, c);
  };
  for (const it of items) for (const t of it.tags) bump(t, 'items');
  for (const p of pool) for (const t of p.tags) bump(t, 'pool');

  // ---- freshness
  const issueStamps = issues.map((i) => i.assembled);
  const days = [...poolDays, ...signalDays, ...(pareto ? [pareto.date] : [])].map(dayStamp);
  const generatedAt = [...issueStamps, ...days].sort().pop() ?? '1970-01-01T00:00:00Z';

  return {
    fixture,
    issues,
    skipped,
    items,
    itemsByIssue,
    pool,
    poolDays,
    poolByDay,
    signalDays,
    signalSnaps,
    signalsNewest,
    pareto,
    tagCounts,
    generatedAt,
    issueStamp: (d: string) => issues.find((i) => i.date === d)?.assembled ?? generatedAt,
    dayStamp,
  };
}

// ---------------------------------------------------------------------------- record builders

export function issueSummary(e: IssueEntry) {
  const itemCount = e.sections.reduce((n, s) => n + s.items.length, 0);
  return {
    date: e.date,
    issue: e.issue,
    title: e.subject,
    url: `${ORIGIN}/${e.date}`,
    md_url: `${ORIGIN}/${e.date}.md`,
    api_url: `${API}/issues/${e.date}.json`,
    stats: e.stats,
    item_count: itemCount,
  };
}

export function issueFull(kb: Kb, e: IssueEntry) {
  const byN = new Map((kb.itemsByIssue.get(e.date) ?? []).map((i) => [i.n, i]));
  return {
    ...issueSummary(e),
    intro: e.intro,
    curator: e.curator,
    assembled: e.assembled,
    models: e.models,
    sections: e.sections.map((s) => ({ name: s.name, items: s.items.map((it) => byN.get(it.n)!) })),
    signal: e.signal ? { text: e.signal.text } : null,
    fleet: e.fleet,
    signoff: { text: e.signoff.text },
    dropped: e.dropped.map((d) => ({
      title: d.title,
      url: d.url,
      source_domain: domainOf(d.url),
      agent: d.agent,
      reason: d.reason,
    })),
    prev: e.prev,
    next: e.next,
  };
}

export function signalDayData(kb: Kb, day: string) {
  const snap = kb.signalSnaps.get(day)!;
  const truncated: Record<string, { total: number; listed: number }> = {};
  for (const [t, total] of Object.entries(snap.totals)) {
    const listed = snap.listed[t] ?? 0;
    if (listed !== total) truncated[t] = { total, listed };
  }
  return { signals: snap.signals, truncated };
}

export function signalText(s: Signal): string {
  const d = s.details as Record<string, any>;
  if (s.type === 'new') return `new model, created ${d.created}`;
  if (s.type === 'expiring') return `expires ${d.expires} (${d.days_left} days left)`;
  if (s.type === 'context') return `context window ${d.from} -> ${d.to}`;
  const p = d.prompt_usd_per_mtok;
  const c = d.completion_usd_per_mtok;
  return `price per 1M tokens, prompt ${p.from} -> ${p.to} USD, completion ${c.from} -> ${c.to} USD`;
}

export function searchIndex(kb: Kb): SearchEntry[] {
  const out: SearchEntry[] = [];
  for (const it of kb.items) {
    out.push({
      id: it.id,
      kind: 'item',
      title: it.title,
      url: it.url,
      date: it.issue,
      tags: it.tags,
      text: `${it.why} (${it.section}, ${it.source_domain})`,
    });
  }
  for (const p of kb.pool) {
    if (p.status === 'kept') continue; // the issue item carries it
    out.push({
      id: p.id,
      kind: 'pool',
      title: p.title,
      url: p.url,
      date: p.date,
      tags: p.tags,
      text: `${p.short_description ?? ''} (${p.source_domain}, ${p.status}${p.reason ? `: ${p.reason}` : ''})`.trim(),
    });
  }
  for (const d of kb.signalDays) {
    for (const s of kb.signalSnaps.get(d)!.signals) {
      out.push({
        id: s.id,
        kind: 'signal',
        title: `${s.name}: ${s.type}`,
        url: null,
        date: s.date,
        tags: [s.type],
        text: `${s.model_id} ${signalText(s)}`,
      });
    }
  }
  return out;
}

export function indexData(kb: Kb) {
  const latest = kb.issues.length ? kb.issues[kb.issues.length - 1] : null;
  const sigCount = kb.signalDays.reduce((n, d) => n + kb.signalSnaps.get(d)!.signals.length, 0);
  const poolStatus = { kept: 0, dropped: 0, unreviewed: 0 };
  for (const p of kb.pool) poolStatus[p.status] += 1;
  const sigTypes: Record<string, number> = { new: 0, expiring: 0, price: 0, context: 0 };
  for (const d of kb.signalDays) for (const s of kb.signalSnaps.get(d)!.signals) sigTypes[s.type] += 1;
  const last = (a: string[]) => (a.length ? a[a.length - 1] : null);
  const first = (a: string[]) => (a.length ? a[0] : null);
  const issueDates = kb.issues.map((i) => i.date);
  return {
    latest_issue: latest ? issueSummary(latest) : null,
    last_updated: kb.generatedAt,
    counts: {
      issues: kb.issues.length,
      items: kb.items.length,
      skipped_days: kb.skipped.length,
      pool_days: kb.poolDays.length,
      pool_entries: kb.pool.length,
      signal_days: kb.signalDays.length,
      signals: sigCount,
      tags: kb.tagCounts.size,
    },
    datasets: {
      issues: { count: kb.issues.length, first: first(issueDates), latest: last(issueDates), updated: latest ? latest.assembled : null },
      pool: { days: kb.poolDays, entries: kb.pool.length, by_status: poolStatus, first: first(kb.poolDays), latest: last(kb.poolDays), updated: kb.poolDays.length ? dayStamp(last(kb.poolDays)!) : null },
      model_signals: { days: kb.signalDays, signals: sigCount, by_type: sigTypes, first: first(kb.signalDays), latest: last(kb.signalDays), updated: kb.signalDays.length ? dayStamp(last(kb.signalDays)!) : null },
      model_pareto: { available: kb.pareto !== null, date: kb.pareto ? kb.pareto.date : null, updated: kb.pareto ? dayStamp(kb.pareto.date) : null },
    },
    skipped_days: kb.skipped,
    resources: {
      index: `${API}/index.json`,
      issues: `${API}/issues.json`,
      issue: `${API}/issues/{date}.json`,
      items: `${API}/items.json`,
      item: `${API}/items/{date}-{n}.json`,
      pool: `${API}/pool/{date}.json`,
      model_signals: `${API}/models/signals.json`,
      model_signals_day: `${API}/models/signals/{date}.json`,
      model_pareto: `${API}/models/pareto.json`,
      tags: `${API}/tags.json`,
      search_index: `${API}/search-index.json`,
      search: `${API}/search?q={query}`,
      openapi: `${ORIGIN}/openapi.json`,
      llms: `${ORIGIN}/llms.txt`,
      llms_full: `${ORIGIN}/llms-full.txt`,
      mcp: `${ORIGIN}/mcp`,
      mcp_card: `${ORIGIN}/.well-known/mcp.json`,
    },
  };
}

export function endpointMap(kb: Kb): string {
  const r = indexData(kb).resources;
  return [
    '## endpoint map',
    '',
    `base: ${API}/ (all GET, no key, CORS *, CC-BY-4.0)`,
    '',
    `- ${r.index}: the map, counts, freshness per dataset`,
    `- ${r.issues}: every issue, newest first`,
    `- ${r.issue}: one full issue (sections, items, dropped with reasons, fleet note, stats, models, curator)`,
    `- ${r.items}: every kept item ever, flattened, newest first`,
    `- ${r.item}: one item, id like 2026-11-13#3`,
    `- ${r.pool}: the day's candidate pool, each entry kept, dropped (with reason) or unreviewed`,
    `- ${r.model_signals}: newest 200 model-market signals (new, expiring, price, context)`,
    `- ${r.model_signals_day}: one day of model signals`,
    `- ${r.model_pareto}: latest price x quality Pareto table (data: null when none)`,
    `- ${r.tags}: tag counts`,
    `- ${r.search_index}: compact index for client-side search`,
    `- ${r.search}: ranked search (q, kind, tag, since, limit)`,
    `- ${r.openapi}: OpenAPI 3.1`,
    `- ${r.mcp}: remote MCP server (Streamable HTTP, stateless; tools: latest_issue, get_issue, search, list_model_signals, get_pool)`,
    '',
  ].join('\n');
}

export function llmsFull(kb: Kb): string {
  const parts: string[] = [
    '# yaan: full text',
    '',
    `every published issue as markdown, newest first, then the endpoint map. same data as ${API}/index.json.`,
    'text is CC-BY-4.0; linked sources keep their own rights.',
    '',
  ];
  const newest = [...kb.issues].reverse();
  if (newest.length === 0) parts.push('no issue has been published yet.', '');
  for (const e of newest) {
    parts.push(`<!-- issue ${e.issue} · ${ORIGIN}/${e.date}.md · ${API}/issues/${e.date}.json -->`, '', toMarkdown(e).trimEnd(), '', '');
  }
  parts.push(endpointMap(kb));
  return parts.join('\n');
}
