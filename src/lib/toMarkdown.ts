// toMarkdown — the ONLY producer of the .md twins (DESIGN.md §6).
// the agent view, rss and feed.json call this; they never re-derive.

import type { IssueEntry } from '../content/schema';
import { domainOf } from './url';

function provLine(n: number, url: string, agent: string, hand: boolean): string {
  const base = `${n} · ${domainOf(url)} · ${agent}`;
  return hand ? `${base} · added by hand` : base;
}

export function toMarkdown(e: IssueEntry): string {
  const parts: string[] = [];

  // frontmatter — the fixed shape is the parity contract
  parts.push('---');
  parts.push(`title: "${e.subject}"`);
  parts.push(`date: ${e.date}`);
  parts.push(`issue: ${e.issue}`);
  parts.push(`url: https://yetanotherainewsletter.org/${e.date}`);
  parts.push(`curator: ${e.curator}`);
  parts.push(`assembled: ${e.assembled}`);
  parts.push(
    `stats: {sources: ${e.stats.sources}, read: ${e.stats.read}, proposed: ${e.stats.proposed}, dropped: ${e.stats.dropped}, hand: ${e.stats.hand}, kept: ${e.stats.kept}}`,
  );
  parts.push(`models: [${e.models.map((m) => `"${m}"`).join(', ')}]`);
  parts.push(`prev: ${e.prev ?? 'null'}`);
  parts.push(`next: ${e.next ?? 'null'}`);
  parts.push('---');

  parts.push('');
  parts.push(`# ${e.subject}`);
  parts.push('');
  parts.push(e.intro);

  // item sections, fixed order, numbering is the issue-wide n
  for (const s of e.sections) {
    parts.push('');
    parts.push(`## ${s.name}`);
    for (const it of s.items) {
      parts.push('');
      parts.push(`### ${it.n}. [${it.title}](${it.url})`);
      parts.push('');
      parts.push(it.why);
      parts.push('');
      parts.push(`\`${provLine(it.n, it.url, it.agent, it.hand ?? false)}\``);
    }
  }

  if (e.signal) {
    parts.push('');
    parts.push('## signal');
    parts.push('');
    parts.push(`> ${e.signal.text}`);
    parts.push('>');
    parts.push(`> — ${e.curator}`);
  }

  parts.push('');
  parts.push('## from the fleet');
  parts.push('');
  parts.push(`> ${e.fleet.text}`);
  parts.push('>');
  parts.push(`> — ${e.fleet.agent} · ${e.fleet.model}`);

  parts.push('');
  parts.push(e.signoff.text);
  parts.push('');
  parts.push(`— ${e.curator}, for the fleet`);

  if (e.dropped.length > 0) {
    parts.push('');
    parts.push('## dropped');
    for (const d of e.dropped) {
      parts.push(`- [${d.title}](${d.url}) · ${d.agent} · ${d.reason}`);
    }
  }

  parts.push('');
  return parts.join('\n');
}
