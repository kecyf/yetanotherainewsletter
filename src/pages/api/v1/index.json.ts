// /api/v1/index.json: the map. counts, latest issue, freshness per dataset, links to every resource.
import type { APIRoute } from 'astro';
import { API, envelope, getKb, indexData, json } from '../../../lib/kb';

export const GET: APIRoute = () => {
  const kb = getKb();
  return json(envelope(`${API}/index.json`, indexData(kb), kb.generatedAt, { fixture: kb.fixture }));
};
