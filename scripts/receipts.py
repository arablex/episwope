#!/usr/bin/env python3
"""
Vigilo "lead-time receipts" — the accumulating, hard-to-copy proof asset.

For each signal the engine is tracking, computes how LONG it's been tracked
(from the earliest baseline observation) and how broadly it's corroborated
(source count, observations). This is honest detection lead-time — "we've been
watching X for N days across M sources" — NOT a claim of a confirmed outcome.

Reads public/signals_history.json → writes public/receipts.json.
"""
import json
from pathlib import Path
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parent.parent
PUB  = ROOT / "public"

def load(p, d):
    try: return json.load(open(p))
    except Exception: return d

def main():
    sh   = load(PUB/"signals_history.json", {})
    base = sh.get("baseline", {}) or {}
    act  = sh.get("active_signals", {}) or {}
    now  = datetime.now(timezone.utc)

    receipts = []
    for key, sig in act.items():
        obs = base.get(key, [])
        if not obs:
            continue
        try:
            first = datetime.fromisoformat(obs[0]["ts"])
        except Exception:
            continue
        days = (now - first).total_seconds() / 86400
        country = sig.get("country") or "Global"
        if country in ("XX", ""):
            country = "Global"
        receipts.append({
            "disease":      sig.get("disease") or key,
            "country":      country,
            "iso":          sig.get("iso") or "XX",
            "first_seen":   obs[0]["ts"][:10],
            "days_tracked": round(days, 1),
            "observations": len(obs),
            "source_count": sig.get("source_count", 0),
            "level":        sig.get("level", "watch"),
            "confidence":   round(sig.get("confidence", 0), 2),
            "spike_ratio":  sig.get("spike_ratio"),
        })

    # Most-corroborated, longest-tracked first.
    receipts.sort(key=lambda r: (r["days_tracked"], r["source_count"]), reverse=True)

    out = {
        "meta": {
            "generated_at": now.isoformat(),
            "note": "Detection lead-time — how long/broadly the engine has tracked each signal. Not a claim of confirmed outcomes.",
            "tracked": len(receipts),
        },
        "receipts": receipts[:10],
    }
    (PUB/"receipts.json").write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    print(f"receipts={len(receipts)} top={receipts[0]['disease'] if receipts else '-'}")

if __name__ == "__main__":
    main()
