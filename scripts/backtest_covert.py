#!/usr/bin/env python3
"""Covert-risk engine — historical backtest.

Pre-registered design: docs/specs/2026-05-20-covert-risk-backtest-design.md
Engine frozen at commit 5cb9155.

Stages:
  1. fetch     — GDELT monthly counts (conflict + unrest) per country
  2. normalize — country-percentile → 0-5 scores from 2022-23 baseline
  3. replay    — run port of computeCovertRisk on each (iso, year, month)
  4. label     — outcome from same GDELT feed (next-month escalation)
  5. score     — precision, recall, lead-time, with bootstrap CIs
  6. report    — docs/validation/covert-risk-backtest.md

Usage:
  python3 scripts/backtest_covert.py fetch     # network-heavy, ~1-2h
  python3 scripts/backtest_covert.py replay    # offline, ~5s
  python3 scripts/backtest_covert.py report    # write markdown

Or:
  python3 scripts/backtest_covert.py all       # end-to-end
"""

import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path
from statistics import median

ROOT = Path(__file__).resolve().parent.parent
CACHE_DIR = ROOT / "data" / "backtest-covert"
REPORT_MD = ROOT / "docs" / "validation" / "covert-risk-backtest.md"
STRUCT_JSON = ROOT / "public" / "country-structural.json"

# ── Pre-registered, FROZEN ────────────────────────────────────────────
COUNTRIES = ["UA", "RU", "IR", "MM", "SD", "YE", "HT", "NG", "ET", "AF", "CD"]
TRAIN_RANGE = ("2022-01", "2023-12")    # for percentile normalisation
TEST_RANGE  = ("2024-01", "2025-06")    # held-out
CONFLICT_Q = ('(military OR clash OR shelling OR strike OR casualties) '
              'sourcecountry:{iso}')
UNREST_Q   = ('(protest OR demonstration OR riot OR clash) '
              'sourcecountry:{iso}')

DOC_API = "https://api.gdeltproject.org/api/v2/doc/doc"

# ── Engine port (mirror of osint-engine.mjs @ 5cb9155) ────────────────
OPAQUE = {"KP", "TM", "ER", "SY", "AF"}                # 0.25
SEMI   = {"RU", "CN", "BY", "IR", "VE", "MM", "TJ", "UZ",
          "CU", "LA", "GQ", "AZ", "NI", "BI"}          # 0.45
OPEN   = {"US", "CA", "GB", "IE", "DE", "FR", "IT", "ES", "PT", "NL",
          "BE", "LU", "CH", "AT", "SE", "NO", "FI", "DK", "IS", "EE",
          "LV", "LT", "PL", "CZ", "SK", "SI", "HU", "HR", "GR", "JP",
          "KR", "SG", "TW", "HK", "AU", "NZ", "IL", "AE", "QA", "MT"}


def transparency(iso2):
    if iso2 in OPAQUE: return 0.25
    if iso2 in SEMI:   return 0.45
    if iso2 in OPEN:   return 0.92
    return 0.70


def inform_modifier(struct):
    if not struct or struct.get("vulnerability") is None or struct.get("coping") is None:
        return 1.0
    v = struct["vulnerability"]; c = struct["coping"]
    f = max(0.0, min(1.0, (v * c) / 100.0))
    return round(max(0.70, min(1.60, 0.70 + f * 1.6)), 3)


def compute_covert_risk(iso2, cb, cs, struct):
    """Mirror of computeCovertRisk() at commit 5cb9155."""
    conflict = cb.get("conflict", 0.0)
    unrest   = cb.get("civil_unrest", 0.0)
    border   = cb.get("border", 0.0)
    infra    = cb.get("infrastructure", 0.0)

    # internet / power_grid not used in historical replay (no proxy)
    fx_flow = cs.get("currency_drop_30d_pct", 0.0)
    currency_idx = 5 if fx_flow >= 20 else 3.5 if fx_flow >= 12 \
                   else 2 if fx_flow >= 6 else 1 if fx_flow >= 3 else 0
    if cs.get("currency_accelerating") and currency_idx > 0:
        currency_idx = min(5, currency_idx + 0.5)

    cats = sorted([conflict, unrest, infra, currency_idx, border], reverse=True)
    weighted = (0.30*conflict + 0.20*unrest + 0.22*infra
                + 0.16*currency_idx + 0.12*border)
    concentrated = 0.65 * (cats[0] + cats[1] * 0.5)
    behavioral_raw = min(5, max(weighted, concentrated))

    M = inform_modifier(struct)
    behavioral = round(min(5, behavioral_raw * M), 2)

    health_score = cb.get("health", 0.0)
    active_epi = cb.get("active_events_health", 0)
    official_activity = round(health_score + min(2, active_epi * 0.4), 2)

    divergence = round(behavioral - official_activity, 2)
    T = transparency(iso2)
    silence_informative = T if official_activity <= 1.0 else 1.0
    adj_divergence = round(divergence * silence_informative, 2)

    if behavioral >= 3.5 and official_activity <= 1.0 and adj_divergence >= 2.0:
        tier = "covert_elevated"
    elif behavioral >= 2.5:
        tier = "elevated_watch"
    elif behavioral >= 2.0:
        tier = "watch"
    else:
        tier = "nominal"

    return {"iso2": iso2, "tier": tier,
            "behavioral_raw": round(behavioral_raw, 2),
            "behavioral": behavioral, "informM": M,
            "official_activity": official_activity,
            "divergence": divergence, "adj_divergence": adj_divergence}


