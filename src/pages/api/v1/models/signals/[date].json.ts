// /api/v1/models/signals/{date}.json: the signals of one day. `truncated` is set when the source
// digest listed fewer lines than its own header count (the watcher prints at most 12 per type).
import type { APIRoute } from 'astro';
import { API, envelope, getKb, json, signalDayData } from '../../../../../lib/kb';

export function getStaticPaths() {
  return getKb().signalDays.map((d) => ({ params: { date: d } }));
}

export const GET: APIRoute = ({ params }) => {
  const kb = getKb();
  const day = params.date as string;
  const { signals, truncated } = signalDayData(kb, day);
  return json(
    envelope(`${API}/models/signals/${day}.json`, signals, kb.dayStamp(day), {
      count: signals.length,
      fixture: kb.fixture,
      extra: { truncated },
    }),
  );
};
