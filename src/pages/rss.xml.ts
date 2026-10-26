// /rss.xml — title is the subject, content is the toMarkdown output (DESIGN.md §6).
import type { APIRoute } from 'astro';
import { getIssues } from '../lib/issues';
import { toMarkdown } from '../lib/toMarkdown';
import { copy } from '../content/copy';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const GET: APIRoute = () => {
  const issues = getIssues();
  const items = issues
    .map((e) => {
      const url = `${copy.site.origin}/${e.date}`;
      return [
        '    <item>',
        `      <title>${esc(e.subject)}</title>`,
        `      <link>${url}</link>`,
        `      <guid isPermaLink="true">${url}</guid>`,
        `      <pubDate>${new Date(`${e.date}T06:00:00Z`).toUTCString()}</pubDate>`,
        `      <description>${esc(toMarkdown(e))}</description>`,
        '    </item>',
      ].join('\n');
    })
    .join('\n');
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${copy.site.brand}</title>
    <link>${copy.site.origin}</link>
    <description>${esc(copy.positioning.short)}</description>
    <language>en</language>
${items}
  </channel>
</rss>
`;
  return new Response(xml, {
    headers: { 'content-type': 'application/rss+xml; charset=utf-8' },
  });
};
