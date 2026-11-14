// GET /api/v1/search?q=&kind=&tag=&since=&limit=
// ranks over the static /api/v1/search-index.json of the same deployment (no state, no database).
import { API_VERSION, LICENSE, errorResponse, fetchAsset, jsonResponse, optionsResponse, type Ctx } from '../../_lib/http';
import { parseParams, rank, type IndexEntry } from '../../_lib/search';

let memo: { at: number; generated_at: string; entries: IndexEntry[] } | null = null;

async function loadIndex(ctx: Ctx) {
  if (memo && Date.now() - memo.at < 60_000) return memo;
  const r = await fetchAsset(ctx, '/api/v1/search-index.json');
  if (r.status !== 200 || !r.json || !Array.isArray(r.json.data)) return null;
  memo = { at: Date.now(), generated_at: r.json.generated_at, entries: r.json.data as IndexEntry[] };
  return memo;
}

export const onRequest = async (ctx: Ctx): Promise<Response> => {
  const m = ctx.request.method;
  if (m === 'OPTIONS') return optionsResponse();
  if (m !== 'GET' && m !== 'HEAD') return errorResponse(405, 'method_not_allowed', 'use GET', { allow: 'GET, HEAD, OPTIONS' });
  const url = new URL(ctx.request.url);
  const sp = url.searchParams;
  const parsed = parseParams({ q: sp.get('q'), kind: sp.get('kind'), tag: sp.get('tag'), since: sp.get('since'), limit: sp.get('limit') });
  if ('error' in parsed) return errorResponse(400, 'bad_request', parsed.error);
  const idx = await loadIndex(ctx);
  if (!idx) return errorResponse(503, 'index_unavailable', 'the search index could not be read; try /api/v1/search-index.json');
  const { total, hits } = rank(idx.entries, { ...parsed, origin: url.origin });
  const body = {
    api: 'yaan-kb',
    version: API_VERSION,
    generated_at: idx.generated_at,
    license: LICENSE,
    self: url.toString(),
    count: hits.length,
    total,
    query: { q: parsed.q, kind: parsed.kind, tag: parsed.tag, since: parsed.since, limit: parsed.limit },
    data: hits,
  };
  const res = jsonResponse(body, 200, { 'cache-control': 'public, max-age=300, stale-while-revalidate=3600' });
  return m === 'HEAD' ? new Response(null, { status: 200, headers: res.headers }) : res;
};
