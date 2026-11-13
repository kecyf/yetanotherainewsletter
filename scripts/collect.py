#!/usr/bin/env python3
"""yaan collector: read-only bundle of public-safe brain pins + digests for one date.

usage: scripts/collect.py --date 2026-11-13 [--days 1]

prints ONE JSON object on stdout:
  date, window, counts{candidates,new,landed}, items[], digests{veille_sota,
  model_decisions,github_watch}, excluded_sources{}, digest_slugs{}

read-only: every query goes through `brainpsql -At -c <select>`; the script has no
write path. every query is bounded (limit) and filtered on workspace slug
'connivence' through the workspace_records -> workspace_objects -> workspaces join.

public-safe sources (Kevin forbids private curation sources on the public site):
  - source 'veille'          lab blogs + releases (OpenAI, Anthropic, xAI, Cursor, Agno)
  - source 'github-trending' public weekly trending repos
  - source 'agent' ONLY when the url is https, the tags include 'arxiv' (paper) or
    'labs-news' (lab item), the host is not x.com/twitter.com, and no tag shows a
    private lineage (bookmark / notion / stars)
never included: x-bookmark, notion, manual*, github-stars (asserted below).
"""
import argparse
import datetime as dt
import json
import re
import subprocess
import sys

WORKSPACE = 'connivence'
BODY_CAP = 6000
DESC_CAP = 600
ITEM_LIMIT = 200

PUBLIC_SOURCES = ('veille', 'github-trending')
FORBIDDEN_SOURCES = ('x-bookmark', 'notion', 'github-stars')  # plus anything starting with 'manual'
PRIVATE_TAG_RE = r'bookmark|notion|stars'

JOIN = (
    "from workspace_records r "
    "join workspace_objects o on o.id = r.object_id "
    "join workspaces w on w.id = o.workspace_id "
    f"where w.slug = '{WORKSPACE}' and o.slug = '%s' and r.archived_at is null"
)

# one predicate, used for both the selection and the "excluded" tally
PUBLIC_PRED = (
    "(r.values->>'source' in ('veille','github-trending') "
    "or (r.values->>'source' = 'agent' "
    "and r.values->>'url' like 'https://%' "
    "and r.values->>'url' !~* '^https://(www\\.)?(x|twitter)\\.com/' "
    "and (r.values->'tags' ? 'arxiv' or r.values->'tags' ? 'labs-news'))) "
    f"and not exists (select 1 from jsonb_array_elements_text(r.values->'tags') t where t ~* '{PRIVATE_TAG_RE}')"
)


def sql(query):
    if not re.match(r'\s*select\b', query, re.I):
        raise SystemExit('collect.py is read-only: select statements only')
    p = subprocess.run(['brainpsql', '-At', '-c', query], capture_output=True, text=True, timeout=60)
    if p.returncode != 0:
        raise SystemExit(f'brainpsql failed: {p.stderr.strip()[:300]}')
    return p.stdout.strip()


def sql_json(query):
    out = sql(f"select coalesce(json_agg(t), '[]'::json) from ({query}) t")
    return json.loads(out) if out else []


def valid_date(s):
    try:
        return dt.date.fromisoformat(s)
    except ValueError:
        raise SystemExit(f'invalid date: {s!r} (want YYYY-MM-DD)')


def digest_body(slug):
    rows = sql_json(
        f"select left(r.body, {BODY_CAP}) as body " + (JOIN % 'docs') + f" and r.slug = '{slug}' limit 1"
    )
    return rows[0]['body'] if rows else None


def digest_counts(body):
    """candidates / new / landed from the '## Counts' table of a veille digest."""
    out = {}
    if not body:
        return out
    for key, pat in (('candidates', r'^\|\s*Candidates\s*\|\s*(\d+)'),
                     ('new', r'^\|\s*New[^|]*\|\s*(\d+)'),
                     ('landed', r'^\|\s*Landed\s*\|\s*(\d+)')):
        m = re.search(pat, body, re.M)
        if m:
            out[key] = int(m.group(1))
    return out


def strip_private_github_rows(body):
    """the github-watch digest also lists starred repos (a private source): keep trending only."""
    if body is None:
        return None
    keep = []
    for line in body.splitlines():
        if re.match(r'^\|\s*`[^`]*`\s*\|\s*star\s*\|', line):
            continue
        if re.match(r'^\|\s*Stars\b', line):
            continue
        keep.append(line)
    return '\n'.join(keep)


