// the issue entry schema with every invariant as a refinement (DESIGN.md §6).
// fixture files under src/data/issues are validated against this at build time.

import { z } from 'zod';

export const SECTION_ORDER = ['labs', 'sota', 'tools', 'timeline'] as const;

const itemSchema = z.object({
  n: z.number().int().positive(),
  title: z.string().min(1),
  url: z.url(),
  why: z.string().min(1).refine((s) => s.length <= 220, { message: 'why must stay within 220 chars (warning threshold)' }),
  agent: z.string().min(1),
  hand: z.boolean().optional().default(false),
  // v1.1 (DESIGN.md §10.3.2): optional flag on exactly one item; the first
  // item of the first section is the lead when no item is flagged.
  lead: z.boolean().optional().default(false),
});

export const issueSchema = z
  .object({
    fixture: z.literal(true),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    issue: z.number().int().positive(),
    subject: z
      .string()
      .min(1)
      // v1.1 (DESIGN.md §10.4): sentence case, target <= 72, hard ceiling 80
      .refine((s) => s.length <= 80 && !s.endsWith('.') && !/[?!]/.test(s), {
        message: 'subject: one line, sentence case, <= 80 chars hard ceiling (target 72), no trailing period, no questions',
      }),
    intro: z.string().min(1),
    curator: z.string().min(1),
    assembled: z.iso.datetime(),
    stats: z.object({
      sources: z.number().int().nonnegative(),
      read: z.number().int().nonnegative(),
      proposed: z.number().int().nonnegative(),
      dropped: z.number().int().nonnegative(),
      hand: z.number().int().nonnegative(),
      kept: z.number().int().min(3),
    }),
    models: z.array(z.string().min(1)).min(1),
    sections: z.array(
      z.object({
        name: z.enum(SECTION_ORDER),
        items: z.array(itemSchema).min(1),
      }),
    ),
    signal: z
      .object({ text: z.string().min(1).refine((s) => s.length <= 400, { message: 'signal must be <= 400 chars' }) })
      .optional(),
    fleet: z.object({
      agent: z.string().min(1),
      model: z.string().min(1),
      text: z.string().min(1).refine((s) => s.length <= 400, { message: 'fleet note must be <= 400 chars' }),
    }),
    signoff: z.object({ text: z.string().min(1) }),
    dropped: z.array(
      z.object({
        title: z.string().min(1),
        url: z.url(),
        agent: z.string().min(1),
        reason: z.string().min(1),
      }),
    ),
    prev: z.string().nullable(),
    next: z.string().nullable(),
  })
  .superRefine((e, ctx) => {
    const fail = (msg: string) => ctx.addIssue({ code: 'custom', message: msg });

    // stats reconcile
    if (e.stats.kept !== e.stats.proposed - e.stats.dropped + e.stats.hand)
      fail(`kept (${e.stats.kept}) != proposed (${e.stats.proposed}) - dropped (${e.stats.dropped}) + hand (${e.stats.hand})`);

    const items = e.sections.flatMap((s) => s.items);
    if (items.length !== e.stats.kept) fail(`items.length (${items.length}) != stats.kept (${e.stats.kept})`);
    if (e.dropped.length !== e.stats.dropped) fail(`dropped[].length (${e.dropped.length}) != stats.dropped (${e.stats.dropped})`);
    const handCount = items.filter((i) => i.hand).length;
    if (handCount !== e.stats.hand) fail(`hand items (${handCount}) != stats.hand (${e.stats.hand})`);
    const leadCount = items.filter((i) => i.lead).length;
    if (leadCount > 1) fail(`lead: true flags at most one item; found ${leadCount}`);

    // section order + continuous numbering
    const names = e.sections.map((s) => s.name);
    const sorted = [...names].sort((a, b) => SECTION_ORDER.indexOf(a as never) - SECTION_ORDER.indexOf(b as never));
    if (names.join(',') !== sorted.join(',') || new Set(names).size !== names.length)
      fail(`sections must follow the fixed order ${SECTION_ORDER.join(' → ')}, each at most once`);
    const want = [...names].sort((a, b) => SECTION_ORDER.indexOf(a as never) - SECTION_ORDER.indexOf(b as never));
    if (want.join(',') !== names.join(',')) fail('section order is fixed: labs → sota → tools → timeline');
    items.forEach((it, idx) => {
      if (it.n !== idx + 1) fail(`items are numbered 1…n continuously across the issue: position ${idx + 1} has n=${it.n}`);
    });

    // body word count
    const body = [
      e.intro,
      ...items.map((i) => `${i.title} ${i.why}`),
      e.signal?.text ?? '',
      e.fleet.text,
      e.signoff.text,
    ]
      .join(' ')
      .trim();
    const words = body.split(/\s+/).filter(Boolean).length;
    if (words >= 600) fail(`issue body is ${words} words; the ceiling is 600`);

    // dates
    if (e.prev === e.date) fail('prev must not be the issue date');
    if (e.next === e.date) fail('next must not be the issue date');
  });

export type IssueEntry = z.infer<typeof issueSchema>;
