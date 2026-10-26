// agentPrompt — the "give it to your agent" prompt (DESIGN.md §4, verbatim).
// the issue page, the agent view and llms.txt all call this. the url is always
// the dated .md, never latest.md.

import { site } from '../content/copy';

export function agentPrompt(date: string, issue: number): string {
  return [
    `read ${site.origin}/${date}.md once. it is issue ${issue} of yaan, a daily ai veille, as plain markdown with yaml frontmatter. don't open the html page or follow links unless i ask.`,
    ``,
    `using what you know about me, my work and my projects, tell me:`,
    `1. the one or two items worth my time, and why for me specifically, not in general`,
    `2. anything in tools i could install or try today, with the exact link or command from the issue`,
    `3. any date in timeline i should put in my calendar`,
    ``,
    `skip everything else. cite each item by number as ${site.origin}/${date}#{n}. if nothing in this issue matters to me, say so in one line. don't summarise the whole issue, and don't add anything that isn't in it.`,
  ].join('\n');
}
