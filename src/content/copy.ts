// every user-facing string in the product lives here (DESIGN.md §4).
// machine-flavoured labels (dates, provenance, the strip, the prompt, the
// agent view) stay in lower case; issue subjects are authored in sentence
// case (DESIGN.md §10.4) and render as authored — never via text-transform.
// nothing user-facing may live outside this file.

export const site = {
  brand: 'yaan',
  origin: 'https://yetanotherainewsletter.org',
  email: 'hello@yetanotherainewsletter.org',
  // stand-in values while the content pipeline is not wired (AGENTS.md scope).
  // the real launch date is a pipeline fact; this one belongs to the fixture.
  launchDate: '2026-10-25',
};

export const positioning = {
  short: 'a daily ai veille. agents assemble it, a human curates it, your agent can read it.',
  long: 'yaan is a daily ai veille: what the labs shipped, what moved the state of the art, which tools are worth installing, and which dates are coming. a fleet of agents reads a couple of hundred sources overnight and proposes items. one human keeps the ones that earn it, cuts the rest and says why. if fewer than three items earn it, there is no issue that day. every issue has a markdown twin, so your agent can read it in one fetch and tell you what matters to you.',
};

export const hero = {
  line: 'yet another ai newsletter. assembled by agents, curated by a human, readable by your agent in one fetch.',
  notToday: 'today\'s issue lands around 06:00 utc. this is the latest one.',
};

export const issueHeader = {
  // placeholders: {date} {weekday} {n} {m}
  micro: '{date} · {weekday} · issue {n} · {m} min · ',
  agentCta: 'give it to your agent ↓',
  title: '{subject} · yaan {n}',
};

export const strip = {
  sources: 'sources',
  read: 'read',
  proposed: 'proposed',
  dropped: 'dropped',
  byHand: 'by hand',
  kept: 'kept',
  models: 'models',
  assembled: 'assembled',
  curator: 'curator',
  ariaLabel: 'how this issue was made',
};

export const sections = {
  labs: { name: 'labs', descriptor: 'what the labs shipped or said' },
  sota: { name: 'sota', descriptor: 'results that moved a number' },
  tools: { name: 'tools', descriptor: 'things you can install today' },
  timeline: { name: 'timeline', descriptor: 'dates worth writing down' },
  signal: { name: 'signal', descriptor: 'one thing the curator thinks is underpriced' },
  fleet: { name: 'from the fleet', descriptor: 'a note from an agent that built this issue' },
};

export const item = {
  addedByHand: 'added by hand',
};

export const agentBlock = {
  title: 'give it to your agent',
  instruction: 'paste this into claude, chatgpt or any agent that can fetch a url. it reads the markdown twin, not this page.',
  copyButton: 'copy prompt',
  copied: 'copied',
  copyFailed: 'couldn\'t copy. select the text above.',
  viewAsMarkdown: 'view as markdown',
  // agent view
  agentViewTitle: '{date}, for your agent',
  endpoints: {
    thisIssue: 'this issue',
    latest: 'latest',
    rss: 'rss',
    feedJson: 'feed.json',
    llmsTxt: 'llms.txt',
  },
};

export const fleetNote = {
  // signature line is built from the entry: — {agent} · {model}
};

export const signoff = {
  suffix: '— {curator}, for the fleet',
};

export const droppedList = {
  // {count}
  summary: 'dropped · {count} · proposed by the fleet, cut by the curator',
};

export const subscribe = {
  nav: 'subscribe',
  compactPromise: 'one email on days with an issue, around 06:00 utc. no tracking.',
  hiddenLabel: 'email address',
  placeholder: 'you@example.com',
  button: 'subscribe',
  h1: 'subscribe',
  promise: 'the issue in your inbox around 06:00 utc, only on days there is one. plain text-first email, no tracking pixels, no rewritten links, one-click unsubscribe. you can also follow by rss or feed.json without giving anyone an address.',
  invalid: 'that doesn\'t look like an email address.',
  pendingH1: 'check your inbox',
  pendingBody: 'a confirmation link is on its way. nothing arrives until you click it. if it isn\'t there in five minutes, check spam.',
  pendingTag: 'pending',
  confirmedH1: 'you\'re in',
  confirmedBody: 'the next issue lands around 06:00 utc.',
  confirmedReadLatest: 'read the latest',
  confirmedBrowseArchive: 'browse the archive',
  confirmedTag: 'confirmed',
  already: 'that address is already subscribed. nothing changed.',
  error: 'the email service didn\'t answer, so nothing was saved. try again later, or follow by rss or feed.json, which don\'t need an address.',
  errorTag: 'error',
  bye: 'unsubscribed. no more email. the site and the .md twins stay open.',
};

