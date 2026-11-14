// the OpenAPI 3.1 document for /api/v1, /api/v1/search and /mcp. built from the same data layer as the
// endpoints, so the examples are real records. scripts/check-kb.mjs validates every generated file against
// the schemas below (this spec is the machine-checked contract, not a decoration).

import { API, API_VERSION, LICENSE, indexData, issueFull, issueSummary, signalDayData, envelope, searchIndex, type Kb } from './kb';
import { ORIGIN } from './issues';
import { TOOLS } from '../../functions/_lib/tools';

type S = Record<string, unknown>;

const str = (extra: S = {}): S => ({ type: 'string', ...extra });
const strN = (extra: S = {}): S => ({ type: ['string', 'null'], ...extra });
const int = (extra: S = {}): S => ({ type: 'integer', ...extra });
const num = (extra: S = {}): S => ({ type: ['number'], ...extra });
const bool = (): S => ({ type: 'boolean' });
const arr = (items: S, extra: S = {}): S => ({ type: 'array', items, ...extra });
const obj = (props: Record<string, S>, required?: string[], extra: S = {}): S => ({
  type: 'object',
  properties: props,
  required: required ?? Object.keys(props),
  additionalProperties: false,
  ...extra,
});
const ref = (name: string): S => ({ $ref: `#/components/schemas/${name}` });

