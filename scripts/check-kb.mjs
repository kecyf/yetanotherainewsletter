#!/usr/bin/env node
// yaan KB API checks (docs/kb-api-v1.md). validates every generated api file in a built dist against
// the shapes of the OpenAPI spec that the same build emitted (so the spec is machine-checked), then
// applies the public-safe rule and the integrity rules on top.
//
//   node scripts/check-kb.mjs [dist]       validate dist (fixture builds are allowed: envelope carries fixture: true)
//   node scripts/check-kb.mjs --build-live build the live data (YAAN_DATA_DIR=src/data-live) into
//                                          node_modules/.cache/yaan-kb-live and validate it as production:
//                                          no fixture flag anywhere, counts equal the committed snapshots
//
// public-safe rule (fails the build): unknown source; x-bookmark | notion | manual* | github-stars as a source or tag;
// brain uuid-looking ids; pin slugs (pin-...); internal paths or hosts; internal workflow tags; non-https item urls.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const args = process.argv.slice(2);
const buildLive = args.includes('--build-live');
const LIVE_OUT = path.join(ROOT, 'node_modules/.cache/yaan-kb-live');
const DIST = buildLive ? LIVE_OUT : path.resolve(ROOT, args.find((a) => !a.startsWith('--')) ?? 'dist');
const ORIGIN = 'https://yetanotherainewsletter.org';

const failures = [];
let checks = 0;
const ok = (name) => console.log(`  ok   ${name}`);
const bad = (name, details) => {
  failures.push(name);
  console.error(`  FAIL ${name}`);
  for (const d of [].concat(details).slice(0, 12)) console.error(`       ${d}`);
  if ([].concat(details).length > 12) console.error(`       ... ${[].concat(details).length - 12} more`);
};
const section = (t) => console.log(`\n${t}`);
const read = (p) => fs.readFileSync(p, 'utf8');
const readJson = (p) => JSON.parse(read(p));

if (buildLive) {
  const dates = [];
  const live = path.join(ROOT, 'src/data-live');
  for (const f of fs.readdirSync(path.join(live, 'issues'))) if (/^\d{4}-\d{2}-\d{2}\.json$/.test(f)) dates.push(f.slice(0, 10));
  dates.push(...Object.keys(readJson(path.join(live, 'skipped.json')).days));
  const today = dates.sort().pop();
  console.log(`[kb] live build into ${path.relative(ROOT, LIVE_OUT)} (YAAN_TODAY=${today})`);
  fs.rmSync(LIVE_OUT, { recursive: true, force: true });
  const r = spawnSync(path.join(ROOT, 'node_modules/.bin/astro'), ['build', '--outDir', LIVE_OUT], {
    cwd: ROOT,
    env: { ...process.env, YAAN_LIVE: '1', YAAN_DATA_DIR: 'src/data-live', YAAN_TODAY: today },
    encoding: 'utf8',
  });
  if (r.status !== 0) {
    console.error(r.stdout?.slice(-3000), r.stderr?.slice(-3000));
    console.error('FAIL live build');
    process.exit(1);
  }
}
if (!fs.existsSync(path.join(DIST, 'api/v1/index.json'))) {
  console.error(`no api in ${DIST}: build first`);
  process.exit(1);
}
console.log(`[kb] checking ${path.relative(ROOT, DIST) || '.'}${buildLive ? ' (production rules)' : ''}`);

