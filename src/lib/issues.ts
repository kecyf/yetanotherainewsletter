// issue + skipped-day store. loads the fixture files, validates every invariant
// (DESIGN.md §6), and enforces calendar completeness from launch to today.

import fs from 'node:fs';
import path from 'node:path';
import { dateRange, todayUtc } from './date';
import { issueSchema, type IssueEntry } from '../content/schema';
import { site } from '../content/copy';

// astro 7 copies page modules into dist/.prerender at build time, so this module
// cannot trust import.meta.dirname; resolve from the project root instead.
// YAAN_DATA_DIR selects the data root: default `src/data` = labelled fixtures (dev + `check`),
// `src/data-live` = real issues only (production build, `bun run build:live`).
const DATA_DIR = path.resolve(process.cwd(), process.env.YAAN_DATA_DIR ?? 'src/data');
const ISSUES_DIR = path.join(DATA_DIR, 'issues');

export type SkippedDay = { reason?: string; proposed?: number; kept?: number };

export function getIssues(): IssueEntry[] {
  const files = fs.readdirSync(ISSUES_DIR).filter((f) => f.endsWith('.json')).sort();
  const issues = files.map((f) => {
    const raw = JSON.parse(fs.readFileSync(path.join(ISSUES_DIR, f), 'utf8'));
    const parsed = issueSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(`issue fixture ${f} fails the schema:\n${parsed.error.issues.map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n')}`);
    }
    // production builds never ship a labelled stand-in as a real issue.
    if (process.env.YAAN_LIVE === '1' && parsed.data.fixture) {
      throw new Error(`issue ${f} is a fixture (fixture: true) and cannot be part of a live build`);
    }
    return parsed.data;
  });
  if (issues.length === 0) console.warn('no issues found under src/data/issues (empty-state build)');
  issues.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return issues;
}

export function getSkipped(): Map<string, SkippedDay> {
  const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'skipped.json'), 'utf8'));
  return new Map(Object.entries(raw.days as Record<string, SkippedDay>));
}

/** launch date = the first date the calendar must cover. */
export function launchDate(issues: IssueEntry[]): string {
  const skipped = getSkipped();
  if (issues.length === 0) return todayUtc();
  const firstIssue = issues[0].date;
  const firstSkipped = [...skipped.keys()].sort()[0] ?? firstIssue;
  return firstIssue < firstSkipped ? firstIssue : firstSkipped;
}

/** every date from launch to yesterday (utc) is an issue or a skipped day. never both, never neither. */
export function assertCalendarComplete(issues: IssueEntry[]): void {
  if (issues.length === 0) return; // empty-state build: nothing to cover yet
  const issueDates = new Set(issues.map((i) => i.date));
  const skipped = getSkipped();
  // the calendar must be complete up to YESTERDAY (utc): today's issue may legitimately not exist yet.
  const yesterday = new Date(Date.parse(`${todayUtc()}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
  for (const d of dateRange(launchDate(issues), yesterday)) {
    const isIssue = issueDates.has(d);
    const isSkipped = skipped.has(d);
    if (isIssue && isSkipped) throw new Error(`${d} is both an issue and a skipped day`);
    // dev server only: a gap day (e.g. the utc date just rolled over) must not blank the preview. builds still fail.
    if (!isIssue && !isSkipped && import.meta.env.DEV) continue;
    if (!isIssue && !isSkipped) throw new Error(`${d} is neither an issue nor a skipped day (calendar completeness)`);
    if (isSkipped && !isIssue) {
      // a skipped day must not carry >= 3 kept items anywhere
      const s = skipped.get(d);
      if (s?.kept !== undefined && s.kept >= 3) throw new Error(`${d} is skipped but claims ${s.kept} kept items`);
    }
  }
}

export function getLatestOrNull(issues: IssueEntry[]): IssueEntry | null {
  return issues.length ? issues[issues.length - 1] : null;
}

export function getLatest(issues: IssueEntry[]): IssueEntry {
  if (issues.length === 0) throw new Error('getLatest: no issues');
  return issues[issues.length - 1];
}

/** prev/next issue dates around any date, or null. */
export function neighbours(date: string, issues: IssueEntry[]): { prev: string | null; next: string | null } {
  const before = issues.filter((i) => i.date < date);
  const after = issues.filter((i) => i.date > date);
  return {
    prev: before.length ? before[before.length - 1].date : null,
    next: after.length ? after[0].date : null,
  };
}

/** the fleet rows for /about, derived from the entry — never invented. */
export function fleetRows(e: IssueEntry): { key: string; value: string }[] {
  const proposedBy = new Map<string, number>();
  for (const s of e.sections) for (const it of s.items) proposedBy.set(it.agent, (proposedBy.get(it.agent) ?? 0) + 1);
  for (const d of e.dropped) proposedBy.set(d.agent, (proposedBy.get(d.agent) ?? 0) + 1);
  // only a model explicitly tagged (scouts) is attributed to the scouts; never guess from models[0].
  const scoutModel = e.models.find((m) => m.includes('(scouts)'));
  const dedupeModel = e.models.find((m) => m.includes('(dedupe)'));
  const draftModel = e.models.find((m) => m.includes('(draft)'));
  const rows = [...proposedBy.entries()].map(([agent, n]) => ({
    key: agent,
    value: `veille · ${scoutModel ? `${scoutModel.split(' (')[0]} · ` : ''}${n} item${n === 1 ? '' : 's'} proposed`,
  }));
  if (dedupeModel) rows.push({ key: 'dedupe', value: `dedupe · ${dedupeModel.split(' (')[0]} · ${e.stats.proposed} proposals seen` });
  if (draftModel) rows.push({ key: 'draft', value: `draft · ${draftModel.split(' (')[0]} · ${e.stats.kept} items assembled` });
  return rows;
}

export const ORIGIN = site.origin;
