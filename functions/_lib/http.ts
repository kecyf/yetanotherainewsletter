// shared by the two Pages Functions. no dependency, no state.
// the headers in public/_headers only reach static assets; function responses carry their own.

export type Env = { ASSETS: { fetch: (req: Request) => Promise<Response> } };
export type Ctx = { request: Request; env: Env };

export const API_VERSION = '1';
export const LICENSE = 'CC-BY-4.0';

export const CORS: Record<string, string> = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, HEAD, POST, OPTIONS',
  'access-control-allow-headers': 'content-type, accept, mcp-protocol-version, mcp-session-id, last-event-id',
  'access-control-expose-headers': 'content-type, cache-control',
  'access-control-max-age': '86400',
};

export function jsonResponse(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body) + '\n', {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'x-content-type-options': 'nosniff', ...CORS, ...extra },
  });
}

export function errorResponse(status: number, code: string, message: string, extra: Record<string, string> = {}): Response {
  return jsonResponse({ api: 'yaan-kb', version: API_VERSION, error: { status, code, message } }, status, {
    'cache-control': 'no-store',
    ...extra,
  });
}

export function optionsResponse(): Response {
  return new Response(null, { status: 204, headers: { ...CORS, 'cache-control': 'public, max-age=86400' } });
}

/** read a static JSON asset of this deployment through the ASSETS binding. */
export async function fetchAsset(ctx: Ctx, path: string): Promise<{ status: number; json: any | null }> {
  const url = new URL(path, ctx.request.url);
  const res = await ctx.env.ASSETS.fetch(new Request(url.toString(), { method: 'GET', headers: { accept: 'application/json' } }));
  if (!res.ok) return { status: res.status, json: null };
  try {
    return { status: 200, json: await res.json() };
  } catch {
    return { status: 502, json: null };
  }
}
