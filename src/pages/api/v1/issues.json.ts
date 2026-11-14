// /api/v1/issues.json: every issue, newest first.
import type { APIRoute } from 'astro';
import { API, envelope, getKb, issueSummary, json } from '../../../lib/kb';

export const GET: APIRoute = () => {
  const kb = getKb();
  const data = [...kb.issues].reverse().map(issueSummary);
  const stamp = kb.issues.length ? kb.issues[kb.issues.length - 1].assembled : kb.generatedAt;
  return json(envelope(`${API}/issues.json`, data, stamp, { count: data.length, fixture: kb.fixture }));
};
