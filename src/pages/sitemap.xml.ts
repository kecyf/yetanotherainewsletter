// /sitemap.xml — every public page: static pages plus one url per published issue (and its .md twin).
import type { APIRoute } from 'astro';
import { getIssues } from '../lib/issues';
import { copy } from '../content/copy';

export const GET: APIRoute = () => {
  const o = copy.site.origin;
  const issues = getIssues();
  const urls: { loc: string; lastmod?: string }[] = [
    { loc: `${o}/` },
    { loc: `${o}/about` },
    { loc: `${o}/archive` },
    { loc: `${o}/privacy` },
    { loc: `${o}/subscribe` },
    { loc: `${o}/llms.txt` },
    ...issues.flatMap((e) => [
      { loc: `${o}/${e.date}`, lastmod: e.date },
      { loc: `${o}/${e.date}.md`, lastmod: e.date },
    ]),
  ];
  const xml = `<?xml version="1.0" encoding="utf-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`)
    .join('\n')}\n</urlset>\n`;
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
};
