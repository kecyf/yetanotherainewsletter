#!/usr/bin/env python3
"""yaan KB exporter: brain -> committed JSON snapshots under src/data-live/kb/.

usage:
  scripts/export-kb.py --date 2026-11-13          one day (pool + signals; pareto if that day has a doc)
  scripts/export-kb.py --since 2026-09-28         backfill every day from that date to today (UTC)
  scripts/export-kb.py --since 2026-09-28 --to 2026-11-13
  scripts/export-kb.py --date D --dry-run         print what would be written, write nothing

writes (deterministic: sorted keys, stable order, no generation timestamp, idempotent):
  src/data-live/kb/pool/D.json            every public-safe pin of that UTC day, with status kept/dropped/unreviewed
  src/data-live/kb/models/signals/D.json  the model-market signals of the day's digest (OpenRouter catalog diff)
  src/data-live/kb/models/pareto.json     the latest price x quality Pareto table (public sources only)

safety (same rules as collect.py, which this file imports for the SQL predicate):
  - read-only: `brainpsql -At -c <select>` only, every query bounded, workspace slug 'connivence' join.
  - pool pins: source 'veille' | 'github-trending' | filtered 'agent' (https, arxiv/labs-news tag, not x.com,
    no bookmark/notion/stars tag). x-bookmark, notion, manual*, github-stars are asserted out.
  - no brain id, no pin slug, no pin body, no steward/watch field leaves this script: title, url, short
    description, tags, dates only. tags are scrubbed of internal workflow labels (triage, topic-, pack-, lumi...).
  - descriptions that mention internal vocabulary are dropped (null), never rewritten.
  - the model digests and the Pareto doc are built from public sources (OpenRouter catalog, OpenRouter /benchmarks
    with Artificial Analysis, LMArena CC-BY-4.0); the Pareto doc must state those sources or nothing is written.
"""
import argparse
import datetime as dt
import hashlib
import importlib.util
import json
import re
import sys
from decimal import Decimal, InvalidOperation
from pathlib import Path

sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parent.parent
KB = ROOT / 'src' / 'data-live' / 'kb'
ISSUES = ROOT / 'src' / 'data-live' / 'issues'
STATE_FILE = Path.home() / '.hermes' / 'state' / 'model-decisions.json'

_spec = importlib.util.spec_from_file_location('collect', ROOT / 'scripts' / 'collect.py')
collect = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(collect)

DAY_LIMIT = 200
DESC_MAX = 280
PUBLIC_SOURCES = ('veille', 'github-trending', 'agent')
FORBIDDEN_SOURCES = ('x-bookmark', 'notion', 'github-stars')

# internal workflow labels that must never be published as tags (checked again in check-kb.mjs)
INTERNAL_TAG_RE = re.compile(
    r'^(pin|veille|connivence|lumi.*|brain|raw-brain|pstack|ssot|seat-config|team-bots|shared-bots|usage-pool|'
    r'pin-lifecycle|fleet.*|handoff-notes|builder-target|thin-watch|q-p|qp|hold|baseline|unverified|claims-unverified|'
    r'awaiting-triage|awaiting_primary|enrich.*|enriched|disposition-.*|pack-.*|topic-.*|triage.*|triaged.*|daily-.*|'
    r'backfill.*|research_backfill|data-reviewed-.*|accc-.*|steward.*|friday-brief.*|kevin.*|project-state|'
    r'intent_pending|watch_ga|xbm_.*|oss-scanner-peer|cursorbench-adjacent|compliance-watch|daybreak|dots|'
    r'ownership-change|mou|aim)$',
    re.I,
)
TAG_OK_RE = re.compile(r'^[a-z0-9][a-z0-9.+-]{0,39}$')
DATE_TAG_RE = re.compile(r'^\d{4}(-\d{2}(-\d{2})?)?$')
# internal vocabulary: a description that matches is dropped (null)
INTERNAL_TEXT_RE = re.compile(
    r'\b(brain|kevin|lumi|connivence|cron|steward|triage[ds]?|veille|seat|vault|tailnet|casa-gate|siena|emman|pstack|'
    r'ssot|enrich\w*|first-notice|not previously in|disposition)\b|\.hermes|/home/|~/',
    re.I,
)


def die(msg):
    raise SystemExit(f'export-kb: {msg}')