def latest_digest(prefix, suffix, upto, probe_days=14):
    """exact date first, then the newest earlier one within probe_days (for the slug)."""
    for back in range(probe_days + 1):
        d = (upto - dt.timedelta(days=back)).isoformat()
        slug = f'{prefix}{d}{suffix}'
        body = digest_body(slug)
        if body is not None:
            return slug, body
    return None, None


def main():
    ap = argparse.ArgumentParser(description=(__doc__ or "").split('\n')[0])
    ap.add_argument('--date', required=True)
    ap.add_argument('--days', type=int, default=1)
    a = ap.parse_args()
    end = valid_date(a.date)
    if not 1 <= a.days <= 14:
        raise SystemExit('--days must be 1..14')
    start = end - dt.timedelta(days=a.days - 1)
    s, e = start.isoformat(), end.isoformat()

    # pins in the window, public-safe only. window key = record created_at (UTC date);
    # veille pins carry the same date in their daily-YYYY-MM-DD tag.
    rows = sql_json(
        "select r.slug as pin_slug, r.values->>'title' as title, r.values->>'url' as url, "
        "r.values->>'source' as source, "
        f"left(coalesce(r.values->>'short_description', ''), {DESC_CAP}) as short_description, "
        "coalesce(r.values->'tags', '[]'::jsonb) as tags, "
        "coalesce(r.values->>'published_at', r.values->'raw'->>'published') as published_at, "
        "r.created_at::date::text as created "
        + (JOIN % 'pins')
        + f" and r.created_at::date between '{s}' and '{e}' and {PUBLIC_PRED} "
        + f"order by r.created_at desc, r.slug limit {ITEM_LIMIT}"
    )
    items, seen = [], set()
    for row in rows:
        src = row['source']
        assert src not in FORBIDDEN_SOURCES and not (src or '').startswith('manual'), f'forbidden source leaked: {src}'
        assert src in PUBLIC_SOURCES or src == 'agent', f'unexpected source: {src}'
        assert not any(re.search(PRIVATE_TAG_RE, t, re.I) for t in row['tags']), f'private tag leaked on {row["pin_slug"]}'
        url = row['url']
        if not url or not url.startswith('https://') or url in seen:
            continue
        seen.add(url)
        items.append({
            'title': row['title'], 'url': url, 'source': src,
            'short_description': row['short_description'], 'tags': row['tags'],
            'published_at': row['published_at'], 'pin_slug': row['pin_slug'],
        })

    # what was left out in this window, by source (all pins in the window, not only public-safe)
    excluded = {}
    for r in sql_json(
        "select coalesce(r.values->>'source', '(none)') as source, count(*) as n "
        + (JOIN % 'pins')
        + f" and r.created_at::date between '{s}' and '{e}' and not ({PUBLIC_PRED}) group by 1 order by 2 desc limit 50"
    ):
        excluded[r['source']] = r['n']

    # digests: newest digest at or before the date; counts summed over the window days
    slugs, bodies = {}, {}
    slugs['veille_sota'], bodies['veille_sota'] = latest_digest('digest-veille-sota-daily-', '-v0', end)
    slugs['model_decisions'], bodies['model_decisions'] = latest_digest('digest-model-decisions-', '', end)
    # github watch: exact date only (a stale watch is not news for this date)
    gslug = f'digest-github-watch-{e}-v0'
    gbody = digest_body(gslug)
    slugs['github_watch'] = gslug if gbody is not None else None
    bodies['github_watch'] = strip_private_github_rows(gbody)

    counts = {'candidates': 0, 'new': 0, 'landed': 0}
    for i in range(a.days):
        d = (end - dt.timedelta(days=i)).isoformat()
        c = digest_counts(digest_body(f'digest-veille-sota-daily-{d}-v0'))
        for k in counts:
            counts[k] += c.get(k, 0)

    bundle = {
        'date': e,
        'window': {'from': s, 'to': e, 'days': a.days, 'basis': 'pin created_at, UTC date'},
        'counts': counts,
        'items': items,
        'digests': bodies,
        'excluded_sources': excluded,
        'digest_slugs': slugs,
    }
    json.dump(bundle, sys.stdout, ensure_ascii=False, indent=2)
    sys.stdout.write('\n')


if __name__ == '__main__':
    main()
