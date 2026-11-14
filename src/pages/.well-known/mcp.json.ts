// /.well-known/mcp.json: MCP server card for /mcp (static; the server itself is functions/mcp.ts).
import type { APIRoute } from 'astro';
import { LICENSE, getKb, json } from '../../lib/kb';
import { ORIGIN } from '../../lib/issues';
import { SERVER, TOOLS, annotations } from '../../../functions/_lib/tools';

export const GET: APIRoute = () => {
  const kb = getKb();
  return json({
    name: SERVER.name,
    title: SERVER.title,
    version: SERVER.version,
    description: SERVER.description,
    ...(kb.fixture ? { fixture: true } : {}),
    protocolVersions: ['2025-03-26', '2024-11-05'],
    transport: { type: 'streamable-http', stateless: true, url: `${ORIGIN}/mcp`, methods: ['POST', 'GET', 'OPTIONS'] },
    capabilities: { tools: { listChanged: false } },
    authentication: { required: false },
    instructions: SERVER.instructions,
    tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema, annotations: annotations(t.name) })),
    documentation: { openapi: `${ORIGIN}/openapi.json`, llms: `${ORIGIN}/llms.txt`, api: `${ORIGIN}/api/v1/` },
    license: LICENSE,
  });
};
