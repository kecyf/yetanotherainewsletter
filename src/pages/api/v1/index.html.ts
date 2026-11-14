// /api/v1/ : same document as /api/v1/index.json, emitted as index.html so the trailing-slash URL resolves on a static host (_headers pins the content type to json).
import type { APIRoute } from 'astro';
import { API, envelope, getKb, indexData, json } from '../../../lib/kb';

export const GET: APIRoute = () => {
  const kb = getKb();
  return json(envelope(`${API}/index.json`, indexData(kb), kb.generatedAt, { fixture: kb.fixture }));
};
