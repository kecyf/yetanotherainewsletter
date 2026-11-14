// /mcp: remote MCP server, Streamable HTTP transport, stateless, JSON-RPC 2.0, no dependency.
//   POST  initialize | ping | tools/list | tools/call | notifications/* (202) | batches
//   GET   a short JSON card (this server has no server-initiated stream)
//   OPTIONS  CORS preflight
// every tool reads the same static JSON the REST API serves (ASSETS binding) and returns it with a text summary.
import { CORS, API_VERSION, LICENSE, errorResponse, fetchAsset, jsonResponse, optionsResponse, type Ctx } from './_lib/http';
import { parseParams, rank, type IndexEntry } from './_lib/search';
import { SERVER, TOOLS, annotations } from './_lib/tools';

const SUPPORTED = ['2025-03-26', '2024-11-05'];
const LATEST = SUPPORTED[0];
const MAX_BODY = 64 * 1024;

type Rpc = { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: any; result?: unknown; error?: unknown };
type Out = { jsonrpc: '2.0'; id: string | number | null; result?: unknown; error?: { code: number; message: string; data?: unknown } };

const ok = (id: Out['id'], result: unknown): Out => ({ jsonrpc: '2.0', id, result });
const err = (id: Out['id'], code: number, message: string, data?: unknown): Out => ({
  jsonrpc: '2.0',
  id,
  error: { code, message, ...(data !== undefined ? { data } : {}) },
});

const card = (origin: string) => ({
  name: SERVER.name,
  title: SERVER.title,
  version: SERVER.version,
  description: SERVER.description,
  transport: 'streamable-http (stateless, POST JSON-RPC 2.0)',
  endpoint: `${origin}/mcp`,
  protocol_versions: SUPPORTED,
  tools: TOOLS.map((t) => t.name),
  server_card: `${origin}/.well-known/mcp.json`,
  openapi: `${origin}/openapi.json`,
  license: LICENSE,
  usage: 'POST a JSON-RPC 2.0 request with content-type application/json, e.g. {"jsonrpc":"2.0","id":1,"method":"tools/list"}',
});

// ---------------------------------------------------------------------------- tools

type ToolResult = { isError?: boolean; summary: string; payload: unknown };

const fail = (summary: string, payload: unknown = null): ToolResult => ({ isError: true, summary, payload });

async function availableDates(ctx: Ctx, key: 'issues' | 'pool'): Promise<string[]> {
  if (key === 'issues') {
    const r = await fetchAsset(ctx, '/api/v1/issues.json');
    return (r.json?.data ?? []).map((i: any) => i.date);
  }
  const r = await fetchAsset(ctx, '/api/v1/index.json');
  return r.json?.data?.datasets?.pool?.days ?? [];
}

function issueSummaryText(env: any): string {
  const e = env.data;
  const items: any[] = e.sections.flatMap((s: any) => s.items);
  const lines = items.map((i) => `  ${e.date}#${i.n} [${i.section}] ${i.title} (${i.source_domain}) ${i.url}`);
  return `yaan issue ${e.issue} of ${e.date}: "${e.title}". ${items.length} kept items, ${e.dropped.length} dropped.\n${lines.join('\n')}`;
}

