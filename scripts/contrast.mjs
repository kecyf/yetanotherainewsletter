#!/usr/bin/env node
// WCAG 2.x contrast of every text/background pair that tokens.css ships.
// reads the tokens (no colour is written here). exit 1 if a text pair is under 4.5:1.
import fs from 'node:fs';
import path from 'node:path';

const css = fs.readFileSync(path.resolve(import.meta.dirname, '../src/styles/tokens.css'), 'utf8');
const tok = {};
for (const m of css.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)) tok[m[1]] = m[2];

const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const text = ['fg-1', 'fg-2', 'fg-reading', 'fg-preface', 'fg-3', 'success', 'warning', 'danger', 'accent'];
const bgs = ['bg', 'surface', 'surface-2'];
let failed = 0;
const row = (fg, bg, min = 4.5) => {
  if (!tok[fg] || !tok[bg]) return;
  const r = ratio(tok[fg], tok[bg]);
  const pass = r >= min;
  if (!pass) failed++;
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${fg.padEnd(11)} ${tok[fg]} on ${bg.padEnd(9)} ${tok[bg]}  ${r.toFixed(2)}:1`);
};
for (const bg of bgs) for (const fg of text) row(fg, bg);
row('accent-ink', 'accent');
row('fg-preface', 'bg', 7); // the issue intro is the page preface: dim tier, never disabled (v1.3)
row('fg-1', 'link-line'); // ::selection
row('accent', 'bg', 3); // focus ring (non-text, 3:1)
console.log(failed ? `\n${failed} pair(s) under 4.5:1` : '\nall text pairs >= 4.5:1');
process.exit(failed ? 1 : 0);