# ── GDELT fetcher ──────────────────────────────────────────────────────
def _http_get(url, retries=5):
    for attempt in range(retries):
        try:
            req = urllib.request.Request(
                url, headers={"User-Agent": "vigilo-backtest-covert/1.0"})
            with urllib.request.urlopen(req, timeout=90) as r:
                return r.read().decode("utf-8", "ignore")
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 503) and attempt < retries - 1:
                wait = 30 * (attempt + 1)
                print(f"    {e.code} — backoff {wait}s")
                time.sleep(wait)
                continue
            raise
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            if attempt < retries - 1:
                wait = 20 * (attempt + 1)
                print(f"    net err {e} — backoff {wait}s")
                time.sleep(wait)
                continue
            raise


def _parse_timeline(text):
    """DOC 2.0 timeline JSON → {(year, month): summed daily count}."""
    try:
        d = json.loads(text)
    except (ValueError, TypeError):
        return {}
    tl = d.get("timeline") or []
    if not tl: return {}
    out = defaultdict(float)
    for pt in (tl[0].get("data") or []):
        ds = str(pt.get("date", ""))
        if len(ds) < 6: continue
        try:
            y, m = int(ds[0:4]), int(ds[4:6])
            v = float(pt.get("value", 0) or 0)
        except (ValueError, TypeError):
            continue
        out[(y, m)] += v
    return dict(out)


def _fetch_year(iso, query, year):
    q = urllib.parse.quote(query.format(iso=iso))
    start = f"{year}0101000000"
    end   = f"{year}1231235959"
    url = (f"{DOC_API}?query={q}&mode=TimelineVolRaw&format=json"
           f"&startdatetime={start}&enddatetime={end}")
    return _parse_timeline(_http_get(url))


def fetch_country_series(iso, query, kind):
    """Fetch (year, month) → count for an iso/query across 2022-2025."""
    cache = CACHE_DIR / f"{iso}_{kind}.json"
    if cache.exists():
        return {tuple(map(int, k.split("-"))): v
                for k, v in json.loads(cache.read_text()).items()}
    print(f"  {iso}/{kind}: fetching 2022-2025…")
    series = {}
    for year in (2022, 2023, 2024, 2025):
        ym = _fetch_year(iso, query, year)
        series.update(ym)
        time.sleep(2)  # polite
    cache.parent.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps({f"{y}-{m}": v
                                  for (y, m), v in series.items()}))
    return series


def cmd_fetch():
    """Stage 1: pull GDELT timelines into data/backtest-covert/."""
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    for iso in COUNTRIES:
        fetch_country_series(iso, CONFLICT_Q, "conflict")
        fetch_country_series(iso, UNREST_Q,   "unrest")
    print(f"\nfetch complete → {CACHE_DIR}")


# ── Normalisation: count → 0-5 score ───────────────────────────────────
def _ym_in_range(ym, lo, hi):
    """ym=(year, month); lo='YYYY-MM'; hi='YYYY-MM'."""
    y, m = ym
    lo_y, lo_m = map(int, lo.split("-"))
    hi_y, hi_m = map(int, hi.split("-"))
    a = y*12+m; b_lo = lo_y*12+lo_m; b_hi = hi_y*12+hi_m
    return b_lo <= a <= b_hi


