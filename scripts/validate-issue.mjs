#!/usr/bin/env node
// validate one draft issue JSON against the site schema (src/content/schema.ts).
// usage: node scripts/validate-issue.mjs <draft.json> [--bundle <collector-bundle.json>]
// exit 0 = valid, exit 1 = invalid (readable errors), exit 2 = usage / unreadable file.
// with --bundle, every item url must also appear in the collector bundle (no invented urls).
import fs from 'node:fs';
import path from 'node:path';
import { issueSchema } from '../src/content/schema.ts';

const args = process.argv.slice(2);
const bundleIdx = args.indexOf('--bundle');
const bundlePath = bundleIdx >= 0 ? args.splice(bundleIdx, 2)[1] : null;
const file = args[0];
if (!file) {
  console.error('usage: node scripts/validate-issue.mjs <draft.json> [--bundle <bundle.json>]');
  process.exit(2);
}

let raw;
try {
  raw = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (err) {
  console.error(`cannot read ${file} as JSON: ${err.message}`);
  process.exit(2);
}

const errors = [];
const parsed = issueSchema.safeParse(raw);
if (!parsed.success) {
  for (const i of parsed.error.issues) errors.push(`${i.path.join('.') || '(root)'}: ${i.message}`);
}

// checks beyond the schema, for real issues only
if (raw && raw.fixture === false) {
  const base = path.basename(file, '.json');
  if (/^\d{4}-\d{2}-\d{2}$/.test(base) && base !== raw.date) errors.push(`file name ${base}.json does not match date ${raw.date}`);
  if (raw.curator !== 'kevin') errors.push(`curator must be 'kevin' (got ${JSON.stringify(raw.curator)})`);
}
if (raw && raw.fixture === true) errors.push("fixture is true: a draft for src/data-live must set fixture: false");

if (bundlePath) {
  try {
    const bundle = JSON.parse(fs.readFileSync(bundlePath, 'utf8'));
    const known = new Set(bundle.items.map((i) => i.url));
    const used = [
      ...(raw.sections ?? []).flatMap((s) => (s.items ?? []).map((i) => ['sections item ' + i.n, i.url])),
      ...(raw.dropped ?? []).map((d, k) => ['dropped[' + k + ']', d.url]),
    ];
    for (const [where, url] of used) if (!known.has(url)) errors.push(`${where}: url is not in the collector bundle (never invent a url): ${url}`);
  } catch (err) {
    errors.push(`cannot read bundle ${bundlePath}: ${err.message}`);
  }
}

if (errors.length) {
  console.error(`INVALID ${file}`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
const e = parsed.data;
console.log(`OK ${file}: ${e.date}, ${e.stats.kept} items kept (${e.stats.proposed} proposed, ${e.stats.dropped} dropped, ${e.stats.hand} by hand)`);
