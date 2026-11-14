// /api/v1/issues/{date}.json: one full issue, structured. immutable once published.
import type { APIRoute } from 'astro';
import { API, envelope, getKb, issueFull, json } from '../../../../lib/kb';

export function getStaticPaths() {
  return getKb().issues.map((e) => ({ params: { date: e.date } }));
}

export const GET: APIRoute = ({ params }) => {
  const kb = getKb();
  const e = kb.issues.find((i) => i.date === params.date)!;
  return json(envelope(`${API}/issues/${e.date}.json`, issueFull(kb, e), e.assembled, { fixture: kb.fixture }));
};
