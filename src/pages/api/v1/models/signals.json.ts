// /api/v1/models/signals.json: the newest 200 model-market signals (OpenRouter catalog diff).
import type { APIRoute } from 'astro';
import { API, envelope, getKb, json } from '../../../../lib/kb';

const CAP = 200;

export const GET: APIRoute = () => {
  const kb = getKb();
  const data = kb.signalsNewest.slice(0, CAP);
  const stamp = kb.signalDays.length ? kb.dayStamp(kb.signalDays[kb.signalDays.length - 1]) : kb.generatedAt;
  return json(
    envelope(`${API}/models/signals.json`, data, stamp, {
      count: data.length,
      fixture: kb.fixture,
      extra: { total: kb.signalsNewest.length },
    }),
  );
};