async function callTool(ctx: Ctx, name: string, a: Record<string, any>): Promise<ToolResult> {
  const origin = new URL(ctx.request.url).origin;
  switch (name) {
    case 'latest_issue': {
      const list = await fetchAsset(ctx, '/api/v1/issues.json');
      const latest = list.json?.data?.[0];
      if (!latest) return fail('No issue has been published yet.');
      const r = await fetchAsset(ctx, `/api/v1/issues/${latest.date}.json`);
      if (!r.json) return fail(`Could not read the latest issue (${latest.date}).`);
      return { summary: issueSummaryText(r.json), payload: r.json };
    }
    case 'get_issue': {
      const date = a.date;
      if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new RpcError(-32602, 'date must be a string like 2026-11-13');
      const r = await fetchAsset(ctx, `/api/v1/issues/${date}.json`);
      if (!r.json) {
        const dates = await availableDates(ctx, 'issues');
        return fail(`No issue for ${date}. Dates with an issue: ${dates.join(', ') || 'none yet'}.`, { available_dates: dates });
      }
      return { summary: issueSummaryText(r.json), payload: r.json };
    }
    case 'search': {
      const p = parseParams({ q: a.query, kind: a.kind, tag: a.tag, since: a.since, limit: a.limit });
      if ('error' in p) throw new RpcError(-32602, p.error.replace(/^q is required/, 'query is required'));
      const idx = await fetchAsset(ctx, '/api/v1/search-index.json');
      if (!idx.json) return fail('The search index is unavailable.');
      const { total, hits } = rank(idx.json.data as IndexEntry[], { ...p, origin });
      const payload = {
        api: 'yaan-kb', version: API_VERSION, generated_at: idx.json.generated_at, license: LICENSE,
        self: `${origin}/api/v1/search?q=${encodeURIComponent(p.q)}`, count: hits.length, total,
        query: { q: p.q, kind: p.kind, tag: p.tag, since: p.since, limit: p.limit }, data: hits,
      };
      const lines = hits.map((h) => `  ${h.date} [${h.kind}] ${h.title}${h.url ? ` ${h.url}` : ''} (${h.id})`);
      return { summary: `${hits.length} of ${total} matches for "${p.q}"${hits.length ? ':\n' + lines.join('\n') : '.'}`, payload };
    }
    case 'list_model_signals': {
      const type = a.type;
      if (type !== undefined && !['new', 'expiring', 'price', 'context'].includes(type)) throw new RpcError(-32602, 'type must be one of: new, expiring, price, context');
      const since = a.since;
      if (since !== undefined && (typeof since !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(since))) throw new RpcError(-32602, 'since must be a date like 2026-11-01');
      let limit = 50;
      if (a.limit !== undefined) {
        if (!Number.isInteger(a.limit) || a.limit < 1) throw new RpcError(-32602, 'limit must be an integer between 1 and 200');
        limit = Math.min(a.limit, 200);
      }
      const r = await fetchAsset(ctx, '/api/v1/models/signals.json');
      if (!r.json) return fail('Model signals are unavailable.');
      let data: any[] = r.json.data;
      if (type) data = data.filter((s) => s.type === type);
      if (since) data = data.filter((s) => s.date >= since);
      const total = data.length;
      data = data.slice(0, limit);
      const payload = { ...r.json, self: `${origin}/api/v1/models/signals.json`, count: data.length, total_matching: total, data };
      const lines = data.slice(0, 40).map((s) => `  ${s.date} ${s.type} ${s.model_id}`);
      return { summary: `${data.length} of ${total} model signals${type ? ` of type ${type}` : ''}${since ? ` since ${since}` : ''}:\n${lines.join('\n')}`, payload };
    }
    case 'get_pool': {
      const date = a.date;
      if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new RpcError(-32602, 'date must be a string like 2026-11-13');
      const r = await fetchAsset(ctx, `/api/v1/pool/${date}.json`);
      if (!r.json) {
        const dates = await availableDates(ctx, 'pool');
        return fail(`No pool snapshot for ${date}. Dates with a pool: ${dates.join(', ') || 'none yet'}.`, { available_dates: dates });
      }
      const rows: any[] = r.json.data;
      const by: Record<string, number> = { kept: 0, dropped: 0, unreviewed: 0 };
      for (const e of rows) by[e.status] = (by[e.status] ?? 0) + 1;
      const lines = rows.map((e) => `  [${e.status}] ${e.title} ${e.url}${e.reason ? ` (dropped: ${e.reason})` : ''}`);
      return { summary: `pool of ${date}: ${rows.length} entries (${by.kept} kept, ${by.dropped} dropped, ${by.unreviewed} unreviewed).\n${lines.join('\n')}`, payload: r.json };
    }
    default:
      throw new RpcError(-32602, `Unknown tool: ${name}`);
  }
}

class RpcError extends Error {
  constructor(public code: number, message: string) {
    super(message);
  }
}

// ---------------------------------------------------------------------------- dispatch

