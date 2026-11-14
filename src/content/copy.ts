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
  short: 'a daily ai veille, and a public knowledge base your agent can query.',
  long: 'yaan is a daily ai veille and a public knowledge base your agent can query. every day a rail of agents polls lab and vendor sources and proposes items. one human keeps the ones that earn it, cuts the rest and says why; if fewer than three earn it, there is no issue that day. everything is public and read-only: each issue has a markdown twin, and the same record is served as json and through an mcp server, with no key, so your agent can fetch it and tell you what matters to you.',
};

export const hero = {
  line: 'a daily ai veille, and a public knowledge base your agent can query. assembled by agents, curated by a human.',
  // v1.2: the frame around the newest issue on the home page
  latestLabel: 'latest issue',
  notToday: 'there is no issue for today yet. this is the latest one.',
};

export const issueHeader = {
  // placeholders: {date} {weekday} {n} {m}
  micro: '{date} · {weekday} · issue {n} · {m} min',
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
  // v1.2: the kicker above the lead item, the accessible name of the item number
  leadKicker: 'lead',
  // {n}
  numberLabel: 'cite as #{n}',
  // v1.3: the colophon line that explains the chips (the lead is not always the first number)
  numbersNote: 'numbers are stable citation ids, not a ranking.',
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
  // live build while no sending relay is wired: the form is replaced by this notice.
  closed: 'there is no email list. email is on hold, no address is collected and nothing is sent. follow by rss or feed.json, or point your agent at the api.',
  nav: 'subscribe',
  compactPromise: 'one email on days with an issue. no tracking.',
  hiddenLabel: 'email address',
  placeholder: 'you@example.com',
  button: 'subscribe',
  h1: 'subscribe',
  promise: 'the issue in your inbox, only on days there is one. plain text-first email, no tracking pixels, no rewritten links, one-click unsubscribe. you can also follow by rss or feed.json without giving anyone an address.',
  invalid: 'that doesn\'t look like an email address.',
  pendingH1: 'check your inbox',
  pendingBody: 'a confirmation link is on its way. nothing arrives until you click it. if it isn\'t there in five minutes, check spam.',
  pendingTag: 'pending',
  confirmedH1: 'you\'re in',
  confirmedBody: 'the next issue lands on the day it ships.',
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
  // live build, no issue yet and no sender: no date promised, no email promised.
  homeLive: 'no issue yet. the first one is being assembled. follow by rss or feed.json, or point your agent at the api.',
  archiveLive: 'nothing here yet. the first issue has not been published.',
  home: 'no issue yet. the first one lands on {launch_date}.',
  archive: 'nothing here yet. the first issue lands on {launch_date}.',
};

export const fixtureNote = 'this issue is fixture data — a labelled stand-in for a brain record, not a real issue.';

export const nav = {
  label: 'site',
  archive: 'archive',
  api: 'api',
  about: 'about',
};

export const footer = {
  line1: {
    text: 'a daily ai veille',
    api: 'api',
    llmsTxt: 'llms.txt',
    openapi: 'openapi.json',
    rss: 'rss',
    feedJson: 'feed.json',
  },
  line2: 'text cc by 4.0 · code mit · items link to their sources, which keep their own rights',
  line3: 'no cookies, no tracking',
  privacy: 'privacy',
};

export const notFound = {
  h1: 'not found',
  body: 'no page and no api file lives at this address. the api index is at /api/v1/, the docs at /api.',
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
    { key: 'daily', value: 'the veille rail polls the lab and vendor sources and lands new items' },
    { key: 'then', value: 'an agent reads the pages, keeps what earns it and drafts the issue' },
    { key: 'last', value: 'the curator approves; the issue, its markdown twin, feed.json and rss ship together' },
  ],
  citing: 'citing yaan',
  citingBody: 'cite an item as yetanotherainewsletter.org/{date}#{n}. those urls never change. a published issue is never edited; corrections go in the next issue\'s intro.',
  doesntDo: 'what yaan doesn\'t do',
  doesntDoBody: 'no hype, no summaries of summaries, no "top 10" lists, no paywall, no tracking, no email list. items link to their sources; yaan doesn\'t repost their text.',
  forAgents: 'for agents',
  forAgentsBody: 'the whole record is public, read-only and keyless: markdown twins, a json api, an openapi spec, llms.txt and an mcp server. start at the api page.',
  forAgentsLink: 'api docs',
  changelog: 'model changelog',
};

