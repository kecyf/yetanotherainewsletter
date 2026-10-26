// date utilities — all utc, all through here (DESIGN.md §6 invariants).

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** parse a yyyy-mm-dd date as utc midnight. never use new Date('2026-10-26') loosely. */
export function utcDate(date: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new Error(`bad date: ${date}`);
  return new Date(`${date}T00:00:00Z`);
}

/** the only formatter of the issue header's date parts (DESIGN.md §3, IssueHeader). */
export function formatIssueDate(date: string): { date: string; weekday: string } {
  const d = utcDate(date);
  return { date, weekday: WEEKDAYS[d.getUTCDay()] };
}

/** "05:40 utc" from an iso timestamp. */
export function formatUtcTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error(`bad timestamp: ${iso}`);
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm} utc`;
}

/** today's date (yyyy-mm-dd) in utc. */
export function todayUtc(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** the day before a yyyy-mm-dd, utc. */
export function prevDay(date: string): string {
  const d = utcDate(date);
  d.setUTCDate(d.getUTCDate() - 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** every yyyy-mm-dd from `from` to `to` inclusive, utc. */
export function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = nextDay(d)) out.push(d);
  return out;
}

function nextDay(date: string): string {
  const d = utcDate(date);
  d.setUTCDate(d.getUTCDate() + 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** ceil(words / 200) — the issue header's read time. */
export function readMinutes(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}
