"""
retro_case.py — Retrospective lead-time proof for the B2B sales pitch.

Claim under test: GenBank sequence-submission velocity rises *before* the
WHO public declaration for novel-strain outbreaks. We measure it with
REAL NCBI Entrez data — no fabricated numbers (a fake lead time would be
worse than none for a paid product).

Method (reproducible by any technical buyer):
  NCBI Entrez esearch, db=nuccore, datetype=pdat (publication/release
  date), weekly buckets ±8 weeks around the WHO declaration date.
  Lead time = first week whose submission count exceeds
  (baseline_mean + 2*baseline_sd) and is >= MIN_SPIKE, minus the WHO
  declaration week.

Outputs:
  docs/retro-case.json   — machine-readable evidence
  docs/retro-case.md     — sales one-pager
"""

from __future__ import annotations

import json
import sys
import time
import urllib.request
import urllib.parse
from pathlib import Path
from datetime import date, timedelta

OUT_DIR = Path(__file__).parent.parent / "docs"
NCBI = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
MIN_SPIKE = 3          # ignore noise below this absolute count
WEEKS_BEFORE = 8
WEEKS_AFTER = 4

# Verifiable public WHO declaration dates.
CASES = [
    {
        "name": "Marburg virus disease — Rwanda 2024",
        "term": "Marburgvirus[Organism]",
        "who_declared": date(2024, 9, 27),
        "who_ref": "WHO Disease Outbreak News, 27 Sep 2024 (Rwanda first-ever MVD outbreak)",
    },
    {
        "name": "Mpox clade I — DRC / PHEIC 2024",
        "term": "Monkeypox+virus[Organism]",
        "who_declared": date(2024, 8, 14),
        "who_ref": "WHO PHEIC declaration, 14 Aug 2024 (mpox upsurge, clade I)",
    },
    {
        "name": "H5N1 avian influenza — US dairy cattle 2024",
        "term": "H5N1[All+Fields]+AND+influenza[All+Fields]",
        "who_declared": date(2024, 4, 1),
        "who_ref": "USDA/CDC confirmation of H5N1 in dairy cattle, late Mar–Apr 2024",
    },
]


def _esearch_count(term: str, d0: date, d1: date) -> int | None:
    q = (f"{NCBI}?db=nuccore&term={term}"
         f"&datetype=pdat&mindate={d0:%Y/%m/%d}&maxdate={d1:%Y/%m/%d}"
         f"&retmode=json&retmax=0")
    try:
        req = urllib.request.Request(q, headers={"User-Agent": "vigilo-retro/1.0"})
        with urllib.request.urlopen(req, timeout=25) as r:
            data = json.loads(r.read())
        return int(data.get("esearchresult", {}).get("count", 0))
    except Exception as e:
        print(f"  NCBI error ({d0}..{d1}): {e}")
        return None


def analyze(case: dict) -> dict:
    who = case["who_declared"]
    start = who - timedelta(weeks=WEEKS_BEFORE)
    weeks = []
    for i in range(WEEKS_BEFORE + WEEKS_AFTER):
        w0 = start + timedelta(weeks=i)
        w1 = w0 + timedelta(days=6)
        c = _esearch_count(case["term"], w0, w1)
        weeks.append({"week_start": w0.isoformat(), "count": c})
        print(f"  {case['name'][:28]:28} {w0} : {c}")
        time.sleep(0.4)  # NCBI courtesy rate

    counts = [w["count"] for w in weeks if w["count"] is not None]
    who_idx = WEEKS_BEFORE  # index of the WHO-declaration week
    pre = [w["count"] for w in weeks[:max(who_idx - 2, 1)]
           if w["count"] is not None]
    base_mean = sum(pre) / len(pre) if pre else 0.0
    base_sd = (sum((x - base_mean) ** 2 for x in pre) / len(pre)) ** 0.5 if pre else 0.0
    threshold = max(base_mean + 2 * base_sd, MIN_SPIKE)

    spike_week = None
    for i, w in enumerate(weeks):
        if w["count"] is not None and w["count"] >= threshold and i < who_idx:
            spike_week = i
            break

    lead_days = None
    if spike_week is not None:
        spike_date = date.fromisoformat(weeks[spike_week]["week_start"])
        lead_days = (who - spike_date).days

    return {
        "case": case["name"],
        "who_declared": who.isoformat(),
        "who_ref": case["who_ref"],
        "ncbi_term": case["term"],
        "baseline_mean": round(base_mean, 2),
        "alert_threshold": round(threshold, 2),
        "weeks": weeks,
        "spike_detected_week": (weeks[spike_week]["week_start"]
                                if spike_week is not None else None),
        "lead_time_days": lead_days,
        "data_complete": len(counts) == len(weeks),
    }


def render_md(results: list[dict]) -> str:
    L = ["# Vigilo — Retrospective Lead-Time Proof",
         "",
         "_Generated from live NCBI GenBank data. Reproducible: see method "
         "in `scripts/retro_case.py`._",
         "",
         "**Claim:** for novel-strain outbreaks, genomic sequence submissions "
         "to GenBank accelerate *before* the WHO public declaration — a "
         "leading indicator no media-only competitor captures.",
         ""]
    proven = [r for r in results if r["lead_time_days"] and r["lead_time_days"] > 0]
    for r in results:
        L += [f"## {r['case']}", ""]
        if r["lead_time_days"] and r["lead_time_days"] > 0:
            L.append(f"**Lead time: GenBank submission spike detected "
                     f"{r['lead_time_days']} days before** the WHO declaration "
                     f"({r['who_declared']}).")
        elif r["data_complete"]:
            L.append(f"No pre-declaration spike above threshold "
                     f"(WHO {r['who_declared']}). Conservative result reported "
                     f"as-is — we do not overclaim.")
        else:
            L.append("Partial NCBI data this run (rate limit); re-run for a "
                     "complete series.")
        L += ["",
              f"- WHO reference: {r['who_ref']}",
              f"- NCBI term: `{r['ncbi_term']}`",
              f"- Baseline mean: {r['baseline_mean']} seq/wk · "
              f"alert threshold: {r['alert_threshold']}",
              f"- Spike week: {r['spike_detected_week'] or '—'}",
              ""]
    if proven:
        avg = round(sum(r["lead_time_days"] for r in proven) / len(proven))
        L = L[:1] + [f"", f"> **{len(proven)}/{len(results)} cases proven · "
                     f"average lead time {avg} days ahead of WHO.**", ""] + L[1:]
    L += ["---",
          "_Vigilo Risk Intelligence · methodology available under NDA for "
          "enterprise partners · not medical advice._"]
    return "\n".join(L)


def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print("=== Retro-case: querying live NCBI GenBank ===")
    results = [analyze(c) for c in CASES]
    (OUT_DIR / "retro-case.json").write_text(
        json.dumps({"generated": date.today().isoformat(), "results": results},
                   indent=2), encoding="utf-8")
    (OUT_DIR / "retro-case.md").write_text(render_md(results), encoding="utf-8")
    proven = [r for r in results if r["lead_time_days"] and r["lead_time_days"] > 0]
    print(f"=== Done: {len(proven)}/{len(results)} cases with positive lead time ===")
    for r in results:
        print(f"  {r['case'][:40]:40} lead={r['lead_time_days']}d "
              f"complete={r['data_complete']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