def dump(path, obj, dry):
    text = json.dumps(obj, indent=2, ensure_ascii=False, sort_keys=True) + '\n'
    if dry:
        print(f'[dry-run] {path.relative_to(ROOT)} ({len(text)} bytes)')
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists() and path.read_text() == text:
        return False
    path.write_text(text)
    return True


def sql_quote(s):
    return "'" + s.replace("'", "''") + "'"


def domain_of(url):
    m = re.match(r'https://([^/?#]+)', url, re.I)
    host = m.group(1).lower() if m else ''
    return host[4:] if host.startswith('www.') else host


def norm_url(u):
    return u.split('#')[0].rstrip('/')


# ----------------------------------------------------------------------------------------------------------
# pool
# ----------------------------------------------------------------------------------------------------------

def load_issue_status():
    """url -> ('kept', item_id, None) | ('dropped', None, reason). kept wins over dropped."""
    out = {}
    for f in sorted(ISSUES.glob('*.json')):
        j = json.loads(f.read_text())
        if j.get('fixture'):
            continue
        for s in j['sections']:
            for it in s['items']:
                out[norm_url(it['url'])] = ('kept', f"{j['date']}#{it['n']}", None)
        for d in j['dropped']:
            out.setdefault(norm_url(d['url']), ('dropped', None, d['reason']))
    return out


def clean_tags(tags):
    out = set()
    for t in tags or []:
        t = str(t).strip().lower()
        if not t or INTERNAL_TAG_RE.match(t) or DATE_TAG_RE.match(t) or not TAG_OK_RE.match(t):
            continue
        out.add(t)
    return sorted(out)


def clean_desc(desc, title):
    d = re.sub(r'\s+', ' ', (desc or '')).strip()
    if not d or d.lower() == re.sub(r'\s+', ' ', (title or '')).strip().lower():
        return None
    if INTERNAL_TEXT_RE.search(d):
        return None
    if len(d) > DESC_MAX:
        cut = d[:DESC_MAX].rsplit(' ', 1)[0].rstrip(' ,;:.-')
        d = cut + '…'
    return d


def clean_published(p):
    if not p:
        return None
    p = str(p).strip()
    if re.fullmatch(r'\d{4}-\d{2}-\d{2}', p):
        try:
            dt.date.fromisoformat(p)
            return p
        except ValueError:
            return None
    try:
        t = dt.datetime.fromisoformat(p.replace('Z', '+00:00'))
    except ValueError:
        return None
    if t.tzinfo is None:
        t = t.replace(tzinfo=dt.timezone.utc)
    return t.astimezone(dt.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def fetch_pins(day):
    return collect.sql_json(
        "select r.values->>'title' as title, r.values->>'url' as url, r.values->>'source' as source, "
        "coalesce(r.values->'tags', '[]'::jsonb) as tags, "
        f"left(coalesce(r.values->>'short_description', ''), 600) as short_description, "
        "coalesce(r.values->>'published_at', r.values->'raw'->>'published') as published_at "
        + (collect.JOIN % 'pins')
        + f" and (r.created_at at time zone 'UTC')::date = '{day}' and {collect.PUBLIC_PRED} "
        + f"order by r.created_at, r.values->>'url' limit {DAY_LIMIT}"
    )


def earlier_urls(urls, day):
    """urls already pinned (public-safe) on an earlier UTC day: a url belongs to its first day only."""
    if not urls:
        return set()
    lst = ','.join(sql_quote(u) for u in urls)
    rows = collect.sql_json(
        "select distinct r.values->>'url' as url "
        + (collect.JOIN % 'pins')
        + f" and (r.created_at at time zone 'UTC')::date < '{day}' and {collect.PUBLIC_PRED} "
        + f"and r.values->>'url' in ({lst}) limit {DAY_LIMIT}"
    )
    return {r['url'] for r in rows}


def build_pool(day, status_map):
    rows = fetch_pins(day)
    if len(rows) >= DAY_LIMIT:
        die(f'{day}: pool hit the {DAY_LIMIT} row bound, raise DAY_LIMIT deliberately')
    dup = earlier_urls([r['url'] for r in rows if r['url']], day)
    entries, seen = [], set()
    for r in rows:
        src = r['source']
        assert src not in FORBIDDEN_SOURCES and not (src or '').startswith('manual'), f'forbidden source leaked: {src}'
        assert src in PUBLIC_SOURCES, f'unexpected source: {src}'
        assert not any(re.search(collect.PRIVATE_TAG_RE, t, re.I) for t in r['tags']), 'private tag leaked'
        url = r['url']
        if not url or not url.startswith('https://') or url in seen or url in dup:
            continue
        seen.add(url)
        st = status_map.get(norm_url(url))
        status, item_id, reason = st if st else ('unreviewed', None, None)
        entries.append({
            'id': 'p_' + hashlib.sha1(url.encode()).hexdigest()[:12],
            'date': day,
            'title': re.sub(r'\s+', ' ', r['title'] or '').strip(),
            'url': url,
            'source_domain': domain_of(url),
            'source': src,
            'published_at': clean_published(r['published_at']),
            'short_description': clean_desc(r['short_description'], r['title']),
            'tags': clean_tags(r['tags']),
            'status': status,
            'reason': reason,
            'item_id': item_id,
        })
    entries.sort(key=lambda e: (e['source'], e['url']))
    return {'date': day, 'entries': entries}


# ----------------------------------------------------------------------------------------------------------
# model signals
# ----------------------------------------------------------------------------------------------------------

def per_mtok(v):
    """OpenRouter per-token price string -> USD per 1M tokens, as an exact-looking number."""
    try:
        x = (Decimal(v) * 1000000).normalize()
    except (InvalidOperation, TypeError):
        return None
    f = float(x)
    return int(f) if f == int(f) else f


def slugify(s):
    s = re.sub(r'\(([^)]*)\)', r'\1', s.lower())
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9.]+', '-', s)).strip('-')


