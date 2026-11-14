// /api/v1/search-index.json: compact index over items, pool titles and model signals (no pretty print).
import type { APIRoute } from 'astro';
import { API, envelope, getKb, json, searchIndex } from '../../../lib/kb';

export const GET: APIRoute = () => {
  const kb = getKb();
  const data = searchIndex(kb);
  return json(envelope(`${API}/search-index.json`, data, kb.generatedAt, { count: data.length, fixture: kb.fixture }), false);
};
