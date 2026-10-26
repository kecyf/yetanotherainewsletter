#!/usr/bin/env node
// acceptance checks (DESIGN.md §6 + worker task §7). fails loudly, readable diffs.
// run on dist/ after `astro build`. scope notes:
//  - design/mockups/*.html are self-contained conception artifacts that inline the
//    tokens by requirement; they are out of scope for the style greps.
//  - the parity check compares the rendered html against the rendered .md, not the entry.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const SRC = path.join(ROOT, 'src');

const failures = [];
const ok = (name) => console.log(`  ok   ${name}`);
const fail = (name, detail) => {
  failures.push(name);
  console.error(`  FAIL ${name}\n${detail ? detail.split('\n').map((l) => `       ${l}`).join('\n') : ''}`);
};

const read = (p) => fs.readFileSync(p, 'utf8');
// a page may be emitted as /x.html or /x/index.html; resolve once
const page = (name) => {
  const direct = path.join(DIST, `${name}.html`);
  return fs.existsSync(direct) ? direct : path.join(DIST, name, 'index.html');
};
const norm = (s) =>
  s
    .normalize('NFC')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();

// ---------- collect issues / skipped from the fixtures (the data side of parity)
const issueDates = fs
  .readdirSync(path.join(SRC, 'data/issues'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => f.replace(/\.json$/, ''))
  .sort();
const skippedRaw = JSON.parse(read(path.join(SRC, 'data/skipped.json')));
const skippedDates = Object.keys(skippedRaw.days).sort();

console.log('\n[1] copy: no quoted user-facing sentence in .astro outside copy.ts');
{
  const offenders = [];
  const walk = (dir) => {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (f.endsWith('.astro')) {
        const src = read(p);
        // a "sentence": three or more consecutive pure-alpha lowercase words in a quoted string
        for (const m of src.matchAll(/"([a-z]{2,}( [a-z]{2,}){2,})"/g)) {
          offenders.push(`${path.relative(ROOT, p)}: "${m[1]}"`);
        }
        for (const m of src.matchAll(/'([a-z]{2,}( [a-z]{2,}){2,})'/g)) {
          offenders.push(`${path.relative(ROOT, p)}: '${m[1]}'`);
        }
      }
    }
  };
  walk(SRC);
  if (offenders.length) fail('copy strings live in copy.ts only', offenders.join('\n'));
  else ok('no quoted sentences in .astro outside copy.ts');
}

