// the markdown twin — toMarkdown is its only producer (DESIGN.md §6).
import type { APIRoute } from 'astro';
import { getIssues } from '../lib/issues';
import { toMarkdown } from '../lib/toMarkdown';

export function getStaticPaths() {
  return getIssues().map((e) => ({ params: { date: e.date }, props: { md: toMarkdown(e) } }));
}

export const GET: APIRoute = ({ props }) => {
  return new Response((props as { md: string }).md, {
    headers: { 'content-type': 'text/markdown; charset=utf-8' },
  });
};