export const archive = {
  h1: 'archive',
  // {issues} {skipped} {firstDate}
  count: '{issues} issues · {skipped} skipped days · since {firstDate}',
  // {kept}
  rowMicro: '{kept} items · .md',
  skippedTag: 'skipped',
};

export const skippedPage = {
  // {date}
  h1: 'no issue on {date}',
  // {proposed} {kept}
  body: 'the fleet proposed {proposed} items and {kept} earned a place. the rule is three or nothing, so there was no issue.',
  prev: '← {date}',
  next: '{date} →',
};

export const empty = {
  home: 'no issue yet. the first one lands around 06:00 utc on {launch_date}. subscribe and it\'ll be the first email you get.',
  archive: 'nothing here yet. the first issue lands on {launch_date}.',
};

export const fixtureNote = 'this issue is fixture data — a labelled stand-in for a brain record, not a real issue.';

export const nav = {
  archive: 'archive',
  about: 'about',
  subscribe: 'subscribe',
};

export const footer = {
  line1: {
    text: 'a daily ai veille',
    rss: 'rss',
    feedJson: 'feed.json',
    llmsTxt: 'llms.txt',
    latestMd: 'latest.md',
  },
  line2: 'text cc by 4.0 · code mit · items link to their sources, which keep their own rights',
  line3: 'no cookies, no tracking',
  privacy: 'privacy',
};

export const about = {
  h1: 'about',
  whatThisIs: 'what this is',
  theFleet: 'the fleet',
  theHuman: 'the human',
  theHumanBody: 'every item is read by the curator before it ships: kept if it earns attention, cut if it doesn\'t, always with a reason in the dropped list. the agents propose; they never publish.',
  theRule: 'the rule',
  theRuleBody: 'three items or nothing: if fewer than three earn a place, there is no issue that day. every issue stays under 600 words, so it can be read, not skimmed.',
  thePipeline: 'the pipeline',
  pipelineRows: [
    { key: 'overnight utc', value: 'the scouts read the source pool and propose items' },
    { key: '05:40 utc', value: 'dedupe and draft assemble the proposal' },
    { key: '06:00 utc', value: 'the curator publishes the issue, its markdown twin, feed.json and rss together' },
  ],
  citing: 'citing yaan',
  citingBody: 'cite an item as yetanotherainewsletter.org/{date}#{n}. those urls never change. issues are never edited after 12:00 utc on their day; corrections go in the next issue\'s intro.',
  doesntDo: 'what yaan doesn\'t do',
  doesntDoBody: 'no hype, no summaries of summaries, no "top 10" lists, no paywall, no tracking. items link to their sources; yaan doesn\'t repost their text.',
  changelog: 'model changelog',
};

export const privacy = {
  h1: 'privacy',
  whoRunsIt: 'who runs it',
  // {curator} {country}
  whoRunsItBody: 'yaan is run by {curator}, an individual, from {country}. it is not a company and has no investors or sponsors.',
  whatsStored: 'what\'s stored',
  whatsStoredBody: 'if you subscribe: your email address and the date you confirmed, kept in our own database. no tracking pixels, no third-party analytics. the sending relay that will deliver issues is not chosen yet; it will be named here before any issue is sent.',
  whatsNot: 'what isn\'t',
  whatsNotBody: 'no cookies, no analytics, no fingerprinting, no open or click tracking. links in the email go straight to the source.',
  email: 'email',
  emailBody: 'one email on days with an issue. unsubscribe with the link in any email; your address is deleted, not archived.',
  logs: 'logs',
  logsBody: 'the host keeps standard request logs (ip, path, user agent) for up to 30 days for abuse and debugging. we don\'t read them for anything else.',
  license: 'license',
  licenseBody: 'issue text is cc by 4.0: quote, translate or feed it to an agent, with a link back. source titles and linked content belong to their owners. site code is mit.',
  contact: 'contact',
  contactBody: 'hello@yetanotherainewsletter.org. a human reads it.',
};

// the single import surface used by components and routes: `import { copy } from '../content/copy'`
export const copy = {
  site,
  positioning,
  hero,
  issueHeader,
  strip,
  sections,
  item,
  agentBlock,
  fleetNote,
  signoff,
  droppedList,
  subscribe,
  archive,
  skippedPage,
  empty,
  fixtureNote,
  nav,
  footer,
  about,
  privacy,
};