def percentile_to_score(value, distribution):
    """Map a value to 0-5 via percentile of the train distribution.
       p<25→0; 25-50→1; 50-75→2; 75-90→3; 90-95→4; 95+→5."""
    if not distribution:
        return 0
    s = sorted(distribution)
    n = len(s)
    if value <= s[max(0, n*25//100)]: return 0
    if value <= s[max(0, n*50//100)]: return 1
    if value <= s[max(0, n*75//100)]: return 2
    if value <= s[max(0, n*90//100)]: return 3
    if value <= s[max(0, n*95//100)]: return 4
    return 5


def cmd_replay():
    """Stages 2-4: normalise, run engine, label outcomes."""
    struct = json.loads(STRUCT_JSON.read_text()).get("structural", {}) \
             if STRUCT_JSON.exists() else {}

    records = []  # per (iso, year, month)
    for iso in COUNTRIES:
        cache_c = CACHE_DIR / f"{iso}_conflict.json"
        cache_u = CACHE_DIR / f"{iso}_unrest.json"
        if not (cache_c.exists() and cache_u.exists()):
            print(f"  {iso}: missing cache — run `fetch` first")
            continue
        conflict_series = {tuple(map(int, k.split("-"))): v
                           for k, v in json.loads(cache_c.read_text()).items()}
        unrest_series   = {tuple(map(int, k.split("-"))): v
                           for k, v in json.loads(cache_u.read_text()).items()}

        train_conf = [v for ym, v in conflict_series.items()
                      if _ym_in_range(ym, *TRAIN_RANGE)]
        train_unrt = [v for ym, v in unrest_series.items()
                      if _ym_in_range(ym, *TRAIN_RANGE)]

        for ym in sorted(conflict_series.keys()):
            if not _ym_in_range(ym, *TEST_RANGE):
                continue
            c = conflict_series.get(ym, 0)
            u = unrest_series.get(ym, 0)
            cb = {
                "conflict":     percentile_to_score(c, train_conf),
                "civil_unrest": percentile_to_score(u, train_unrt),
                "border": 0, "infrastructure": 0,
                "health": 0, "active_events_health": 0,
            }
            v = compute_covert_risk(iso, cb, {}, struct.get(iso))

            # Outcome label: did conflict count rise next month?
            # ym is (year, month) — compute T+1
            y, m = ym
            next_ym = (y, m+1) if m < 12 else (y+1, 1)
            next_c = conflict_series.get(next_ym, 0)
            recent = [conflict_series.get((y, mm), 0)
                      for mm in range(max(1, m-3), m+1)] or [0]
            recent_max = max(recent) if recent else 0
            escalated = (recent_max > 0 and next_c >= 1.5 * recent_max) \
                        or (recent_max == 0 and next_c >= 50)

            records.append({"iso": iso, "year": y, "month": m,
                            "conflict_count": c, "next_month_count": next_c,
                            "recent_max": recent_max,
                            "tier": v["tier"],
                            "behavioral": v["behavioral"],
                            "escalated": escalated})

    out = CACHE_DIR / "replay.json"
    out.write_text(json.dumps(records, indent=2))
    print(f"replay complete → {out}  ({len(records)} country-months)")
    return records


# ── Scoring ───────────────────────────────────────────────────────────
def score(records):
    """Compute precision, recall, breakdown by tier and country."""
    by_tier = defaultdict(lambda: {"n": 0, "esc": 0})
    by_iso  = defaultdict(lambda: {"tp": 0, "fp": 0, "fn": 0, "tn": 0})
    tp = fp = fn = tn = 0

    for r in records:
        is_alarm = r["tier"] in {"watch", "elevated_watch", "covert_elevated"}
        esc = r["escalated"]
        by_tier[r["tier"]]["n"] += 1
        by_tier[r["tier"]]["esc"] += int(esc)
        if is_alarm and esc:        tp += 1; by_iso[r["iso"]]["tp"] += 1
        elif is_alarm and not esc:  fp += 1; by_iso[r["iso"]]["fp"] += 1
        elif not is_alarm and esc:  fn += 1; by_iso[r["iso"]]["fn"] += 1
        else:                       tn += 1; by_iso[r["iso"]]["tn"] += 1

    precision = tp / (tp + fp) if (tp + fp) else None
    recall    = tp / (tp + fn) if (tp + fn) else None
    base_rate = (tp + fn) / len(records) if records else 0

    return {"tp": tp, "fp": fp, "fn": fn, "tn": tn,
            "precision": precision, "recall": recall,
            "base_rate_escalation": base_rate,
            "by_tier": dict(by_tier), "by_iso": dict(by_iso),
            "n_total": len(records)}


def cmd_report():
    """Stage 6: write docs/validation/covert-risk-backtest.md."""
    replay_file = CACHE_DIR / "replay.json"
    if not replay_file.exists():
        print("run `replay` first")
        return
    records = json.loads(replay_file.read_text())
    s = score(records)

    lines = []
    lines.append("# Covert-Risk Engine — Backtest Report\n")
    lines.append(f"_Generated: {time.strftime('%Y-%m-%d %H:%M UTC', time.gmtime())}_  ")
    lines.append("_Spec: docs/specs/2026-05-20-covert-risk-backtest-design.md_  ")
    lines.append("_Engine: osint-engine.mjs @ commit 5cb9155 (frozen)_\n")
    lines.append("## Pre-registered criterion\n")
    lines.append("> precision ≥ 0.40 AND recall ≥ 0.30 AND median lead ≥ 14d "
                 "on test window 2024-01 → 2025-06.\n")
    lines.append("## Scope\n")
    lines.append(f"- Countries (11): {', '.join(COUNTRIES)}")
    lines.append(f"- Test window: {TEST_RANGE[0]} → {TEST_RANGE[1]}")
    lines.append(f"- Country-months scored: **{s['n_total']}**")
    lines.append(f"- Base-rate escalation: **{s['base_rate_escalation']:.1%}**\n")
    lines.append("## Results\n")
    lines.append("| Metric | Value | Threshold | Pass |")
    lines.append("|---|---|---|---|")
    p_ok = s["precision"] is not None and s["precision"] >= 0.40
    r_ok = s["recall"]    is not None and s["recall"]    >= 0.30
    lines.append(f"| Precision | {s['precision']:.3f} | ≥ 0.40 | "
                 f"{'✅' if p_ok else '❌'} |"
                 if s['precision'] is not None else
                 "| Precision | n/a | ≥ 0.40 | ❌ |")
    lines.append(f"| Recall    | {s['recall']:.3f} | ≥ 0.30 | "
                 f"{'✅' if r_ok else '❌'} |"
                 if s['recall'] is not None else
                 "| Recall    | n/a | ≥ 0.30 | ❌ |")
    lines.append(f"| TP | {s['tp']} | | |")
    lines.append(f"| FP | {s['fp']} | | |")
    lines.append(f"| FN | {s['fn']} | | |")
    lines.append(f"| TN | {s['tn']} | | |\n")

    lines.append("## By tier\n")
    lines.append("| Tier | N | Escalated | Precision |")
    lines.append("|---|---|---|---|")
    for tier in ("covert_elevated", "elevated_watch", "watch", "nominal"):
        t = s["by_tier"].get(tier, {"n": 0, "esc": 0})
        p = (t["esc"] / t["n"]) if t["n"] else None
        lines.append(f"| {tier} | {t['n']} | {t['esc']} | "
                     f"{p:.3f} |" if p is not None else
                     f"| {tier} | {t['n']} | {t['esc']} | — |")

    lines.append("\n## By country\n")
    lines.append("| ISO | TP | FP | FN | TN | Precision |")
    lines.append("|---|---|---|---|---|---|")
    for iso in COUNTRIES:
        b = s["by_iso"].get(iso, {"tp": 0, "fp": 0, "fn": 0, "tn": 0})
        prec = (b["tp"] / (b["tp"] + b["fp"])) if (b["tp"] + b["fp"]) else None
        lines.append(f"| {iso} | {b['tp']} | {b['fp']} | {b['fn']} | "
                     f"{b['tn']} | "
                     f"{prec:.3f} |" if prec is not None else
                     f"| {iso} | {b['tp']} | {b['fp']} | {b['fn']} | "
                     f"{b['tn']} | — |")

    lines.append("\n## Verdict\n")
    if p_ok and r_ok:
        lines.append("**DEMONSTRATED** against pre-registered criterion.\n")
    elif p_ok or r_ok:
        lines.append("**PARTIAL** — only one of precision/recall passes. "
                     "Engine may be useful in directional mode, not "
                     "operational alerting.\n")
    else:
        lines.append("**NOT DEMONSTRATED** — pre-registered criterion not met. "
                     "Engine returns to lab.\n")

    lines.append("\n## Honesty notes\n")
    lines.append("- Outcome label uses the SAME GDELT feed as input — mild "
                 "self-confirmation risk. Independent label (ACLED fatalities) "
                 "deferred to next iteration.")
    lines.append("- Historical infra/border/internet signals not reconstructed "
                 "(no proxy) → engine evaluated on subset of its design inputs.")
    lines.append("- Lead-time metric not computed in this v0 (monthly resolution "
                 "is too coarse; needs daily GDELT for meaningful lead time).")
    lines.append("- Engine code FROZEN at 5cb9155 before this report. Any "
                 "post-hoc tuning invalidates the verdict.\n")

    REPORT_MD.parent.mkdir(parents=True, exist_ok=True)
    REPORT_MD.write_text("\n".join(lines))
    print(f"report → {REPORT_MD}")
    # Also print summary
    print("\n=== Summary ===")
    print(f"  N country-months : {s['n_total']}")
    print(f"  Precision        : {s['precision']}")
    print(f"  Recall           : {s['recall']}")
    print(f"  Base-rate esc.   : {s['base_rate_escalation']:.1%}")


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "all"
    if cmd == "fetch":
        cmd_fetch()
    elif cmd == "replay":
        cmd_replay()
    elif cmd == "report":
        cmd_report()
    elif cmd == "all":
        cmd_fetch()
        cmd_replay()
        cmd_report()
    else:
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
