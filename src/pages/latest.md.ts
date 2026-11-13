// /latest.md — byte-identical to the newest dated .md twin (DESIGN.md §6 check 2).
import type { APIRoute } from 'astro';
import { getIssues, getLatestOrNull } from '../lib/issues';
import { toMarkdown } from '../lib/toMarkdown';

export const GET: APIRoute = () => {
  const latest = getLatestOrNull(getIssues());
  const md = latest ? toMarkdown(latest) : 'no issue published yet. the first one is coming; see /llms.txt.\n';
  return new Response(md, {
    headers: { 'content-type': 'text/markdown; charset=utf-8' },
  });
};