console.log('\n[2] style guards: no raw colour / px / font name outside tokens.css, no arbitrary values, no font-bold');
{
  const offenders = [];
  const walk = (dir) => {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (/\.(astro|css|ts|mjs|json)$/.test(f)) {
        const rel = path.relative(ROOT, p);
        const src = read(p);
        if (rel === 'src/styles/tokens.css') continue;
        const hex = src.match(/#[0-9a-fA-F]{3,8}\b/g);
        if (hex) offenders.push(`${rel}: raw colour ${[...new Set(hex)].join(', ')}`);
        const px = src.match(/\b\d+(\.\d+)?px\b/g);
        if (px) offenders.push(`${rel}: raw px ${[...new Set(px)].join(', ')}`);
        // raw font name: a literal family, not a var() reference
        if (/system-ui|Segoe UI|SF Mono|JetBrains Mono|Menlo|Consolas|Roboto|-apple-system|ui-monospace|ui-sans-serif/.test(src) || /font-family[^;]*["']/.test(src))
          offenders.push(`${rel}: raw font name`);
        // arbitrary tailwind values: only inside class attributes (code
        // indexers like WEEKDAYS[d.getUTCDay()] are not classes)
        for (const m of src.matchAll(/class=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
          const cls = m[1] ?? m[2] ?? '';
          for (const c of cls.matchAll(/[\w-]+\[([^\]"'`]*)\]/g)) {
            if (!/^[a-zA-Z_.]*$/.test(c[1]) && c[1] !== '')
              offenders.push(`${rel}: arbitrary tailwind value ${c[0]}`);
          }
        }
        if (/font-bold/.test(src)) offenders.push(`${rel}: font-bold (no bold, medium is the ceiling)`);
      }
    }
  };
  walk(SRC);
  if (offenders.length) fail('style guards', offenders.join('\n'));
  else ok('style guards clean');
}

console.log('\n[3] accent appears in exactly one component');
{
  const offenders = [];
  const compDir = path.join(SRC, 'components');
  for (const f of fs.readdirSync(compDir)) {
    if (!f.endsWith('.astro')) continue;
    if (f === 'AgentBlock.astro') continue;
    const src = read(path.join(compDir, f));
    if (/accent/.test(src)) offenders.push(f);
  }
  if (offenders.length) fail('accent is reserved to AgentBlock', offenders.join(', '));
  else ok('accent only in AgentBlock.astro');
}

console.log('\n[4] fixture data is never presented as a real issue');
{
  const off = [];
  for (const d of issueDates) {
    const html = read(page(d));
    if (!/this issue is fixture data/.test(html)) off.push(`${d}: no fixture notice rendered`);
  }
  if (off.length) fail('fixture notice', off.join('\n'));
  else ok('fixture issues carry the fixture notice');
}

// ---------- parity: html vs .md, rendered output on both sides
function parseHtmlIssue(html) {
  const main = /<main[^>]*>([\s\S]*)<\/main>/.exec(html)[1];
  const out = { subject: '', intro: '', strip: [], items: [], signal: null, fleet: null, signoff: null, dropped: [] };
  out.subject = norm(/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(main)[1]);
  const header = /<header[^>]*>([\s\S]*?)<\/header>/.exec(main)?.[1] ?? '';
  const hp = [...header.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => norm(m[1]));
  out.intro = hp.filter((t) => t && !/ · /.test(t))[0] ?? '';
  for (const m of main.matchAll(/<dt[^>]*>([^<]+)<\/dt>\s*<dd[^>]*>([^<]*)<\/dd>/g)) {
    out.strip.push([norm(m[1]), norm(m[2])]);
  }
  for (const m of main.matchAll(/<article id="(\d+)"[^>]*>([\s\S]*?)<\/article>/g)) {
    const body = m[2];
    const a = /<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/.exec(body);
    const why = norm(/<p class="text-fg-2[^"]*">([\s\S]*?)<\/p>/.exec(body)[1]);
    const provRaw = /<p class="font-mono[^"]*">([\s\S]*?)<\/p>/.exec(body)[1];
    const prov = norm(provRaw.replace(/<[^>]+>/g, ''));
    out.items.push({ n: Number(m[1]), title: norm(a[2]), href: a[1], why, prov });
  }
  const sig = /aria-labelledby="s-signal">[\s\S]*?<p class="text-fg-2[^"]*">([\s\S]*?)<\/p>\s*<p[^>]*>([^<]*)<\/p>/.exec(main);
  if (sig) out.signal = { text: norm(sig[1]), sig: norm(sig[2]) };
  const fleet = /aria-labelledby="s-fleet">[\s\S]*?<p class="text-fg-2[^"]*">([\s\S]*?)<\/p>\s*<p[^>]*>([^<]*)<\/p>/.exec(main);
  if (fleet) out.fleet = { text: norm(fleet[1]), sig: norm(fleet[2]) };
  const so = /<div id="signoff"[^>]*>[\s\S]*?<p class="text-fg-2[^"]*">([\s\S]*?)<\/p>\s*<p[^>]*>([^<]*)<\/p>/.exec(main);
  if (so) out.signoff = { text: norm(so[1]), sig: norm(so[2]) };
  const det = /<details[^>]*>([\s\S]*?)<\/details>/.exec(main);
  if (det) {
    for (const m of det[1].matchAll(/<li[^>]*>[\s\S]*?<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>\s*<span[^>]*>([^<]*)<\/span>/g)) {
      out.dropped.push({ title: norm(m[2]), href: m[1], rest: norm(m[3]) });
    }
  }
  return out;
}

function parseMdIssue(md) {
  const fm = /---\n([\s\S]*?)\n---\n\n([\s\S]*)$/.exec(md);
  const body = fm[2];
  const out = { subject: '', intro: '', strip: [], items: [], signal: null, fleet: null, signoff: null, dropped: [] };
  out.subject = norm(/^title: "(.*)"$/m.exec(fm[1])[1]);
  const stats = /^stats: \{(.*)\}$/m.exec(fm[1])[1];
  const models = /^models: \[(.*)\]$/m.exec(fm[1])[1];
  out.strip = [
    ...stats.split(',').map((kv) => kv.split(':').map((x) => norm(x))),
    ['models', models.replace(/"/g, '')],
  ];
  out.intro = norm(/^# .*\n\n([\s\S]*?)\n\n## /.exec(body)[1]);
  for (const m of body.matchAll(/### (\d+)\. \[([^\]]*)\]\(([^)]*)\)\n\n([\s\S]*?)\n\n`([^`]*)`/g)) {
    out.items.push({ n: Number(m[1]), title: norm(m[2]), href: m[3], why: norm(m[4]), prov: norm(m[5]) });
  }
  const sig = /## signal\n\n> ([^\n]*)\n>\n> (— [^\n]*)/.exec(body);
  if (sig) out.signal = { text: norm(sig[1]), sig: norm(sig[2]) };
  const fl = /## from the fleet\n\n> ([^\n]*)\n>\n> (— [^\n]*)\n\n([\s\S]*?)\n\n(— [^\n]*), for the fleet/.exec(body);
  if (fl) {
    out.fleet = { text: norm(fl[1]), sig: norm(fl[2]) };
    out.signoff = { text: norm(fl[3]), sig: norm(`${fl[4]}, for the fleet`) };
  }
  for (const m of body.matchAll(/^- \[([^\]]*)\]\(([^)]*)\) · (.*)$/gm)) {
    out.dropped.push({ title: norm(m[1]), href: m[2], rest: norm(m[3]) });
  }
  return out;
}

console.log('\n[5] parity: html issue == markdown twin (content, order, sections)');
{
  const bad = [];
  for (const d of issueDates) {
    const html = parseHtmlIssue(read(page(d)));
    const md = parseMdIssue(read(path.join(DIST, `${d}.md`)));
    const diffs = [];
    if (html.subject !== md.subject) diffs.push(`subject: ${JSON.stringify(html.subject)} != ${JSON.stringify(md.subject)}`);
    if (html.intro !== md.intro) diffs.push(`intro: ${JSON.stringify(html.intro)} != ${JSON.stringify(md.intro)}`);
    if (JSON.stringify(html.items) !== JSON.stringify(md.items))
      diffs.push(`items:\n    html: ${JSON.stringify(html.items, null, 1)}\n    md:   ${JSON.stringify(md.items, null, 1)}`);
    if (JSON.stringify(html.signal ?? null) !== JSON.stringify(md.signal ?? null))
      diffs.push(`signal: ${JSON.stringify(html.signal)} != ${JSON.stringify(md.signal)}`);
    if (JSON.stringify(html.fleet ?? null) !== JSON.stringify(md.fleet ?? null))
      diffs.push(`fleet: ${JSON.stringify(html.fleet)} != ${JSON.stringify(md.fleet)}`);
    if (JSON.stringify(html.signoff ?? null) !== JSON.stringify(md.signoff ?? null))
      diffs.push(`signoff: ${JSON.stringify(html.signoff)} != ${JSON.stringify(md.signoff)}`);
    if (JSON.stringify(html.dropped) !== JSON.stringify(md.dropped))
      diffs.push(`dropped:\n    html: ${JSON.stringify(html.dropped)}\n    md:   ${JSON.stringify(md.dropped)}`);
    if (diffs.length) bad.push(`${d}:\n${diffs.join('\n')}`);
  }
  if (bad.length) fail('html/.md parity', bad.join('\n'));
  else ok(`${issueDates.length} issue(s) match their .md twins`);
}

console.log('\n[6] latest.md == newest dated .md, byte for byte');
{
  const newest = issueDates[issueDates.length - 1];
  const a = read(path.join(DIST, 'latest.md'));
  const b = read(path.join(DIST, `${newest}.md`));
  if (a !== b) fail('latest.md parity', `latest.md (${a.length}b) != ${newest}.md (${b.length}b)`);
  else ok(`latest.md == ${newest}.md`);
}

console.log('\n[7] prompt consistency: issue page == agent view == llms.txt, dated .md only');
{
  const bad = [];
  const newest = issueDates[issueDates.length - 1];
  const llms = read(path.join(DIST, 'llms.txt'));
  for (const d of issueDates) {
    const p1 = norm(/<pre id="prompt"[^>]*>([\s\S]*?)<\/pre>/.exec(read(page(d)))[1]);
    const p2 = norm(/<pre id="prompt"[^>]*>([\s\S]*?)<\/pre>/.exec(read(path.join(DIST, `${d}/agent/index.html`)))[1]);
    if (p1 !== p2) bad.push(`${d}: issue page prompt != agent view prompt`);
    if (!p1.includes(`/${d}.md`)) bad.push(`${d}: prompt does not point at the dated .md`);
    if (p1.includes('latest')) bad.push(`${d}: prompt mentions latest`);
  }
  const p1 = norm(/<pre id="prompt"[^>]*>([\s\S]*?)<\/pre>/.exec(read(page(newest)))[1]);
  const llmsPrompt = norm(/^---\n([\s\S]*?)\n---$/m.exec(llms)?.[1] ?? '');
  if (llmsPrompt !== p1) bad.push(`llms.txt prompt != issue page prompt\n    llms:  ${JSON.stringify(llmsPrompt)}\n    issue: ${JSON.stringify(p1)}`);
  if (bad.length) fail('prompt consistency', bad.join('\n'));
  else ok('prompts consistent across page, agent view and llms.txt');
}

console.log('\n[8] link targets: own origin or fixture data hosts only');
{
  const allowed = new Set(['yetanotherainewsletter.org']);
  for (const f of fs.readdirSync(path.join(SRC, 'data/issues'))) {
    const j = JSON.parse(read(path.join(SRC, 'data/issues', f)));
    for (const s of j.sections) for (const it of s.items) allowed.add(new URL(it.url).hostname);
    for (const dr of j.dropped) allowed.add(new URL(dr.url).hostname);
  }
  const bad = [];
  const walk = (dir) => {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (f.endsWith('.html')) {
        const html = read(p);
        for (const m of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
          const u = m[1];
          if (u.startsWith('#') || u.startsWith('/') || u.startsWith('mailto:')) continue;
          try {
            const h = new URL(u).hostname;
            if (!allowed.has(h)) bad.push(`${path.relative(DIST, p)}: ${u}`);
          } catch {
            bad.push(`${path.relative(DIST, p)}: unparseable ${u}`);
          }
        }
        for (const m of html.matchAll(/<script[^>]*src=/g)) bad.push(`${path.relative(DIST, p)}: external script`);
      }
    }
  };
  walk(DIST);
  if (bad.length) fail('link/script targets', [...new Set(bad)].join('\n'));
  else ok('all link targets are ours or fixture source hosts; no external scripts');
}

console.log('\n[9] inline js budget: <= 1kb per page, and only the copy-button script');
{
  const bad = [];
  const walk = (dir) => {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      if (fs.statSync(p).isDirectory()) walk(p);
      else if (f.endsWith('.html')) {
        const html = read(p);
        const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
        const total = scripts.reduce((n, m) => n + Buffer.byteLength(m[1], 'utf8'), 0);
        if (total > 1024) bad.push(`${path.relative(DIST, p)}: ${total} bytes of inline js`);
        if (scripts.length > 1) bad.push(`${path.relative(DIST, p)}: ${scripts.length} script blocks`);
        for (const s of scripts) {
          if (!/data-copy/.test(s[1])) bad.push(`${path.relative(DIST, p)}: script is not the copy-button script`);
        }
      }
    }
  };
  walk(DIST);
  if (bad.length) fail('inline js budget', bad.join('\n'));
  else ok('inline js within budget');
}

console.log('\n[10] calendar completeness: every date from launch to today is issue or skipped');
{
  const bad = [];
  const dstr = (d) => d.toISOString().slice(0, 10);
  const today = new Date();
  const launch = [issueDates[0], ...skippedDates].sort()[0];
  for (let d = new Date(`${launch}T00:00:00Z`); d <= today; d.setUTCDate(d.getUTCDate() + 1)) {
    const s = dstr(d);
    const isIssue = issueDates.includes(s);
    const isSkip = skippedDates.includes(s);
    if (isIssue && isSkip) bad.push(`${s}: both`);
    if (!isIssue && !isSkip) bad.push(`${s}: neither`);
  }
  // archive row count = issues + skipped
  const archive = read(path.join(DIST, 'archive/index.html'));
  const rowCount = (archive.match(/class="dated"/g) ?? []).length;
  if (rowCount !== issueDates.length + skippedDates.length)
    bad.push(`archive rows (${rowCount}) != issues (${issueDates.length}) + skipped (${skippedDates.length})`);
  if (bad.length) fail('calendar completeness', bad.join('\n'));
  else ok(`calendar complete: ${issueDates.length} issue(s), ${skippedDates.length} skipped`);
}

console.log('\n[11] anchors: every #n in dropped reasons exists on the page');
{
  const bad = [];
  for (const d of issueDates) {
    // entities (&#39;) are not anchor references
    const html = read(page(d)).replace(/&#\d+;/g, '');
    const ids = new Set([...html.matchAll(/id="(\d+)"/g)].map((m) => m[1]));
    for (const m of html.matchAll(/#(\d+)\b/g)) {
      if (!ids.has(m[1])) bad.push(`${d}: reference #${m[1]} has no anchor`);
    }
  }
  if (bad.length) fail('anchor references', bad.join('\n'));
  else ok('all #n references resolve');
}

console.log('\n[12] md twins <= 12 kb, issue html <= 30 kb gzipped');
{
  const bad = [];
  for (const d of issueDates) {
    const mdSize = fs.statSync(path.join(DIST, `${d}.md`)).size;
    if (mdSize > 12288) bad.push(`${d}.md is ${mdSize} bytes`);
    const html = read(page(d));
    const css = fs.existsSync(path.join(DIST, '_astro'))
      ? fs
          .readdirSync(path.join(DIST, '_astro'))
          .filter((f) => f.endsWith('.css'))
          .map((f) => read(path.join(DIST, '_astro', f)))
          .join('')
      : '';
    const gz = zlib.gzipSync(Buffer.from(html + css), { level: 9 }).length;
    if (gz > 30720) bad.push(`${d}.html+css is ${gz} bytes gzipped`);
  }
  if (bad.length) fail('size budget', bad.join('\n'));
  else ok('within size budgets');
}

console.log('');
if (failures.length) {
  console.error(`\ncheck failed: ${failures.length} failure group(s): ${failures.join('; ')}`);
  process.exit(1);
} else {
  console.log('check passed.');
}
