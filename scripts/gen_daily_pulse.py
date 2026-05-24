#!/usr/bin/env python3
"""
Daily Pulse — social distribution drafts from the World Pulse.

Reads public/pulse.json (+ public/receipts.json) and writes review-ready
post drafts (X/Twitter + LinkedIn) to intel/_drafts/. NOT auto-published and
NOT a thin daily SEO page — the live /intel World Pulse widget is the SEO
surface; this is distribution fuel the founder reviews (10s) and posts.
"""
import json
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent.parent
PUB  = ROOT / "public"
DRAFTS = ROOT / "intel" / "_drafts"

def load(p, d):
    try: return json.load(open(p))
    except Exception: return d

def delta_phrase(delta, short=False):
    if delta > 0:  return f"▲ +{delta} today"
    if delta < 0:  return f"▼ {delta} today"
    return "flat today"

def main():
    p = load(PUB/"pulse.json", None)
    if not p or "pulse" not in p:
        print("no pulse.json — skip"); return
    rec = load(PUB/"receipts.json", {}).get("receipts", [])
    b = p.get("breadth", {})
    hot = p.get("hotspots", [])
    date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    DRAFTS.mkdir(parents=True, exist_ok=True)

    hot3 = ", ".join(h["name"] for h in hot[:3])
    hot_full = "\n".join(f"  • {h['name']} — {h['score']:.1f}/6 ({h['band']})" for h in hot[:5])

    # ── X / Twitter (≤280) ────────────────────────────────────
    x = (
        f"🌍 Vigilo World Pulse: {p['pulse']}/100 — {p['band']}, {delta_phrase(p['delta'])}.\n"
        f"{b.get('active','?')} countries with active risk · {b.get('elevated_plus','?')} at elevated+.\n"
        f"Hotspots: {hot3}.\n"
        f"Source-traceable, from 44 feeds → vigilo.cc/intel"
    )

    # ── LinkedIn ──────────────────────────────────────────────
    early = ""
    if rec:
        # Prefer a country-specific receipt over a "Global" one — more concrete.
        r0 = next((r for r in rec if r.get("country") not in ("Global", "", None)), rec[0])
        early = (f"\nTracked early: we've been monitoring {r0['disease']} "
                 f"({r0['country']}) for {r0['days_tracked']} days across "
                 f"{r0['source_count']} sources.\n")
    li = (
        f"🌍 Today's Vigilo World Pulse: {p['pulse']}/100 — {p['band']} ({delta_phrase(p['delta'])}).\n\n"
        f"We monitor {b.get('monitored','?')} countries across 7 risk domains. "
        f"Right now {b.get('active','?')} show active risk, {b.get('elevated_plus','?')} at elevated or higher.\n\n"
        f"Today's hotspots:\n{hot_full}\n"
        f"{early}\n"
        f"Every score traces back to its public sources — no black box.\n\n"
        f"Live & free: vigilo.cc/app  ·  Briefs: vigilo.cc/intel\n\n"
        f"#riskintelligence #dutyofcare #OSINT #travelrisk"
    )

    (DRAFTS/f"pulse-x-{date}.md").write_text(x, encoding="utf-8")
    (DRAFTS/f"pulse-linkedin-{date}.md").write_text(li, encoding="utf-8")
    print(f"daily pulse drafts written for {date} (pulse {p['pulse']}, {p['band']})")

if __name__ == "__main__":
    main()
