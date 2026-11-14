// /openapi.json: OpenAPI 3.1 for /api/v1, /api/v1/search and /mcp. examples are real records.
import type { APIRoute } from 'astro';
import { getKb, json } from '../lib/kb';
import { openapi } from '../lib/openapi';

export const GET: APIRoute = () => json(openapi(getKb()));