// ---------------------------------------------------------------- a small JSON Schema validator (the subset the spec uses)
function validate(schema, value, spec, at = '$') {
  const errs = [];
  const go = (s, v, p) => {
    if (s.$ref) return go(resolve(spec, s.$ref), v, p);
    if (s.oneOf) {
      const n = s.oneOf.filter((alt) => validate(alt, v, spec, p).length === 0).length;
      if (n !== 1) errs.push(`${p}: matches ${n} of ${s.oneOf.length} oneOf alternatives`);
      return;
    }
    if ('const' in s && v !== s.const) return errs.push(`${p}: expected const ${JSON.stringify(s.const)}, got ${JSON.stringify(v)}`);
    if (s.enum && !s.enum.includes(v)) return errs.push(`${p}: ${JSON.stringify(v)} not in enum ${JSON.stringify(s.enum)}`);
    if (s.type) {
      const types = [].concat(s.type);
      const t = v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v;
      const okType = types.some((x) => x === t || (x === 'number' && t === 'integer'));
      if (!okType) return errs.push(`${p}: expected ${types.join('|')}, got ${t}`);
    }
    if (typeof v === 'string') {
      if (s.pattern && !new RegExp(s.pattern).test(v)) errs.push(`${p}: ${JSON.stringify(v.slice(0, 60))} does not match ${s.pattern}`);
      if (s.minLength && v.length < s.minLength) errs.push(`${p}: shorter than ${s.minLength}`);
      if (s.maxLength && v.length > s.maxLength) errs.push(`${p}: longer than ${s.maxLength}`);
      if (s.format === 'uri') {
        try {
          new URL(v);
        } catch {
          errs.push(`${p}: not a uri`);
        }
      }
    }
    if (typeof v === 'number' && s.minimum !== undefined && v < s.minimum) errs.push(`${p}: ${v} < ${s.minimum}`);
    if (Array.isArray(v) && s.items) v.forEach((x, i) => go(s.items, x, `${p}[${i}]`));
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const r of s.required ?? []) if (!(r in v)) errs.push(`${p}: missing required "${r}"`);
      for (const [k, x] of Object.entries(v)) {
        if (s.properties && k in s.properties) go(s.properties[k], x, `${p}.${k}`);
        else if (s.additionalProperties === false) errs.push(`${p}: unexpected property "${k}"`);
        else if (s.additionalProperties && typeof s.additionalProperties === 'object') go(s.additionalProperties, x, `${p}.${k}`);
      }
    }
  };
  go(schema, value, at);
  return errs;
}
function resolve(spec, r) {
  if (!r.startsWith('#/')) throw new Error(`external ref ${r}`);
  let n = spec;
  for (const part of r.slice(2).split('/')) {
    n = n?.[part];
    if (n === undefined) throw new Error(`unresolved ref ${r}`);
  }
  return n;
}

// ---------------------------------------------------------------- load
const spec = readJson(path.join(DIST, 'openapi.json'));
const files = [];
const walk = (dir) => {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) walk(p);
    else files.push(p);
  }
};
walk(path.join(DIST, 'api/v1'));
const rel = (p) => path.relative(DIST, p).split(path.sep).join('/');
const docs = new Map(); // rel path -> parsed
for (const p of files) docs.set(rel(p), readJson(p));
const stringsOf = (v, out = [], key = '') => {
  if (typeof v === 'string') out.push([key, v]);
  else if (Array.isArray(v)) v.forEach((x) => stringsOf(x, out, key));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) stringsOf(x, out, k);
  return out;
};

