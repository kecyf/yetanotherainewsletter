// /api/v1/items.json: every kept item ever, flattened, newest first. one fetch.
import type { APIRoute } from 'astro';
import { API, envelope, getKb, json } from '../../../lib/kb';

export const GET: APIRoute = () => {
  const kb = getKb();
  const stamp = kb.issues.length ? kb.issues[kb.issues.length - 1].assembled : kb.generatedAt;
  return json(envelope(`${API}/items.json`, kb.items, stamp, { count: kb.items.length, fixture: kb.fixture }));
};
