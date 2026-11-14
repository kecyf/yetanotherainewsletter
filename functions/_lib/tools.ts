// the five MCP tools: names, LLM-facing descriptions and JSON schemas. pure data, no runtime deps.
// shared by functions/mcp.ts (tools/list), /.well-known/mcp.json and /openapi.json.

export const SERVER = {
  name: 'yaan-kb',
  title: 'yaan knowledge base',
  version: '1.0.0',
  description:
    'Read-only access to yaan (yetanotherainewsletter.org), a daily AI veille: curated issues of what the labs shipped, the candidate pool the veille rail saw each day (kept, dropped with a reason, or unreviewed), and daily model-market signals (new models, expiring models, price moves, context changes) from the OpenRouter catalog. Public data, no key, CC-BY-4.0.',
  instructions:
    'Start with latest_issue for "what is new". Use search for any topic, tool, lab or model name. Use get_issue when you know the date, get_pool to see everything the rail saw on a day (including what the editor dropped and why), and list_model_signals for model launches, deprecations and price moves. Every result carries source urls: cite them; the text is CC-BY-4.0, linked sources keep their own rights.',
} as const;

const DATE = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', description: 'UTC date, YYYY-MM-DD' };

export const TOOLS = [
  {
    name: 'latest_issue',
    description:
      'Get the most recent published yaan issue in full: its subject line, intro, every kept item (title, source url, one-line "why it matters", section, tags), the dropped candidates with the editor\'s reasons, a note from the agent fleet and the run stats. Use this first when the user asks what is new, what happened in AI today or this week, or for the latest veille. No arguments. For a specific past day use get_issue; for a topic use search.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_issue',
    description:
      'Get one published yaan issue by its date (UTC, YYYY-MM-DD): kept items with source urls and why-notes, dropped items with reasons, fleet note, stats and the models used. Use when you already know the date. Days without an issue (skipped days) return an error that lists the dates that do exist.',
    inputSchema: { type: 'object', properties: { date: DATE }, required: ['date'], additionalProperties: false },
  },
  {
    name: 'search',
    description:
      'Full-text search over everything yaan knows: kept issue items, the daily candidate pool (every public lab/vendor/paper item the rail saw, kept or not) and model-market signals. Case-insensitive; titles weigh most, then tags, then text; newer wins ties. Use for any topic, product, lab, paper or model name ("A2A", "prompt caching", "Kimi K3.1"). Filter with kind (item = curated issue items, pool = rail candidates, signal = model signals), tag (exact tag such as arxiv, openai, security) and since (YYYY-MM-DD). Returns ranked hits with title, source url (null for signals), date, tags, snippet text and the api_url of the full record.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', minLength: 1, maxLength: 200, description: 'search words, e.g. "a2a routing" or "kimi price"' },
        kind: { type: 'string', enum: ['item', 'pool', 'signal'], description: 'restrict to curated items, pool candidates or model signals' },
        tag: { type: 'string', description: 'exact tag filter, e.g. "arxiv", "openai", "security"' },
        since: { ...DATE, description: 'only records dated on or after this UTC date' },
        limit: { type: 'integer', minimum: 1, maximum: 50, default: 10, description: 'max hits, default 10, capped at 50' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_model_signals',
    description:
      'List model-market signals from the daily OpenRouter catalog diff, newest first: type "new" (a model appeared), "expiring" (a deprecation date is near), "price" (prompt or completion price moved more than 10%, in USD per 1M tokens, from/to) and "context" (context window changed). Use for questions about new models, which models are being retired, or recent price changes. Filter by type and since (YYYY-MM-DD). Each signal has model_id, name, provider, typed details and the day it was seen. A model_id_basis of "derived" means the id is a stable slug built from provider and name, not a confirmed catalog id.',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['new', 'expiring', 'price', 'context'], description: 'only this signal type' },
        since: { ...DATE, description: 'only signals seen on or after this UTC date' },
        limit: { type: 'integer', minimum: 1, maximum: 200, default: 50, description: 'max signals, default 50, capped at 200' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_pool',
    description:
      'Get the candidate pool of one day (UTC, YYYY-MM-DD): every public-safe item the veille rail saw that day (lab and vendor posts, GitHub trending, arXiv papers), each with a status: "kept" (it made the issue, item_id says which), "dropped" (the editor cut it, reason says why) or "unreviewed". Use to see what else happened on a day, to audit what the editor cut, or to find items that did not make an issue. Days with no pool snapshot return an error that lists the available dates.',
    inputSchema: { type: 'object', properties: { date: DATE }, required: ['date'], additionalProperties: false },
  },
] as const;

export type ToolName = (typeof TOOLS)[number]['name'];

export const annotations = (title: string) => ({
  title,
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
});
