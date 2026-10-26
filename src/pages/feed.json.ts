// /feed.json — one entry per issue; content is the toMarkdown output (DESIGN.md §6).
import type { APIRoute } from 'astro';
import { getIssues } from '../lib/issues';
import { toMarkdown } from '../lib/toMarkdown';
import { copy } from '../content/copy';

export const GET: APIRoute = () => {
  const issues = getIssues();
  const feed = {
    version: 'https://jsonfeed.org/version/1.1',
    title: copy.site.brand,
    home_page_url: copy.site.origin,
    description: copy.positioning.short,
    items: issues.map((e) => ({
      id: `${copy.site.origin}/${e.date}`,
      url: `${copy.site.origin}/${e.date}`,
      title: e.subject,
      date_published: `${e.date}T06:00:00Z`,
      content_text: toMarkdown(e),
      url_md: `${copy.site.origin}/${e.date}.md`,
    })),
  };
  return new Response(JSON.stringify(feed, null, 2), {
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
};
