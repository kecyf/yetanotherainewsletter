// /api/v1/models/pareto.json: the latest price x quality Pareto table, or data: null (never a 404).
import type { APIRoute } from 'astro';
import { API, envelope, getKb, json } from '../../../../lib/kb';

export const GET: APIRoute = () => {
  const kb = getKb();
  return json(
    envelope(`${API}/models/pareto.json`, kb.pareto, kb.pareto ? kb.dayStamp(kb.pareto.date) : kb.generatedAt, {
      fixture: kb.fixture,
    }),
  );
};
