// /api/v1/tags.json: tag -> { items, pool } counts, most used first.
import type { APIRoute } from 'astro';
import { API, envelope, getKb, json } from '../../../lib/kb';

export const GET: APIRoute = () => {
  const kb = getKb();
  const rows = [...kb.tagCounts.entries()].sort(
    (a, b) => b[1].items + b[1].pool - (a[1].items + a[1].pool) || (a[0] < b[0] ? -1 : 1),
  );
  const data = Object.fromEntries(rows);
  return json(envelope(`${API}/tags.json`, data, kb.generatedAt, { count: rows.length, fixture: kb.fixture }));
};
