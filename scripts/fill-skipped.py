#!/usr/bin/env python3
"""record gap days in src/data-live/skipped.json so the calendar invariant holds.
every date from the first live issue to YESTERDAY (utc) is an issue or a skipped day.
saturdays/sundays get an honest weekend reason; other gaps say the pipeline produced nothing.
dates with a pending draft in src/data-live/drafts/ are left alone. idempotent. usage: fill-skipped.py [--today YYYY-MM-DD]"""
import argparse, datetime as dt, json, pathlib

root = pathlib.Path(__file__).resolve().parent.parent
live = root / "src" / "data-live"
ap = argparse.ArgumentParser()
ap.add_argument("--today", default=dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d"))
a = ap.parse_args()

issues = sorted(p.stem for p in (live / "issues").glob("*.json"))
if not issues:
    raise SystemExit("no live issue yet: nothing to fill")
sk_path = live / "skipped.json"
sk = json.loads(sk_path.read_text())
days = sk.setdefault("days", {})
drafts = {p.name[:10] for p in (live / "drafts").glob("????-??-??.json")}
d = dt.date.fromisoformat(issues[0])
end = dt.date.fromisoformat(a.today) - dt.timedelta(days=1)  # today's issue may not exist yet
added = []
while d <= end:
    s = d.isoformat()
    if s not in issues and s not in days and s not in drafts:
        if d.weekday() >= 5:
            reason = "weekend: the veille rail polls on weekdays only, so there is no issue."
        else:
            reason = "the pipeline did not assemble an issue for this date."
        days[s] = {"reason": reason}
        added.append(s)
    d += dt.timedelta(days=1)
sk["days"] = dict(sorted(days.items()))
sk_path.write_text(json.dumps(sk, indent=2, ensure_ascii=False) + "\n")
print("added:", added or "none")