def load_catalog_names():
    """name -> catalog id, only when the name is unique in the watcher's current catalog state (read-only)."""
    try:
        state = json.loads(STATE_FILE.read_text())
    except Exception:
        return {}
    by = {}
    for mid, m in (state.get('models') or {}).items():
        by.setdefault(m.get('name'), []).append(mid)
    return {n: ids[0] for n, ids in by.items() if n and len(ids) == 1}


def split_provider(name):
    if ': ' in name:
        p, n = name.split(': ', 1)
        return p.strip(), n.strip()
    return None, name.strip()


def model_ref(name, catalog):
    provider, short = split_provider(name)
    if name in catalog:
        mid, basis = catalog[name], 'catalog'
    else:
        mid = (slugify(provider) + '/' if provider else '') + slugify(short)
        basis = 'derived'
    return mid, basis, provider


SECTION_RE = re.compile(r'^(NEW|EXPIRING|PRICE MOVE|CONTEXT CHANGE) \((\d+)\)$')


def parse_digest(body, day, catalog):
    m = re.search(r'```\n(.*?)\n```', body, re.S)
    if not m:
        die(f'{day}: digest has no text block')
    block = m.group(1)
    if 'no change' in block.split('\n', 1)[0] and 'signal(s)' not in block:
        return {'date': day, 'listed': {}, 'signals': [], 'totals': {}}
    totals, sig, cur = {}, [], None
    for raw in block.split('\n'):
        line = raw.rstrip()
        h = SECTION_RE.match(line)
        if h:
            cur = {'NEW': 'new', 'EXPIRING': 'expiring', 'PRICE MOVE': 'price', 'CONTEXT CHANGE': 'context'}[h.group(1)]
            totals[cur] = int(h.group(2))
            continue
        if not cur or not line.strip():
            continue
        if cur == 'new':
            mm = re.match(r'^\s+\+ (.+?)\s{2}\((\d{4}-\d{2}-\d{2})\)$', line)
            name, details = (mm.group(1), {'created': mm.group(2)}) if mm else die(f'{day}: bad NEW line: {line!r}')
        elif cur == 'expiring':
            mm = re.match(r'^\s+! (.+?)\s{2}expires (\d{4}-\d{2}-\d{2}) \((\d+) d\)$', line)
            if not mm:
                die(f'{day}: bad EXPIRING line: {line!r}')
            name, details = mm.group(1), {'expires': mm.group(2), 'days_left': int(mm.group(3))}
        elif cur == 'price':
            mm = re.match(r'^\s+\$ (.+?)\s{2}prompt (\S+) -> (\S+) \| completion (\S+) -> (\S+)$', line)
            if not mm:
                die(f'{day}: bad PRICE line: {line!r}')
            name = mm.group(1)
            details = {
                'prompt_usd_per_mtok': {'from': per_mtok(mm.group(2)), 'to': per_mtok(mm.group(3))},
                'completion_usd_per_mtok': {'from': per_mtok(mm.group(4)), 'to': per_mtok(mm.group(5))},
            }
        else:
            mm = re.match(r'^\s+C (.+?)\s{2}(\d+) -> (\d+)$', line)
            if not mm:
                die(f'{day}: bad CONTEXT line: {line!r}')
            name, details = mm.group(1), {'from': int(mm.group(2)), 'to': int(mm.group(3))}
        mid, basis, provider = model_ref(name, catalog)
        sig.append({
            'id': f'{day}:{cur}:{mid}',
            'date': day,
            'type': cur,
            'model_id': mid,
            'model_id_basis': basis,
            'name': name,
            'provider': provider,
            'details': details,
            'source': 'openrouter-catalog',
        })
    listed = {}
    for s in sig:
        listed[s['type']] = listed.get(s['type'], 0) + 1
    ids = [s['id'] for s in sig]
    assert len(ids) == len(set(ids)), f'{day}: duplicate signal ids'
    order = {'new': 0, 'expiring': 1, 'price': 2, 'context': 3}
    sig.sort(key=lambda s: (order[s['type']], s['id']))
    return {'date': day, 'listed': listed, 'signals': sig, 'totals': totals}


