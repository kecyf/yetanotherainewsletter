// /api/v1/pool/{date}.json: the day's candidate pool, every public-safe item the rail saw, with its status.
import type { APIRoute } from 'astro';
import { API, envelope, getKb, json } from '../../../../lib/kb';

export function getStaticPaths() {
  return getKb().poolDays.map((d) => ({ params: { date: d } }));
}

export const GET: APIRoute = ({ params }) => {
  const kb = getKb();
  const day = params.date as string;
  const data = kb.poolByDay.get(day) ?? [];
  return json(envelope(`${API}/pool/${day}.json`, data, kb.dayStamp(day), { count: data.length, fixture: kb.fixture }));
};
