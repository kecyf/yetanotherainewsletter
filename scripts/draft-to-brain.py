#!/usr/bin/env python3
"""store a drafted issue in the Lumi brain (docs, status draft) so approval has an auditable record.
usage: draft-to-brain.py YYYY-MM-DD   (reads src/data-live/drafts/D.json). insert-or-update by slug. needs brainpsql."""
import json, pathlib, subprocess, sys, tempfile

root = pathlib.Path(__file__).resolve().parent.parent
d = sys.argv[1]
status = sys.argv[2] if len(sys.argv) > 2 else "draft"
src = root / "src/data-live/drafts" / f"{d}.json"
if not src.exists():
    src = root / "src/data-live/issues" / f"{d}.json"
draft = json.loads(src.read_text())
slug = f"yaan-issue-draft-{d}"
kept = [i for s in draft["sections"] for i in s["items"]]
lines = [f"# yaan issue {draft['issue']} draft ({d})", "", f"subject: {draft['subject']}", "",
         f"stats: {json.dumps(draft['stats'])}", "", "kept:"]
lines += [f"- {i['title']} — {i['url']}" for i in kept]
lines += ["", "dropped:"] + [f"- {i['title']} — {i['reason']}" for i in draft["dropped"]]
lines += ["", "approve: scripts/approve.sh " + d, "", "```json", json.dumps(draft, indent=2, ensure_ascii=False), "```"]
body = "\n".join(lines)
sql = f"""
with o as (select o.id from workspace_objects o join workspaces w on w.id=o.workspace_id where w.slug='connivence' and o.slug='docs'),
upd as (update workspace_records r set values = r.values || jsonb_build_object('title', $t${draft['subject'][:70]}$t$, 'status','{status}', 'body', $b${body}$b$), updated_at=now()
        from o where r.object_id=o.id and r.values->>'slug'='{slug}' and r.archived_at is null returning r.id)
insert into workspace_records (object_id, "values") select o.id, jsonb_build_object('slug','{slug}','title',$t${draft['subject'][:70]}$t$,'kind','issue-draft','status','{status}','body',$b${body}$b$)
from o where not exists (select 1 from upd) returning id;
"""
with tempfile.NamedTemporaryFile("w", suffix=".sql", delete=False) as f:
    f.write(sql)
r = subprocess.run(["brainpsql", "-At", "-v", "ON_ERROR_STOP=1", "-f", f.name], capture_output=True, text=True)
print(r.stdout.strip() or "updated existing draft", r.stderr.strip()[:300])
sys.exit(r.returncode)