export const privacy = {
  h1: 'privacy',
  whoRunsIt: 'who runs it',
  // {curator} {country}
  whoRunsItBody: 'yaan is run by {curator}, an individual, from {country}. it is not a company and has no investors or sponsors.',
  whatsStored: 'what\'s stored',
  whatsStoredBody: 'nothing about you. there are no accounts and no email list: no address is collected or stored. the api has no key and keeps no per-caller state.',
  whatsNot: 'what isn\'t',
  whatsNotBody: 'no cookies, no analytics, no fingerprinting, no tracking of what you read or ask the api. links go straight to the source.',
  email: 'email',
  emailBody: 'yaan sends none. the newsletter is on hold and no list exists. if that changes, this page will say which provider holds addresses before the first one is collected.',
  logs: 'logs',
  logsBody: 'the host keeps standard request logs (ip, path, query string, user agent) for up to 30 days for abuse and debugging. an api search query is part of the url, so it sits in those logs too. we don\'t read them for anything else.',
  license: 'license',
  licenseBody: 'issue text and the api data are cc by 4.0: quote, translate or feed them to an agent, with a link back. source titles and linked content belong to their owners. site code is mit.',
  contact: 'contact',
  contactBody: 'hello@yetanotherainewsletter.org. a human reads it.',
};

// v1.3: the quiet band on the home page, under the latest issue
export const band = {
  title: 'for your agent',
  descriptor: 'public, read-only, no key',
  body: 'every issue, kept item and day\'s candidate pool, as json and markdown. point your agent at one of these.',
  rows: [
    { label: '/api', note: 'the docs, for people and agents', href: '/api' },
    { label: '/llms.txt', note: 'the entry point for an agent', href: '/llms.txt' },
    { label: '/openapi.json', note: 'the openapi 3.1 spec', href: '/openapi.json' },
  ],
  mcpLabel: 'mcp server',
  mcpUrl: '{origin}/mcp',
  copyButton: 'copy',
  copied: 'copied',
  copyFailed: 'couldn\'t copy. select the text.',
};

