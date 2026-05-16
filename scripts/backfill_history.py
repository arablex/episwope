#!/usr/bin/env python3
"""
One-time (re-runnable) backfill of public/history.json from the git history
of public/events.json.

Walks every commit that touched public/events.json, reconstructs the daily
severity aggregate for that commit's UTC date (latest commit per date wins),
and merges it into history.json WITHOUT clobbering existing/newer days.

Safe to run repeatedly. Pipeline build_history() keeps extending it forward.

    python3 scripts/backfill_history.py
"""
import json, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
HIST = ROOT / "public" / "history.json"
HISTORY_MAX_DAYS = 365

_BUCKET = {"critical": "c", "alert": "a", "warning": "w",
           "monitoring": "m", "low": "m"}

def _add(d, sev):
    b = _BUCKET.get(sev, "m")
    d[b] = d.get(b, 0) + 1
    d["t"] = d.get("t", 0) + 1

def aggregate(events):
    g, countries, diseases = {}, {}, {}
    for e in events:
        sev = e.get("severity", "monitoring")
        _add(g, sev)
        c = (e.get("country") or "").strip()
        if c:
            _add(countries.setdefault(c, {}), sev)
        dis = (e.get("disease") or "").strip()
        if dis:
            _add(diseases.setdefault(dis, {}), sev)
    return {"g": g, "countries": countries, "diseases": diseases}

def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True)

def main():
    # commit hash + committer date (UTC, ISO) for each events.json change, old→new
    log = git("log", "--reverse", "--date=format-local:%Y-%m-%d",
              "--format=%H|%cd", "--", "public/events.json").strip().splitlines()
    if not log:
        print("no git history for public/events.json")
        return

    existing = {}
    if HIST.exists():
        try:
            existing = json.loads(HIST.read_text(encoding="utf-8")).get("daily", {})
        except Exception:
            existing = {}

    rebuilt = {}
    for line in log:
        h, date = line.split("|", 1)
        try:
            blob = git("show", f"{h}:public/events.json")
            events = json.loads(blob).get("events", [])
        except Exception:
            continue
        # latest commit for a given date wins (loop is old→new)
        rebuilt[date] = aggregate(events)

    # merge: keep existing days, fill gaps + (re)seed days we reconstructed.
    # existing newer pipeline data is preserved; backfill only adds history.
    merged = dict(rebuilt)
    merged.update(existing)  # existing wins on conflict (it's the live pipeline's)

    keys = sorted(merged)
    if len(keys) > HISTORY_MAX_DAYS:
        for k in keys[:-HISTORY_MAX_DAYS]:
            merged.pop(k, None)

    out = {
        "meta": {
            "updated_at": __import__("datetime").datetime.now(
                __import__("datetime").timezone.utc).isoformat(),
            "days": len(merged),
            "from": min(merged) if merged else None,
            "to": max(merged) if merged else None,
            "backfilled_from_git": True,
        },
        "daily": merged,
    }
    HIST.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")),
                    encoding="utf-8")
    print(f"✓ history.json — {len(merged)} day(s) "
          f"[{out['meta']['from']} → {out['meta']['to']}] "
          f"({len(rebuilt)} reconstructed from git, {len(existing)} kept)")

if __name__ == "__main__":
    sys.exit(main())