async function handle(ctx: Ctx, m: Rpc): Promise<Out | null> {
  const hasId = Object.prototype.hasOwnProperty.call(m, 'id');
  const id = (hasId ? m.id : null) as Out['id'];
  if (m.jsonrpc !== '2.0' || typeof m.method !== 'string' || (hasId && typeof id !== 'string' && typeof id !== 'number')) {
    // a response object sent by the client carries no method: nothing to do
    if (m && typeof m === 'object' && m.method === undefined && ('result' in m || 'error' in m)) return null;
    return err(hasId && (typeof id === 'string' || typeof id === 'number') ? id : null, -32600, 'Invalid Request: expected {"jsonrpc":"2.0","method":string,"id"?:string|number}');
  }
  if (!hasId) return null; // notification (notifications/initialized, notifications/cancelled, ...)
  try {
    switch (m.method) {
      case 'initialize': {
        const want = m.params?.protocolVersion;
        const protocolVersion = typeof want === 'string' && SUPPORTED.includes(want) ? want : LATEST;
        return ok(id, {
          protocolVersion,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: SERVER.name, version: SERVER.version },
          instructions: SERVER.instructions,
        });
      }
      case 'ping':
        return ok(id, {});
      case 'tools/list':
        return ok(id, { tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema, annotations: annotations(t.name) })) });
      case 'tools/call': {
        const name = m.params?.name;
        if (typeof name !== 'string') return err(id, -32602, 'Invalid params: name (string) is required');
        const args = m.params?.arguments ?? {};
        if (typeof args !== 'object' || Array.isArray(args) || args === null) return err(id, -32602, 'Invalid params: arguments must be an object');
        const r = await callTool(ctx, name, args as Record<string, any>);
        return ok(id, {
          content: [
            { type: 'text', text: r.summary },
            { type: 'text', text: JSON.stringify(r.payload) },
          ],
          ...(r.isError ? { isError: true } : {}),
        });
      }
      default:
        return err(id, -32601, `Method not found: ${m.method}`);
    }
  } catch (e) {
    if (e instanceof RpcError) return err(id, e.code, e.message);
    return err(id, -32603, 'Internal error');
  }
}

export const onRequest = async (ctx: Ctx): Promise<Response> => {
  const method = ctx.request.method;
  const origin = new URL(ctx.request.url).origin;
  if (method === 'OPTIONS') return optionsResponse();
  if (method === 'GET' || method === 'HEAD') {
    const res = jsonResponse(card(origin), 200, { 'cache-control': 'public, max-age=300, stale-while-revalidate=3600' });
    return method === 'HEAD' ? new Response(null, { status: 200, headers: res.headers }) : res;
  }
  if (method !== 'POST') return errorResponse(405, 'method_not_allowed', 'use POST (JSON-RPC), GET (card) or OPTIONS', { allow: 'GET, HEAD, POST, OPTIONS' });

  const raw = await ctx.request.text();
  if (raw.length > MAX_BODY) return jsonResponse(err(null, -32600, 'Request too large'), 413, { 'cache-control': 'no-store' });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return jsonResponse(err(null, -32700, 'Parse error: body is not valid JSON'), 400, { 'cache-control': 'no-store' });
  }
  const noStore = { 'cache-control': 'no-store' };
  if (Array.isArray(body)) {
    if (body.length === 0) return jsonResponse(err(null, -32600, 'Invalid Request: empty batch'), 400, noStore);
    const outs = (await Promise.all(body.map((m) => (m && typeof m === 'object' ? handle(ctx, m as Rpc) : Promise.resolve(err(null, -32600, 'Invalid Request'))))))
      .filter((o): o is Out => o !== null);
    return outs.length ? jsonResponse(outs, 200, noStore) : new Response(null, { status: 202, headers: CORS });
  }
  if (!body || typeof body !== 'object') return jsonResponse(err(null, -32600, 'Invalid Request: expected a JSON object'), 400, noStore);
  const out = await handle(ctx, body as Rpc);
  if (out === null) return new Response(null, { status: 202, headers: CORS });
  return jsonResponse(out, out.error && out.id === null && out.error.code === -32600 ? 400 : 200, noStore);
};