// ---------------------------------------------------------------- [1] shapes
section('[kb 1] every api file matches its schema in /openapi.json');
{
  const routes = [
    [/^api\/v1\/index\.(json|html)$/, 'IndexResponse'],
    [/^api\/v1\/issues\.json$/, 'IssuesResponse'],
    [/^api\/v1\/issues\/\d{4}-\d{2}-\d{2}\.json$/, 'IssueResponse'],
    [/^api\/v1\/items\.json$/, 'ItemsResponse'],
    [/^api\/v1\/items\/\d{4}-\d{2}-\d{2}-\d+\.json$/, 'ItemResponse'],
    [/^api\/v1\/pool\/\d{4}-\d{2}-\d{2}\.json$/, 'PoolResponse'],
    [/^api\/v1\/models\/signals\.json$/, 'SignalsResponse'],
    [/^api\/v1\/models\/signals\/\d{4}-\d{2}-\d{2}\.json$/, 'SignalsDayResponse'],
    [/^api\/v1\/models\/pareto\.json$/, 'ParetoResponse'],
    [/^api\/v1\/tags\.json$/, 'TagsResponse'],
    [/^api\/v1\/search-index\.json$/, 'SearchIndexResponse'],
  ];
  const errs = [];
  const seen = new Set();
  for (const [p, doc] of docs) {
    const hit = routes.find(([re]) => re.test(p));
    if (!hit) {
      errs.push(`${p}: no schema for this file`);
      continue;
    }
    seen.add(hit[1]);
    for (const e of validate({ $ref: `#/components/schemas/${hit[1]}` }, doc, spec)) errs.push(`${p} ${e}`);
    const keys = Object.keys(doc).slice(0, 5).join(',');
    if (keys !== 'api,version,generated_at,license,self') errs.push(`${p}: envelope key order is ${keys}`);
    const wantSelf = p === 'api/v1/index.html' ? `${ORIGIN}/api/v1/index.json` : `${ORIGIN}/${p}`;
    if (doc.self !== wantSelf) errs.push(`${p}: self is ${doc.self}, want ${wantSelf}`);
    if (typeof doc.count === 'number' && Array.isArray(doc.data) && doc.count !== doc.data.length) errs.push(`${p}: count ${doc.count} != data.length ${doc.data.length}`);
  }
  for (const need of ['IndexResponse', 'IssuesResponse', 'ItemsResponse', 'SignalsResponse', 'ParetoResponse', 'TagsResponse', 'SearchIndexResponse'])
    if (!seen.has(need)) errs.push(`missing file for ${need}`);
  if (errs.length) bad('envelope + record shapes', errs);
  else ok(`${docs.size} api files validate (envelope, key order, self, count, record shapes)`);
}

// ---------------------------------------------------------------- [2] the spec itself
section('[kb 2] /openapi.json is sound and its examples are valid');
{
  const errs = [];
  if (spec.openapi !== '3.1.0') errs.push(`openapi is ${spec.openapi}`);
  const ids = new Set();
  const refs = new Set();
  const collect = (v) => {
    if (Array.isArray(v)) v.forEach(collect);
    else if (v && typeof v === 'object') {
      if (typeof v.$ref === 'string') refs.add(v.$ref);
      Object.values(v).forEach(collect);
    }
  };
  collect(spec);
  for (const r of refs) {
    try {
      resolve(spec, r);
    } catch (e) {
      errs.push(String(e.message));
    }
  }
  for (const [p, item] of Object.entries(spec.paths)) {
    for (const [m, op] of Object.entries(item)) {
      if (!op.operationId) errs.push(`${m} ${p}: no operationId`);
      else if (ids.has(op.operationId)) errs.push(`duplicate operationId ${op.operationId}`);
      ids.add(op.operationId);
      for (const [code, resp] of Object.entries(op.responses ?? {})) {
        const mt = resp.content?.['application/json'];
        if (mt?.example !== undefined && mt.schema) {
          for (const e of validate(mt.schema, mt.example, spec)) errs.push(`example ${m} ${p} ${code}: ${e}`);
        }
      }
    }
  }
  // every path of the contract is documented
  for (const p of ['/api/v1/', '/api/v1/index.json', '/api/v1/issues.json', '/api/v1/issues/{date}.json', '/api/v1/items.json', '/api/v1/items/{id}.json', '/api/v1/pool/{date}.json', '/api/v1/models/signals.json', '/api/v1/models/signals/{date}.json', '/api/v1/models/pareto.json', '/api/v1/tags.json', '/api/v1/search-index.json', '/api/v1/search', '/mcp', '/openapi.json', '/llms.txt', '/llms-full.txt', '/.well-known/mcp.json'])
    if (!spec.paths[p]) errs.push(`path ${p} is not documented`);
  if (errs.length) bad('openapi', errs);
  else ok(`openapi 3.1: ${Object.keys(spec.paths).length} paths, ${refs.size} distinct refs resolve, examples validate`);
}

