// /llms.txt — the long positioning line and the agent prompt (DESIGN.md §6).
import type { APIRoute } from 'astro';
import { getIssues, getLatestOrNull } from '../lib/issues';
import { API, getKb } from '../lib/kb';
import { agentPrompt } from '../lib/prompt';
import { copy } from '../content/copy';

// the public knowledge-base api (docs/kb-api-v1.md). no marker lines of three dashes here:
// the prompt block above is the only one the parity check reads.
function apiSection(): string[] {
  const kb = getKb();
  return [
    '',
    '## knowledge base api (v1)',
    '',
    'a public, read-only, keyless json api over the same archive: every issue, every kept item, the daily candidate pool (kept, dropped with a reason, or unreviewed) and daily model-market signals. static files, cors *, cc-by-4.0 for the text, mit for the code. linked sources keep their own rights.',
    '',
    `- ${API}/ — map, counts, freshness per dataset`,
    `- ${API}/issues.json — every issue, newest first`,
    `- ${API}/issues/{date}.json — one full issue, structured`,
    `- ${API}/items.json — every kept item, flattened (one fetch)`,
    `- ${API}/items/{date}-{n}.json — one item`,
    `- ${API}/pool/{date}.json — the day's candidate pool with status`,
    `- ${API}/models/signals.json — newest 200 model signals (new, expiring, price, context)`,
    `- ${API}/models/signals/{date}.json — one day of model signals`,
    `- ${API}/models/pareto.json — latest price x quality table (data: null when none)`,
    `- ${API}/tags.json — tag counts`,
    `- ${API}/search?q=... — ranked search (kind, tag, since, limit)`,
    `- ${API}/search-index.json — compact index for client-side search`,
    `- ${copy.site.origin}/openapi.json — openapi 3.1`,
    `- ${copy.site.origin}/llms-full.txt — every issue as markdown plus the endpoint map, one fetch`,
    `- ${copy.site.origin}/mcp — remote mcp server (streamable http, stateless; tools: latest_issue, get_issue, search, list_model_signals, get_pool)`,
    `- ${copy.site.origin}/.well-known/mcp.json — mcp server card`,
    '',
    kb.fixture ? 'note: this build carries fixture data.' : `data: ${kb.issues.length} issue(s), ${kb.items.length} item(s) as of ${kb.generatedAt}.`,
    'license: cc-by-4.0 (text), mit (code).',
    '',
  ];
}

export const GET: APIRoute = () => {
  const latest = getLatestOrNull(getIssues());
  const text = [
    `# ${copy.site.brand}`,
    '',
    copy.positioning.long,
    '',
    ...(latest
      ? [
          `## latest issue (${latest.date}, issue ${latest.issue})`,
          '',
          'give it to your agent:',
          '',
          '---',
          agentPrompt(latest.date, latest.issue),
          '---',
          '',
        ]
      : ['## latest issue', '', 'none yet. the first issue has not been published.', '']),
    '## endpoints',
    `- ${copy.site.origin}/latest.md — the latest issue as plain markdown`,
    `- ${copy.site.origin}/feed.json — json feed, one entry per issue`,
    `- ${copy.site.origin}/rss.xml — rss`,
    `- ${copy.site.origin}/sitemap.xml — every public page`,
    ...apiSection(),
  ].join('\n');
  return new Response(text, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
};
