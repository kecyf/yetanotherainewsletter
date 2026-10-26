// /llms.txt — the long positioning line and the agent prompt (DESIGN.md §6).
import type { APIRoute } from 'astro';
import { getIssues, getLatest } from '../lib/issues';
import { agentPrompt } from '../lib/prompt';
import { copy } from '../content/copy';

export const GET: APIRoute = () => {
  const latest = getLatest(getIssues());
  const prompt = agentPrompt(latest.date, latest.issue);
  const text = [
    `# ${copy.site.brand}`,
    '',
    copy.positioning.long,
    '',
    `## latest issue (${latest.date}, issue ${latest.issue})`,
    '',
    'give it to your agent:',
    '',
    '---',
    prompt,
    '---',
    '',
    '## endpoints',
    `- ${copy.site.origin}/latest.md — the latest issue as plain markdown`,
    `- ${copy.site.origin}/feed.json — json feed, one entry per issue`,
    `- ${copy.site.origin}/rss.xml — rss`,
    '',
  ].join('\n');
  return new Response(text, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
};