// ---------------------------------------------------------------- [3] public-safe
section('[kb 3] public-safe: sources, tags, ids, paths');
{
  const errs = [];
  const SOURCES = new Set(['veille', 'github-trending', 'agent', 'openrouter-catalog']);
  const PRIVATE = /^(x-bookmark|notion|manual.*|github-stars)$/i;
  const INTERNAL_TAG = /^(pin|veille|connivence|lumi.*|brain|raw-brain|pstack|ssot|awaiting.*|enrich.*|disposition-.*|pack-.*|topic-.*|triage.*|steward.*|daily-.*|backfill.*|data-reviewed-.*|kevin.*|thin-watch|seat-config|fleet.*|team-bots|shared-bots|usage-pool|pin-lifecycle)$/i;
  const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
  const PIN_SLUG = /\bpin-[a-z0-9][a-z0-9-]{5,}/i;
  const PATHS = /(\/home\/[a-z]|\/Users\/|\/root\/|~\/|\.hermes\b|file:\/\/|\blocalhost\b|\b127\.0\.0\.1\b|\b100\.\d{1,3}\.\d{1,3}\.\d{1,3}\b|\btailnet\b|brainpsql)/i;
  const BAD_TEXT = /\b(x-bookmark|github-stars)\b/i;
  const DATE_TAG = /^\d{4}(-\d{2}(-\d{2})?)?$/;
  const walkRec = (v, p, file) => {
    if (Array.isArray(v)) return v.forEach((x, i) => walkRec(x, `${p}[${i}]`, file));
    if (v && typeof v === 'object') {
      if ('source' in v && typeof v.source === 'string') {
        if (!SOURCES.has(v.source)) errs.push(`${file} ${p}: unknown source ${JSON.stringify(v.source)}`);
        if (PRIVATE.test(v.source)) errs.push(`${file} ${p}: private source ${v.source}`);
      }
      if (Array.isArray(v.tags) && v.tags.every((t) => typeof t === 'string')) {
        for (const t of v.tags) {
          if (PRIVATE.test(t) || /bookmark|notion|stars$/.test(t)) errs.push(`${file} ${p}: private tag ${t}`);
          if (INTERNAL_TAG.test(t) || DATE_TAG.test(t) || !/^[a-z0-9][a-z0-9.+-]*$/.test(t)) errs.push(`${file} ${p}: internal or malformed tag ${JSON.stringify(t)}`);
        }
      }
      for (const [k, x] of Object.entries(v)) walkRec(x, `${p}.${k}`, file);
      return;
    }
    if (typeof v === 'string') {
      const isUrl = /^https?:\/\//.test(v);
      if (UUID.test(v)) errs.push(`${file} ${p}: uuid-looking id in ${JSON.stringify(v.slice(0, 80))}`);
      if (!isUrl && PIN_SLUG.test(v)) errs.push(`${file} ${p}: pin slug in ${JSON.stringify(v.slice(0, 80))}`);
      if (PATHS.test(v)) errs.push(`${file} ${p}: internal path/host in ${JSON.stringify(v.slice(0, 80))}`);
      if (BAD_TEXT.test(v)) errs.push(`${file} ${p}: private-source marker in ${JSON.stringify(v.slice(0, 80))}`);
    }
  };
  for (const [p, doc] of docs) walkRec(doc, '$', p);
  // tag keys of tags.json are tags too
  for (const t of Object.keys(docs.get('api/v1/tags.json')?.data ?? {})) {
    if (INTERNAL_TAG.test(t) || DATE_TAG.test(t) || PRIVATE.test(t)) errs.push(`tags.json: internal tag ${t}`);
  }
  for (const f of ['openapi.json', 'llms.txt', 'llms-full.txt', '.well-known/mcp.json']) {
    const t = read(path.join(DIST, f));
    if (UUID.test(t) || PATHS.test(t) || PIN_SLUG.test(t)) errs.push(`${f}: uuid, internal path or pin slug`);
  }
  if (errs.length) bad('public-safe rule', errs);
  else ok('only veille / github-trending / agent / openrouter-catalog; no private markers, uuids, pin slugs, internal paths or workflow tags');
}