def build_signals(day, catalog):
    rows = collect.sql_json(
        "select left(r.body, 20000) as body " + (collect.JOIN % 'docs')
        + f" and r.slug = 'digest-model-decisions-{day}' limit 1"
    )
    if not rows:
        return None
    body = rows[0]['body'] or ''
    assert 'Source: OpenRouter catalog diff' in body, f'{day}: digest does not state its public source'
    return parse_digest(body, day, catalog)


# ----------------------------------------------------------------------------------------------------------
# pareto
# ----------------------------------------------------------------------------------------------------------

PARETO_SOURCES_OK = ('openrouter', 'artificial analysis', 'lmarena')
PARETO_INTERNAL = re.compile(r'\b(seat|skill|re-pin|kevin|lumi|brain|hermes)\b', re.I)


def num(s):
    s = s.strip()
    try:
        f = float(s)
    except ValueError:
        return None
    return int(f) if f == int(f) and '.' not in s else f


def parse_pareto(body, day):
    m = re.search(r'^Sources: (.+)$', body, re.M)
    if not m:
        return None, 'doc does not state its sources'
    sources = m.group(1).strip()
    low = sources.lower()
    if not all(k in low for k in PARETO_SOURCES_OK):
        return None, 'doc sources are not all public (OpenRouter + Artificial Analysis + LMArena)'
    if re.search(r'bookmark|notion|stars|manual|private', low):
        return None, 'doc sources mention a private lineage'
    pm = re.search(r'Priced chat routes: (\d+); with a quality score: (\d+)\.(?: Coverage: ([^\n]+))?', body)
    coverage = []
    if pm and pm.group(3):
        for part in pm.group(3).split(', '):
            cm = re.match(r'^(.+?) (\d+)\.?$', part.strip())
            if cm:
                coverage.append({'metric': cm.group(1), 'scored': int(cm.group(2))})
    cats = []
    for sec in re.split(r'^## ', body, flags=re.M)[1:]:
        title_line, _, rest = sec.partition('\n')
        if title_line.strip() == 'Caveats':
            continue
        tm = re.match(r'^(.+?) - (.+?), blend (\d+):(\d+) in:out$', title_line.strip())
        if not tm:
            return None, f'unexpected section header: {title_line!r}'
        sm = re.search(r'(\d+) scored candidates; frontier (\d+); pick \((.+?)\): \*\*(.+?)\*\*', rest)
        if not sm:
            return None, f'no pick line in {title_line!r}'
        rows = []
        for line in rest.split('\n'):
            if not line.startswith('| ') or line.startswith('| model') or line.startswith('|---'):
                continue
            c = [x.strip() for x in line.strip().strip('|').split('|')]
            if len(c) != 7:
                return None, f'bad table row: {line!r}'
            extra = [x.strip() for x in c[6].split(', ') if x.strip()]
            rows.append({
                'model_id': c[0], 'score': num(c[1]), 'score_label': c[2],
                'usd_per_mtok_in': num(c[3]), 'usd_per_mtok_out': num(c[4]), 'usd_per_mtok_blended': num(c[5]),
                'notes': extra,
            })
        if len(rows) != int(sm.group(2)):
            return None, f'{title_line!r}: {len(rows)} rows != frontier {sm.group(2)}'
        cats.append({
            'title': tm.group(1), 'metric': tm.group(2),
            'blend': {'in': int(tm.group(3)), 'out': int(tm.group(4))},
            'scored_candidates': int(sm.group(1)), 'frontier_size': int(sm.group(2)),
            'pick_rule': sm.group(3), 'pick_model_id': sm.group(4), 'frontier': rows,
        })
    if not cats:
        return None, 'no category found'
    # caveats: keep sentences that do not mention internal vocabulary
    notes = []
    cav = re.search(r'^## Caveats\n(.*)$', body, re.S | re.M)
    if cav:
        for bullet in re.findall(r'^- (.+)$', cav.group(1), re.M):
            keep = [s.strip() for s in re.split(r'(?<=[.)])\s+(?=[A-Z])', bullet) if s.strip()]
            keep = [s for s in keep if not PARETO_INTERNAL.search(s)]
            if keep:
                notes.append(' '.join(keep))
    return {
        'date': day,
        'priced_routes': int(pm.group(1)) if pm else None,
        'scored_routes': int(pm.group(2)) if pm else None,
        'coverage': coverage,
        'sources': sources,
        'categories': cats,
        'notes': notes,
        'currency': 'USD',
        'unit': 'per 1M tokens',
    }, None


