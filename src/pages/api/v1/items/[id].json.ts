// /api/v1/items/{date}-{n}.json: one item. the id inside is "{date}#{n}"; the file name uses a dash.
import type { APIRoute } from 'astro';
import { API, envelope, getKb, itemFile, json } from '../../../../lib/kb';

export function getStaticPaths() {
  return getKb().items.map((it) => ({ params: { id: itemFile(it.issue, it.n) }, props: { item: it } }));
}

export const GET: APIRoute = ({ props }) => {
  const kb = getKb();
  const it = (props as { item: ReturnType<typeof getKb>['items'][number] }).item;
  return json(envelope(`${API}/items/${itemFile(it.issue, it.n)}.json`, it, kb.issueStamp(it.issue), { fixture: kb.fixture }));
};