const DATE: S = str({ pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'UTC date, YYYY-MM-DD' });
const TS: S = str({ pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}Z$', description: 'UTC timestamp, ISO 8601 with Z' });
const URL_HTTPS: S = str({ pattern: '^https://', format: 'uri' });

/** the envelope around every JSON file. */
function env(data: S, opts: { count?: boolean; extra?: Record<string, S> } = {}): S {
  const props: Record<string, S> = {
    api: str({ const: 'yaan-kb' }),
    version: str({ const: API_VERSION }),
    generated_at: TS,
    license: str({ const: LICENSE }),
    self: str({ format: 'uri' }),
    fixture: { const: true, description: 'present only on non-production (fixture) builds' },
    ...(opts.count ? { count: int({ minimum: 0 }) } : {}),
    ...(opts.extra ?? {}),
    data,
  };
  const required = ['api', 'version', 'generated_at', 'license', 'self', ...(opts.count ? ['count'] : []), ...Object.keys(opts.extra ?? {}), 'data'];
  return obj(props, required);
}

function schemas(): Record<string, S> {
  const stats = obj({ sources: int(), read: int(), proposed: int(), dropped: int(), hand: int(), kept: int() });
  const item = obj({
    id: str({ pattern: '^\\d{4}-\\d{2}-\\d{2}#\\d+$', description: 'issue date + "#" + item number' }),
    issue: DATE,
    n: int({ minimum: 1, description: 'item number, 1..n across the whole issue' }),
    title: str(),
    url: URL_HTTPS,
    source_domain: str(),
    section: str({ enum: ['labs', 'sota', 'tools', 'timeline'] }),
    lead: bool(),
    hand: { type: 'boolean', description: 'true when the curator added this item by hand' },
    why: str({ description: 'one or two lines, written by the compose run, why the item earned its place' }),
    agent: str({ description: 'the rail/agent slug that proposed the item' }),
    tags: arr(str()),
    issue_url: URL_HTTPS,
    md_url: URL_HTTPS,
    api_url: URL_HTTPS,
  });
  const issueSummarySchema = obj({
    date: DATE,
    issue: int({ minimum: 1 }),
    title: str(),
    url: URL_HTTPS,
    md_url: URL_HTTPS,
    api_url: URL_HTTPS,
    stats,
    item_count: int({ minimum: 0 }),
  });
  const issue = obj({
    ...(issueSummarySchema.properties as Record<string, S>),
    intro: str(),
    curator: str(),
    assembled: TS,
    models: arr(str()),
    sections: arr(obj({ name: str({ enum: ['labs', 'sota', 'tools', 'timeline'] }), items: arr(ref('Item')) })),
    signal: { oneOf: [obj({ text: str() }), { type: 'null' }] },
    fleet: obj({ agent: str(), model: str(), text: str() }),
    signoff: obj({ text: str() }),
    dropped: arr(obj({ title: str(), url: URL_HTTPS, source_domain: str(), agent: str(), reason: str() })),
    prev: strN({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' }),
    next: strN({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' }),
  });
  const pool = obj({
    id: str({ pattern: '^p_[0-9a-f]{12}$', description: 'p_ + first 12 hex of sha1(url)' }),
    date: DATE,
    title: str(),
    url: URL_HTTPS,
    source_domain: str(),
    source: str({ enum: ['veille', 'github-trending', 'agent'] }),
    published_at: strN({ description: 'publication date or timestamp when the source gave one, else null' }),
    short_description: strN({ description: 'at most 280 characters, null when the source had none or it was not public-safe' }),
    tags: arr(str()),
    status: str({ enum: ['kept', 'dropped', 'unreviewed'] }),
    reason: strN({ description: "the editor's reason, set when status is dropped" }),
    item_id: strN({ description: 'the issue item id, set when status is kept' }),
  });
  const fromTo = (t: S) => obj({ from: t, to: t });
  const price = (): S => ({ type: ['number', 'null'], description: 'USD per 1M tokens' });
  const signal = obj({
    id: str({ description: '"{date}:{type}:{model_id}"' }),
    date: DATE,
    type: str({ enum: ['new', 'expiring', 'price', 'context'] }),
    model_id: str(),
    model_id_basis: str({
      enum: ['catalog', 'derived'],
      description: 'catalog: the display name matched exactly one id of the OpenRouter catalog snapshot; derived: a stable slug built from provider and name (the digest does not carry ids)',
    }),
    name: str(),
    provider: strN(),
    details: {
      oneOf: [
        obj({ created: DATE }),
        obj({ expires: DATE, days_left: int({ minimum: 0 }) }),
        obj({ prompt_usd_per_mtok: fromTo(price()), completion_usd_per_mtok: fromTo(price()) }),
        fromTo(int()),
      ],
      description: 'new: {created}; expiring: {expires, days_left (as of the day seen)}; price: USD per 1M tokens from/to for prompt and completion; context: {from, to} in tokens',
    },
    source: str({ const: 'openrouter-catalog' }),
  });
  const paretoRow = obj({
    model_id: str(),
    score: num(),
    score_label: str(),
    usd_per_mtok_in: { type: ['number', 'null'] },
    usd_per_mtok_out: { type: ['number', 'null'] },
    usd_per_mtok_blended: { type: ['number', 'null'] },
    notes: arr(str()),
  });
  const pareto = obj({
    date: DATE,
    priced_routes: { type: ['integer', 'null'] },
    scored_routes: { type: ['integer', 'null'] },
    coverage: arr(obj({ metric: str(), scored: int() })),
    sources: str({ description: 'the public sources of the table, with their attribution and licence as stated by the exporter' }),
    currency: str({ const: 'USD' }),
    unit: str({ const: 'per 1M tokens' }),
    categories: arr(
      obj({
        title: str(),
        metric: str(),
        blend: obj({ in: int(), out: int() }),
        scored_candidates: int(),
        frontier_size: int(),
        pick_rule: str(),
        pick_model_id: str(),
        frontier: arr(paretoRow),
      }),
    ),
    notes: arr(str()),
  });
  const indexEntry = obj({
    id: str(),
    kind: str({ enum: ['item', 'pool', 'signal'] }),
    title: str(),
    url: { oneOf: [URL_HTTPS, { type: 'null' }] },
    date: DATE,
    tags: arr(str()),
    text: str(),
  });
  const hit = obj({ ...(indexEntry.properties as Record<string, S>), score: num(), api_url: URL_HTTPS });
  const dataset = (extra: Record<string, S>) => obj({ ...extra });
  const indexDataSchema = obj({
    latest_issue: { oneOf: [ref('IssueSummary'), { type: 'null' }] },
    last_updated: TS,
    counts: obj({ issues: int(), items: int(), skipped_days: int(), pool_days: int(), pool_entries: int(), signal_days: int(), signals: int(), tags: int() }),
    datasets: obj({
      issues: dataset({ count: int(), first: strN(), latest: strN(), updated: { oneOf: [TS, { type: 'null' }] } }),
      pool: dataset({
        days: arr(DATE),
        entries: int(),
        by_status: obj({ kept: int(), dropped: int(), unreviewed: int() }),
        first: strN(),
        latest: strN(),
        updated: { oneOf: [TS, { type: 'null' }] },
      }),
      model_signals: dataset({
        days: arr(DATE),
        signals: int(),
        by_type: obj({ new: int(), expiring: int(), price: int(), context: int() }),
        first: strN(),
        latest: strN(),
        updated: { oneOf: [TS, { type: 'null' }] },
      }),
      model_pareto: dataset({ available: bool(), date: strN(), updated: { oneOf: [TS, { type: 'null' }] } }),
    }),
    skipped_days: arr(obj({ date: DATE, reason: strN() })),
    resources: obj(
      Object.fromEntries(
        ['index', 'issues', 'issue', 'items', 'item', 'pool', 'model_signals', 'model_signals_day', 'model_pareto', 'tags', 'search_index', 'search', 'openapi', 'llms', 'llms_full', 'mcp', 'mcp_card'].map((k) => [k, str()]),
      ),
    ),
  });
  return {
    Stats: stats,
    Item: item,
    IssueSummary: issueSummarySchema,
    Issue: issue,
    PoolEntry: pool,
    Signal: signal,
    Pareto: pareto,
    SearchIndexEntry: indexEntry,
    SearchHit: hit,
    IndexData: indexDataSchema,
    Error: obj({ api: str({ const: 'yaan-kb' }), version: str({ const: API_VERSION }), error: obj({ status: int(), code: str(), message: str() }) }),
    IndexResponse: env(ref('IndexData')),
    IssuesResponse: env(arr(ref('IssueSummary')), { count: true }),
    IssueResponse: env(ref('Issue')),
    ItemsResponse: env(arr(ref('Item')), { count: true }),
    ItemResponse: env(ref('Item')),
    PoolResponse: env(arr(ref('PoolEntry')), { count: true }),
    SignalsResponse: env(arr(ref('Signal')), { count: true, extra: { total: int({ description: 'signals available in total; this file lists the newest 200' }) } }),
    SignalsDayResponse: env(arr(ref('Signal')), {
      count: true,
      extra: {
        truncated: {
          type: 'object',
          description: 'per signal type, set only when the source digest listed fewer lines than its own header count (the watcher prints at most 12 per type)',
          additionalProperties: obj({ total: int(), listed: int() }),
        },
      },
    }),
    ParetoResponse: env({ oneOf: [ref('Pareto'), { type: 'null' }] }),
    TagsResponse: env({ type: 'object', additionalProperties: obj({ items: int(), pool: int() }) }, { count: true }),
    SearchIndexResponse: env(arr(ref('SearchIndexEntry')), { count: true }),
    SearchResponse: env(arr(ref('SearchHit')), {
      count: true,
      extra: {
        total: int({ description: 'matches before the limit' }),
        query: obj({ q: str(), kind: strN(), tag: strN(), since: strN(), limit: int() }),
      },
    }),
  };
}

const jsonOk = (schema: string, example?: unknown, description = 'ok'): S => ({
  description,
  headers: {
    'Access-Control-Allow-Origin': { schema: str(), description: '*' },
    'Cache-Control': { schema: str() },
  },
  content: { 'application/json': { schema: ref(schema), ...(example !== undefined ? { example } : {}) } },
});

const dateParam = (what: string): S => ({ name: 'date', in: 'path', required: true, description: what, schema: DATE });

function trimmed<T extends { data: unknown; count?: number }>(e: T, n: number): T {
  const d = e.data;
  if (!Array.isArray(d) || d.length <= n) return e;
  return { ...e, data: d.slice(0, n), ...(e.count !== undefined ? { count: n } : {}) };
}

export function openapi(kb: Kb) {
  const ex: Record<string, unknown> = {};
  const idx = indexData(kb);
  const latest = kb.issues.length ? kb.issues[kb.issues.length - 1] : null;
  ex.index = envelope(`${API}/index.json`, idx, kb.generatedAt, { fixture: kb.fixture });
  if (latest) {
    ex.issues = envelope(`${API}/issues.json`, [...kb.issues].reverse().map(issueSummary), latest.assembled, { count: kb.issues.length, fixture: kb.fixture });
    ex.issue = envelope(`${API}/issues/${latest.date}.json`, issueFull(kb, latest), latest.assembled, { fixture: kb.fixture });
    const it = kb.items.find((i) => i.issue === latest.date)!;
    ex.item = envelope(`${API}/items/${it.issue}-${it.n}.json`, it, latest.assembled, { fixture: kb.fixture });
    ex.items = trimmed(envelope(`${API}/items.json`, kb.items, latest.assembled, { count: kb.items.length, fixture: kb.fixture }), 2);
  }
  const poolDay = kb.poolDays.length ? kb.poolDays[kb.poolDays.length - 1] : null;
  if (poolDay) {
    const rows = kb.poolByDay.get(poolDay)!;
    ex.pool = trimmed(envelope(`${API}/pool/${poolDay}.json`, rows, kb.dayStamp(poolDay), { count: rows.length, fixture: kb.fixture }), 2);
  }
  const sigDay = kb.signalDays.length ? kb.signalDays[kb.signalDays.length - 1] : null;
  if (sigDay) {
    const { signals, truncated } = signalDayData(kb, sigDay);
    const pick = ['new', 'price', 'expiring', 'context'].map((t) => signals.find((s) => s.type === t)).filter(Boolean);
    ex.signalsDay = envelope(`${API}/models/signals/${sigDay}.json`, pick, kb.dayStamp(sigDay), { count: pick.length, fixture: kb.fixture, extra: { truncated } });
    ex.signals = envelope(`${API}/models/signals.json`, pick, kb.dayStamp(sigDay), { count: pick.length, fixture: kb.fixture, extra: { total: kb.signalsNewest.length } });
  }
  if (kb.pareto) {
    const p = JSON.parse(JSON.stringify(kb.pareto));
    p.categories = p.categories.slice(0, 1).map((c: any) => ({ ...c, frontier: c.frontier.slice(0, 2) }));
    ex.pareto = envelope(`${API}/models/pareto.json`, p, kb.dayStamp(kb.pareto.date), { fixture: kb.fixture });
  }
  const tags = Object.fromEntries([...kb.tagCounts.entries()].sort((a, b) => b[1].items + b[1].pool - (a[1].items + a[1].pool) || (a[0] < b[0] ? -1 : 1)).slice(0, 4));
  ex.tags = envelope(`${API}/tags.json`, tags, kb.generatedAt, { count: Object.keys(tags).length, fixture: kb.fixture });
  const si = searchIndex(kb);
  ex.searchIndex = envelope(`${API}/search-index.json`, si.slice(0, 2), kb.generatedAt, { count: 2, fixture: kb.fixture });
  const hitSrc = si.find((e) => e.kind === 'item') ?? si[0];
  if (hitSrc) {
    const apiUrl = hitSrc.kind === 'item' ? `${API}/items/${hitSrc.id.replace('#', '-')}.json` : hitSrc.kind === 'pool' ? `${API}/pool/${hitSrc.date}.json` : `${API}/models/signals/${hitSrc.date}.json`;
    const q = hitSrc.title.split(/\s+/).find((w) => w.length > 3) ?? hitSrc.title;
    ex.search = envelope(`${API}/search?q=${encodeURIComponent(q)}`, [{ ...hitSrc, score: 14.5, api_url: apiUrl }], kb.generatedAt, {
      count: 1,
      fixture: kb.fixture,
      extra: { total: 1, query: { q, kind: null, tag: null, since: null, limit: 10 } },
    });
  }

  const cache300 = 'public, max-age=300, stale-while-revalidate=3600';
  const get = (operationId: string, summary: string, description: string, schema: string, example: unknown, extra: S = {}): S => ({
    get: {
      operationId,
      summary,
      description,
      tags: ['knowledge base'],
      ...extra,
      responses: { '200': jsonOk(schema, example) },
    },
  });
  const notFound: S = { '404': { description: 'no such date, or no snapshot for that date (the day index lists what exists)' } };
  const withNotFound = (p: S): S => {
    (p.get as S).responses = { ...((p.get as S).responses as S), ...notFound };
    return p;
  };

  const paths: Record<string, S> = {
    '/api/v1/': get('getIndexSlash', 'The map', `Same document as /api/v1/index.json. Counts, the latest issue, freshness per dataset, and a link to every resource. Cache-Control: ${cache300}.`, 'IndexResponse', ex.index),
    '/api/v1/index.json': get('getIndex', 'The map', `Counts, the latest issue, freshness per dataset, the list of days that have a pool or signal snapshot, skipped days, and a link to every resource. Cache-Control: ${cache300}.`, 'IndexResponse', ex.index),
    '/api/v1/issues.json': get('listIssues', 'List issues', 'Every published issue, newest first, with stats and links.', 'IssuesResponse', ex.issues),
    '/api/v1/issues/{date}.json': withNotFound({
      ...get('getIssue', 'One issue', 'One full issue, structured: sections with items, dropped candidates with reasons, fleet note, stats, models, curator. Immutable once published (Cache-Control: public, max-age=31536000, immutable).', 'IssueResponse', ex.issue, { parameters: [dateParam('issue date')] }),
    }),
    '/api/v1/items.json': get('listItems', 'Every kept item', 'Every kept item ever, flattened, newest first. One fetch for the whole curated archive.', 'ItemsResponse', ex.items),
    '/api/v1/items/{id}.json': withNotFound(
      get('getItem', 'One item', 'One kept item. The id inside the record is "2026-11-13#3"; the file name uses a dash: 2026-11-13-3.json. Immutable.', 'ItemResponse', ex.item, {
        parameters: [{ name: 'id', in: 'path', required: true, description: 'issue date and item number joined by a dash', schema: str({ pattern: '^\\d{4}-\\d{2}-\\d{2}-\\d+$' }), example: latest ? `${latest.date}-1` : undefined }],
      }),
    ),
    '/api/v1/pool/{date}.json': withNotFound(
      get('getPool', "A day's candidate pool", `Every public-safe item the veille rail saw on that UTC day (lab and vendor posts, GitHub trending, arXiv papers), each with a status: kept (item_id says which issue item), dropped (reason says why) or unreviewed. The index lists the days that exist. Snapshots are re-exported and statuses follow the issues, so these files are not immutable: Cache-Control: public, max-age=3600, stale-while-revalidate=86400.`, 'PoolResponse', ex.pool, { parameters: [dateParam('pool date')] }),
    ),
    '/api/v1/models/signals.json': get('listModelSignals', 'Newest model signals', 'The newest 200 model-market signals (new model, expiring model, price move over 10%, context window change) from the OpenRouter catalog diff, newest day first. total says how many exist.', 'SignalsResponse', ex.signals),
    '/api/v1/models/signals/{date}.json': withNotFound(
      get('getModelSignalsDay', "A day's model signals", 'The signals of one UTC day. The watcher prints at most 12 lines per type; `truncated` says when the day had more than were listed. Cache-Control: public, max-age=3600, stale-while-revalidate=86400.', 'SignalsDayResponse', ex.signalsDay, { parameters: [dateParam('signal date')] }),
    ),
    '/api/v1/models/pareto.json': get('getPareto', 'Price x quality Pareto table', 'The latest price-versus-quality frontier per use case (human preference, bulk classification, coding, frontier reasoning), prices in USD per 1M tokens. Built from OpenRouter /benchmarks (Artificial Analysis indexes, attribution https://artificialanalysis.ai/), the LMArena leaderboard dataset (CC-BY-4.0) and the OpenRouter catalog; those sources keep their own terms. data is null when no table has been exported (never a 404).', 'ParetoResponse', ex.pareto),
    '/api/v1/tags.json': get('listTags', 'Tags', 'Tag -> { items, pool } counts, most used first. Tags are topical (openai, arxiv, security...); internal workflow labels are never published.', 'TagsResponse', ex.tags),
    '/api/v1/search-index.json': get('getSearchIndex', 'Compact search index', 'Items, pool titles and model signals as flat records for client-side search. Kept pool entries are not repeated: the issue item carries them. Compact JSON.', 'SearchIndexResponse', ex.searchIndex),
    '/api/v1/search': {
      get: {
        operationId: 'search',
        summary: 'Ranked search',
        description: 'Case-insensitive word-prefix match over title, tags and text of the search index. Titles weigh most, then tags, then text; at least half of the query words must match; newer wins ties. Served by a Cloudflare Pages Function reading /api/v1/search-index.json of the same deployment. Cache-Control: ' + cache300 + '.',
        tags: ['knowledge base'],
        parameters: [
          { name: 'q', in: 'query', required: true, description: 'search words (max 200 chars)', schema: str({ minLength: 1, maxLength: 200 }), example: 'a2a' },
          { name: 'kind', in: 'query', required: false, schema: str({ enum: ['item', 'pool', 'signal'] }) },
          { name: 'tag', in: 'query', required: false, description: 'exact tag', schema: str() },
          { name: 'since', in: 'query', required: false, description: 'only records dated on or after this day', schema: DATE },
          { name: 'limit', in: 'query', required: false, description: 'default 10, values above 50 are capped to 50', schema: int({ minimum: 1, default: 10 }) },
        ],
        responses: {
          '200': jsonOk('SearchResponse', ex.search),
          '400': { description: 'bad parameter', content: { 'application/json': { schema: ref('Error') } } },
          '405': { description: 'method not allowed', content: { 'application/json': { schema: ref('Error') } } },
          '503': { description: 'search index unavailable', content: { 'application/json': { schema: ref('Error') } } },
        },
      },
    },
    '/mcp': {
      post: {
        operationId: 'mcpRpc',
        summary: 'MCP server (Streamable HTTP, stateless)',
        description: `JSON-RPC 2.0 over POST. Methods: initialize (protocolVersion 2025-03-26 or 2024-11-05), ping, tools/list, tools/call, notifications/* (answered 202). Tools: ${TOOLS.map((t) => t.name).join(', ')}. Each tool returns a short text summary and the same JSON the REST endpoints return. Batches are accepted. Read-only, no session.`,
        tags: ['mcp'],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' }, example: { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'search', arguments: { query: 'a2a', limit: 3 } } } } } },
        responses: { '200': { description: 'JSON-RPC response (result or error)' }, '202': { description: 'notification accepted, no body' }, '400': { description: 'parse error or invalid request' } },
      },
      get: { operationId: 'mcpCard', summary: 'MCP server card', tags: ['mcp'], responses: { '200': { description: 'short JSON card: endpoint, tools, protocol versions' } } },
    },
    '/.well-known/mcp.json': { get: { operationId: 'mcpServerCard', summary: 'MCP server card (static)', tags: ['mcp'], responses: { '200': { description: 'server card pointing at /mcp' } } } },
    '/openapi.json': { get: { operationId: 'getOpenApi', summary: 'This document', tags: ['site'], responses: { '200': { description: 'OpenAPI 3.1' } } } },
    '/llms.txt': { get: { operationId: 'getLlmsTxt', summary: 'Agent entry point', tags: ['site'], responses: { '200': { description: 'text/plain', content: { 'text/plain': { schema: str() } } } } } },
    '/llms-full.txt': { get: { operationId: 'getLlmsFull', summary: 'Every issue as markdown + the endpoint map', tags: ['site'], responses: { '200': { description: 'text/plain', content: { 'text/plain': { schema: str() } } } } } },
  };

  return {
    openapi: '3.1.0',
    info: {
      title: 'yaan knowledge base API',
      version: '1.0.0',
      summary: 'Public, read-only API over yaan, a daily AI veille.',
      description:
        'Static JSON generated at build time from the yaan archive (issues, candidate pools, model-market signals) plus two small functions: ranked search and a remote MCP server. No key, no cookie, no tracking, CORS *. Text is CC-BY-4.0, code is MIT; linked sources keep their own rights. Only public-safe sources are exported: lab and vendor feeds, GitHub trending, arXiv and lab pins, the OpenRouter catalog. Every record says where it came from (`source`) and how it got there (`status`); absent values are null, never invented.',
      license: { name: 'CC-BY-4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
    },
    servers: [{ url: ORIGIN }],
    tags: [{ name: 'knowledge base' }, { name: 'mcp' }, { name: 'site' }],
    paths,
    components: { schemas: schemas() },
    ...(kb.fixture ? { 'x-fixture': true } : {}),
  };
}