def build_pareto():
    rows = collect.sql_json(
        "select r.slug as slug, left(r.body, 20000) as body " + (collect.JOIN % 'docs')
        + " and r.slug like 'model-quality-pareto-%' order by r.slug desc limit 1"
    )
    if not rows:
        return None, 'no model-quality-pareto doc in the brain'
    day = rows[0]['slug'].rsplit('model-quality-pareto-', 1)[1]
    dt.date.fromisoformat(day)
    return parse_pareto(rows[0]['body'] or '', day)


# ----------------------------------------------------------------------------------------------------------

def daterange(a, b):
    d = a
    while d <= b:
        yield d
        d += dt.timedelta(days=1)


def main():
    ap = argparse.ArgumentParser(description=(__doc__ or '').split('\n')[0])
    ap.add_argument('--date')
    ap.add_argument('--since')
    ap.add_argument('--to')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--no-pareto', action='store_true')
    a = ap.parse_args()
    if bool(a.date) == bool(a.since):
        die('give exactly one of --date or --since')
    today = dt.datetime.now(dt.timezone.utc).date()
    if a.date:
        start = end = collect.valid_date(a.date)
    else:
        start, end = collect.valid_date(a.since), collect.valid_date(a.to) if a.to else today
    if end < start or (end - start).days > 400:
        die('bad date range')

    status_map = load_issue_status()
    catalog = load_catalog_names()
    wrote = {'pool': 0, 'signals': 0}
    summary = []
    for d in daterange(start, end):
        day = d.isoformat()
        pool = build_pool(day, status_map)
        if pool['entries']:
            if dump(KB / 'pool' / f'{day}.json', pool, a.dry_run):
                wrote['pool'] += 1
        elif (KB / 'pool' / f'{day}.json').exists():
            print(f'note: {day} has no pins now but a snapshot exists; left untouched', file=sys.stderr)
        sg = build_signals(day, catalog)
        if sg is not None:
            if dump(KB / 'models' / 'signals' / f'{day}.json', sg, a.dry_run):
                wrote['signals'] += 1
        summary.append((day, len(pool['entries']), None if sg is None else len(sg['signals'])))

    pareto_msg = 'skipped (--no-pareto)'
    if not a.no_pareto:
        data, why = build_pareto()
        if data is None:
            pareto_msg = f'not written: {why}'
        else:
            changed = dump(KB / 'models' / 'pareto.json', data, a.dry_run)
            pareto_msg = f"{data['date']} ({'written' if changed else 'unchanged'}), {len(data['categories'])} categories"

    pool_days = sum(1 for s in summary if s[1])
    sig_days = sum(1 for s in summary if s[2] is not None)
    print(f"days {start}..{end}: pool days with pins {pool_days}, entries {sum(s[1] for s in summary)}; "
          f"signal days {sig_days}, signals {sum(s[2] or 0 for s in summary)}; files changed: {wrote}; pareto: {pareto_msg}")


if __name__ == '__main__':
    main()
