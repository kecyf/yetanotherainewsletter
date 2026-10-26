// /latest.md — byte-identical to the newest dated .md twin (DESIGN.md §6 check 2).
import type { APIRoute } from 'astro';
import { getIssues, getLatest } from '../lib/issues';
import { toMarkdown } from '../lib/toMarkdown';

export const GET: APIRoute = () => {
  const md = toMarkdown(getLatest(getIssues()));
  return new Response(md, {
    headers: { 'content-type': 'text/markdown; charset=utf-8' },
  });
};