// ---------------------------------------------------------------- [4] integrity
section('[kb 4] ids, urls and cross-file consistency');
{
  const errs = [];
  const get = (p) => docs.get(p);
  const index = get('api/v1/index.json').data;
  const itemsAll = get('api/v1/items.json').data;
  const issuesAll = get('api/v1/issues.json').data;
  // ids unique
  const uniq = (arr, what) => {
    const s = new Set();
    for (const x of arr) {
      if (s.has(x)) errs.push(`duplicate ${what}: ${x}`);
      s.add(x);
    }
    return s;
  };
  const itemIds = uniq(itemsAll.map((i) => i.id), 'item id');
  const itemFiles = [...docs.keys()].filter((p) => /^api\/v1\/items\/.+\.json$/.test(p));
  if (itemFiles.length !== itemsAll.length) errs.push(`items/ has ${itemFiles.length} files, items.json lists ${itemsAll.length}`);
  for (const it of itemsAll) {
    const f = `api/v1/items/${it.issue}-${it.n}.json`;
    if (!docs.has(f)) errs.push(`missing ${f}`);
    else if (JSON.stringify(docs.get(f).data) !== JSON.stringify(it)) errs.push(`${f} differs from its items.json entry`);
    if (it.id !== `${it.issue}#${it.n}`) errs.push(`item id ${it.id} != ${it.issue}#${it.n}`);
    if (!it.url.startsWith('https://')) errs.push(`item ${it.id}: url is not https`);
  }
  const poolFiles = [...docs.keys()].filter((p) => /^api\/v1\/pool\//.test(p));
  const poolAll = poolFiles.flatMap((p) => get(p).data);
  uniq(poolAll.map((e) => e.id), 'pool id');
  uniq(poolAll.map((e) => e.url), 'pool url');
  for (const p of poolFiles) {
    const day = p.match(/(\d{4}-\d{2}-\d{2})/)[1];
    for (const e of get(p).data) {
      if (e.date !== day) errs.push(`${p}: entry ${e.id} dated ${e.date}`);
      if (!e.url.startsWith('https://')) errs.push(`${p}: ${e.id} url is not https`);
      if (e.status === 'kept' && (!e.item_id || !itemIds.has(e.item_id))) errs.push(`${p}: kept entry ${e.id} has no valid item_id`);
      if (e.status === 'dropped' && !e.reason) errs.push(`${p}: dropped entry ${e.id} has no reason`);
      if (e.status !== 'kept' && e.item_id) errs.push(`${p}: ${e.status} entry ${e.id} carries item_id`);
      if (e.status !== 'dropped' && e.reason) errs.push(`${p}: ${e.status} entry ${e.id} carries a reason`);
    }
  }
  // issue pages
  for (const s of issuesAll) {
    const full = get(`api/v1/issues/${s.date}.json`)?.data;
    if (!full) {
      errs.push(`missing issues/${s.date}.json`);
      continue;
    }
    const n = full.sections.reduce((a, x) => a + x.items.length, 0);
    if (n !== s.item_count) errs.push(`${s.date}: item_count ${s.item_count} != ${n}`);
    for (const d of full.dropped) if (!d.url.startsWith('https://')) errs.push(`${s.date}: dropped url is not https`);
    for (const sec of full.sections) for (const it of sec.items) if (!itemIds.has(it.id)) errs.push(`${s.date}: ${it.id} not in items.json`);
  }
  // signals
  const sigDays = [...docs.keys()].filter((p) => /^api\/v1\/models\/signals\/\d/.test(p));
  const sigAll = sigDays.flatMap((p) => get(p).data);
  uniq(sigAll.map((s) => s.id), 'signal id');
  for (const p of sigDays) for (const s of get(p).data) if (!s.id.startsWith(`${s.date}:${s.type}:`)) errs.push(`${p}: signal id ${s.id} does not follow date:type:model_id`);
  const newest = get('api/v1/models/signals.json');
  if (newest.data.length > 200) errs.push(`signals.json has ${newest.data.length} > 200`);
  if (newest.total !== sigAll.length) errs.push(`signals.json total ${newest.total} != ${sigAll.length}`);
  // index counts == files
  const c = index.counts;
  const want = { issues: issuesAll.length, items: itemsAll.length, pool_days: poolFiles.length, pool_entries: poolAll.length, signal_days: sigDays.length, signals: sigAll.length };
  for (const [k, v] of Object.entries(want)) if (c[k] !== v) errs.push(`index.counts.${k} = ${c[k]}, files say ${v}`);
  if (JSON.stringify(index.datasets.pool.days) !== JSON.stringify(poolFiles.map((p) => p.match(/\d{4}-\d{2}-\d{2}/)[0]).sort())) errs.push('index pool days differ from pool files');
  if (JSON.stringify(index.datasets.model_signals.days) !== JSON.stringify(sigDays.map((p) => p.match(/\d{4}-\d{2}-\d{2}/)[0]).sort())) errs.push('index signal days differ from signal files');
  const st = { kept: 0, dropped: 0, unreviewed: 0 };
  for (const e of poolAll) st[e.status]++;
  if (JSON.stringify(st) !== JSON.stringify(index.datasets.pool.by_status)) errs.push(`index pool by_status ${JSON.stringify(index.datasets.pool.by_status)} != ${JSON.stringify(st)}`);
  if (index.datasets.model_pareto.available !== (get('api/v1/models/pareto.json').data !== null)) errs.push('index pareto.available disagrees with pareto.json');
  if (JSON.stringify(get('api/v1/index.html')) !== JSON.stringify(get('api/v1/index.json'))) errs.push('/api/v1/ differs from /api/v1/index.json');
  // search index
  const si = get('api/v1/search-index.json');
  uniq(si.data.map((e) => e.id), 'search index id');
  const wantSi = itemsAll.length + poolAll.filter((e) => e.status !== 'kept').length + sigAll.length;
  if (si.data.length !== wantSi) errs.push(`search-index has ${si.data.length} entries, expected ${wantSi}`);
  for (const e of si.data) if (e.url !== null && !e.url.startsWith('https://')) errs.push(`search-index ${e.id}: url is not https`);
  if (errs.length) bad('integrity', errs);
  else ok(`ids unique, urls https, ${itemsAll.length} items / ${poolAll.length} pool / ${sigAll.length} signals consistent with the index and the search index`);
}

// ---------------------------------------------------------------- [5] static surface
section('[kb 5] llms, mcp card, headers, functions');
{
  const errs = [];
  const llms = read(path.join(DIST, 'llms.txt'));
  const full = read(path.join(DIST, 'llms-full.txt'));
  for (const needle of ['/api/v1/', '/openapi.json', '/mcp', 'cc-by-4.0']) if (!llms.includes(needle)) errs.push(`llms.txt lacks ${needle}`);
  const issueDates = [...docs.keys()].map((p) => p.match(/^api\/v1\/issues\/(\d{4}-\d{2}-\d{2})\.json$/)?.[1]).filter(Boolean);
  for (const d of issueDates) if (!full.includes(`${ORIGIN}/${d}.md`)) errs.push(`llms-full.txt lacks issue ${d}`);
  if (!full.includes('## endpoint map')) errs.push('llms-full.txt lacks the endpoint map');
  const card = readJson(path.join(DIST, '.well-known/mcp.json'));
  const toolNames = card.tools.map((t) => t.name).sort().join(',');
  if (toolNames !== 'get_issue,get_pool,latest_issue,list_model_signals,search') errs.push(`mcp card tools: ${toolNames}`);
  if (card.transport?.url !== `${ORIGIN}/mcp`) errs.push('mcp card transport url');
  for (const t of card.tools) if (!t.inputSchema || !t.description || t.description.length < 80) errs.push(`tool ${t.name}: weak description or no schema`);
  const sitemap = read(path.join(DIST, 'sitemap.xml'));
  for (const u of ['/openapi.json', '/llms-full.txt', '/api/v1/']) if (!sitemap.includes(`${ORIGIN}${u}<`)) errs.push(`sitemap lacks ${u}`);
  const headers = read(path.join(ROOT, 'public/_headers'));
  for (const rule of ['/api/*', '/openapi.json', '/mcp', '/llms.txt', '/llms-full.txt', '/.well-known/mcp.json'])
    if (!new RegExp(`^${rule.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\n(\\s+.+\\n)*?\\s+Access-Control-Allow-Origin: \\*`, 'mi').test(headers)) errs.push(`_headers: no CORS * rule for ${rule}`);
  for (const f of ['functions/api/v1/search.ts', 'functions/mcp.ts']) if (!fs.existsSync(path.join(ROOT, f))) errs.push(`missing ${f}`);
  if (errs.length) bad('static surface', errs);
  else ok('llms.txt / llms-full.txt / mcp card / sitemap / _headers CORS / functions present');
}

// ---------------------------------------------------------------- [6] production only
if (buildLive) {
  section('[kb 6] production: no fixture data, counts equal the committed snapshots');
  const errs = [];
  for (const [p, doc] of docs) if ('fixture' in doc) errs.push(`${p}: carries fixture flag`);
  if ('x-fixture' in spec) errs.push('openapi carries x-fixture');
  const kbDir = path.join(ROOT, 'src/data-live/kb');
  const ls = (d) => (fs.existsSync(d) ? fs.readdirSync(d).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)) : []);
  const poolSnap = ls(path.join(kbDir, 'pool'));
  const sigSnap = ls(path.join(kbDir, 'models/signals'));
  const issuesSnap = ls(path.join(ROOT, 'src/data-live/issues'));
  const pool = [...docs.keys()].filter((p) => /^api\/v1\/pool\//.test(p));
  const sig = [...docs.keys()].filter((p) => /^api\/v1\/models\/signals\/\d/.test(p));
  if (pool.length !== poolSnap.length) errs.push(`pool files ${pool.length} != snapshots ${poolSnap.length}`);
  if (sig.length !== sigSnap.length) errs.push(`signal files ${sig.length} != snapshots ${sigSnap.length}`);
  const issueFiles = [...docs.keys()].filter((p) => /^api\/v1\/issues\/\d/.test(p));
  if (issueFiles.length !== issuesSnap.length) errs.push(`issue files ${issueFiles.length} != src/data-live/issues ${issuesSnap.length}`);
  const snapEntries = poolSnap.reduce((n, f) => n + readJson(path.join(kbDir, 'pool', f)).entries.length, 0);
  const apiEntries = pool.reduce((n, p) => n + docs.get(p).data.length, 0);
  if (snapEntries !== apiEntries) errs.push(`pool entries: snapshots ${snapEntries} != api ${apiEntries}`);
  if (fs.existsSync(path.join(kbDir, 'models/pareto.json')) && docs.get('api/v1/models/pareto.json').data === null) errs.push('pareto snapshot exists but the api serves null');
  // the live site must never ship fixture hosts: every item url comes from a live issue
  for (const f of issuesSnap) {
    const j = readJson(path.join(ROOT, 'src/data-live/issues', f));
    if (j.fixture) errs.push(`live issue ${f} is a fixture`);
  }
  if (errs.length) bad('production data', errs);
  else ok(`${issueFiles.length} issues, ${pool.length} pool days (${apiEntries} entries), ${sig.length} signal days; no fixture flag`);
}

// ---------------------------------------------------------------- report
section('[kb] payload sizes');
for (const f of ['api/v1/items.json', 'api/v1/search-index.json', 'api/v1/index.json', 'openapi.json', 'llms-full.txt', 'llms.txt']) {
  const p = path.join(DIST, f);
  if (fs.existsSync(p)) console.log(`  ${f.padEnd(26)} ${String(fs.statSync(p).size).padStart(8)} bytes`);
}
console.log(failures.length ? `\n${failures.length} kb check(s) failed: ${failures.join(', ')}` : '\nall kb checks passed');
process.exit(failures.length ? 1 : 0);