// v1.3: the /api page. every path, command and prompt line is a string here; {origin} is replaced by site.origin.
// statements below follow docs/kb-api-v1.md, not what is deployed.
export const api = {
  h1: 'api',
  title: 'api · yaan',
  preface: 'the yaan knowledge base, public: every issue, every kept item, each day\'s candidate pool and the model-market signals, as json, markdown and an mcp server. read-only, no key, no signup.',
  agentCta: 'give it to your agent ↓',
  facts: [
    { key: 'access', value: 'public, read-only' },
    { key: 'key', value: 'none' },
    { key: 'methods', value: 'get; post on /mcp' },
    { key: 'cors', value: '*' },
    { key: 'format', value: 'json, one envelope' },
    { key: 'version', value: 'v1, in the path' },
    { key: 'license', value: 'cc by 4.0' },
    { key: 'caching', value: 'dated files immutable' },
  ],
  factsLabel: 'the api at a glance',
  baseLabel: 'base url',
  baseUrl: '{origin}',
  start: {
    name: 'quick start',
    descriptor: 'three things to paste',
    latest: {
      label: 'curl · the latest issue',
      text: '# as markdown\ncurl -s {origin}/latest.md\n\n# as json, newest first\ncurl -s {origin}/api/v1/issues.json',
    },
    search: {
      label: 'curl · search',
      text: 'curl -s \'{origin}/api/v1/search?q=context+window&limit=5\'',
    },
    mcp: {
      label: 'mcp client config',
      text: '{\n  "mcpServers": {\n    "yaan": { "url": "{origin}/mcp" }\n  }\n}',
    },
  },
  copyButton: 'copy',
  copied: 'copied',
  copyFailed: 'couldn\'t copy. select the text.',
  entryLabel: 'start here',
  entry: [
    { label: 'openapi.json', href: '/openapi.json' },
    { label: 'llms.txt', href: '/llms.txt' },
    { label: 'llms-full.txt', href: '/llms-full.txt' },
  ],
  endpoints: {
    name: 'endpoints',
    descriptor: 'all get, all json, all under the base url',
    // path = what is shown, example = a real url when the path has a placeholder
    rows: [
      { path: '/api/v1/', what: 'the map: every resource, counts, the latest issue, data freshness' },
      { path: '/api/v1/issues.json', what: 'every issue, newest first, with stats and its markdown and json urls' },
      { path: '/api/v1/issues/{date}.json', what: 'one issue in full: sections, items, dropped with reasons, fleet note, stats', example: '/api/v1/issues/2026-11-13.json' },
      { path: '/api/v1/items.json', what: 'every kept item ever, flattened, newest first' },
      { path: '/api/v1/items/{date}-{n}.json', what: 'one item', example: '/api/v1/items/2026-11-13-3.json' },
      { path: '/api/v1/pool/{date}.json', what: 'the day\'s candidate pool: every public item the rail saw, kept, dropped with a reason, or unreviewed', example: '/api/v1/pool/2026-11-13.json' },
      { path: '/api/v1/models/signals.json', what: 'the newest 200 model-market signals: new, expiring, price, context' },
      { path: '/api/v1/models/signals/{date}.json', what: 'the day\'s model signals', example: '/api/v1/models/signals/2026-11-13.json' },
      { path: '/api/v1/models/pareto.json', what: 'the latest quality by price table, or null' },
      { path: '/api/v1/tags.json', what: 'every tag with its counts' },
      { path: '/api/v1/search-index.json', what: 'a compact index over items, pool titles and signals, to search on your side' },
      { path: '/api/v1/search?q=', what: 'ranked search. also kind, tag, since, limit', example: '/api/v1/search?q=a2a&limit=3' },
    ],
  },
  files: {
    name: 'files',
    descriptor: 'markdown, feeds and entry points',
    rows: [
      { path: '/latest.md', what: 'the latest issue as markdown with yaml frontmatter' },
      { path: '/{date}.md', what: 'any issue as markdown; the twin of its page', example: '/2026-11-13.md' },
      { path: '/llms.txt', what: 'the entry point for an agent: what yaan is and where everything is' },
      { path: '/llms-full.txt', what: 'every issue as markdown plus the endpoint map, in one fetch' },
      { path: '/openapi.json', what: 'openapi 3.1 for the endpoints above and the search function' },
      { path: '/.well-known/mcp.json', what: 'the mcp server card' },
      { path: '/feed.json', what: 'json feed, one entry per issue' },
      { path: '/rss.xml', what: 'rss' },
    ],
  },
  mcp: {
    name: 'mcp',
    descriptor: 'a remote server, read-only, stateless',
    body: 'any mcp client that speaks streamable http can use the url below. each tool returns the same json as the matching endpoint, plus a short text summary.',
    urlLabel: 'server url',
    url: '{origin}/mcp',
    toolsLabel: 'tools',
    tools: [
      { path: 'latest_issue', what: 'the newest issue, structured' },
      { path: 'get_issue(date)', what: 'one issue by date' },
      { path: 'search(query, kind?, tag?, since?, limit?)', what: 'ranked search over items, pool titles and signals' },
      { path: 'list_model_signals(type?, since?, limit?)', what: 'new, expiring, price and context changes' },
      { path: 'get_pool(date)', what: 'the day\'s candidate pool' },
    ],
  },
  shapes: {
    name: 'shapes',
    descriptor: 'what every response looks like',
    body: 'every json file is wrapped in one envelope; lists add a count. absent values are null, never invented. dates are utc.',
    envelope: '{\n  "api": "yaan-kb",\n  "version": "1",\n  "generated_at": "<iso 8601, utc>",\n  "license": "CC-BY-4.0",\n  "self": "<this url>",\n  "data": "<the resource>"\n}',
    envelopeLabel: 'envelope, as a shape',
    rows: [
      { key: 'item id', value: '2026-11-13#3' },
      { key: 'pool id', value: 'p_ + first 12 hex of sha1(url)' },
      { key: 'signal id', value: '2026-11-13:new:{model_id}' },
    ],
  },
  agent: {
    title: 'give it to your agent',
    instruction: 'paste this into claude, chatgpt or any agent that can fetch a url. six lines, the whole api.',
    // numbered lines; the hanging indent in the block follows these numbers
    lines: [
      'read {origin}/llms.txt first: what yaan is, and where everything is.',
      'the api is public, read-only json, no key, under {origin}/api/v1/.',
      'the latest issue: {origin}/latest.md, or the first entry of {origin}/api/v1/issues.json.',
      'to look something up: {origin}/api/v1/search?q=<words>, optionally kind, tag, since, limit.',
      'if you speak mcp, use {origin}/mcp instead: latest_issue, get_issue, search, list_model_signals, get_pool.',
      'cite an item by its id, like 2026-11-13#3, with its issue_url. if the api has no answer, say so; don\'t guess.',
    ],
  },
  terms: {
    name: 'terms',
    descriptor: 'what you may do with it',
    rows: [
      { key: 'license', value: 'text and data cc by 4.0, code mit.' },
      { key: 'cite', value: 'cite an item by its id with a link to its issue_url.' },
      { key: 'sources', value: 'items link to their sources, which keep their own rights. no article text is served.' },
    ],
  },
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
  notFound,
  privacy,
  band,
  api,
};
