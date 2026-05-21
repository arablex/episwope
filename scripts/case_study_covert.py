#!/usr/bin/env python3
"""Covert-risk engine — case study (NOT a statistical backtest).

10 known historical crises with hard dates. For each: fetch GDELT timeline
for the 6 months prior, run the engine on monthly snapshots, see what tier
it fired at T-90 / T-60 / T-30 days before the known event.

This is for OUR learning — does the engine look directionally right on
events we know happened? Not for publication. Independent ground truth
(historical fact), GDELT only as input signal.

Usage:  python3 scripts/case_study_covert.py
"""

import json
import time
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / "data" / "case-study-covert"

# ── Known crises (independent ground truth) ──
# Format: (label, iso, event_date_YYYYMMDD, what_happened)
CASES = [
    ("Sudan civil war eruption",   "SD", "20230415", "RSF/SAF Khartoum battle"),
    ("Iran Mahsa Amini protests",  "IR", "20220916", "death sparks nationwide unrest"),
    ("Sri Lanka collapse",         "LK", "20220412", "sovereign default"),
    ("Myanmar military coup",      "MM", "20210201", "Tatmadaw seizes power"),
    ("Russia-Ukraine war start",   "UA", "20220224", "full-scale invasion"),
    ("Niger coup",                 "NE", "20230726", "presidential guard seizes Bazoum"),
    ("Israel-Hamas war",           "IL", "20231007", "Hamas attack triggers war"),
    ("Ecuador prison crisis",      "EC", "20240109", "cartel violence, state of emergency"),
    ("Bangladesh July uprising",   "BD", "20240715", "quota protests escalate"),
    ("Venezuela election crisis",  "VE", "20240728", "disputed Maduro re-election"),
]

CONFLICT_Q = ('(military OR clash OR shelling OR strike OR casualties OR battle) '
              'sourcecountry:{iso}')
UNREST_Q   = ('(protest OR demonstration OR riot OR violence) '
              'sourcecountry:{iso}')
DOC_API = "https://api.gdeltproject.org/api/v2/doc/doc"


# ── Engine port (mirror of osint-engine.mjs @ 5cb9155) ──
OPAQUE = {"KP","TM","ER","SY","AF"}
SEMI   = {"RU","CN","BY","IR","VE","MM","TJ","UZ","CU","LA","GQ","AZ","NI","BI"}
OPEN   = {"US","CA","GB","IE","DE","FR","IT","ES","PT","NL","BE","LU","CH","AT",
          "SE","NO","FI","DK","IS","EE","LV","LT","PL","CZ","SK","SI","HU","HR",
          "GR","JP","KR","SG","TW","HK","AU","NZ","IL","AE","QA","MT"}


def transparency(iso):
    if iso in OPAQUE: return 0.25
    if iso in SEMI:   return 0.45
    if iso in OPEN:   return 0.92
    return 0.70


def inform_modifier(struct):
    if not struct or struct.get("vulnerability") is None or struct.get("coping") is None:
        return 1.0
    v = struct["vulnerability"]; c = struct["coping"]
    f = max(0.0, min(1.0, (v * c) / 100.0))
    return round(max(0.70, min(1.60, 0.70 + f * 1.6)), 3)


def compute_tier(iso, conflict_s, unrest_s, struct=None):
    cats = sorted([conflict_s, unrest_s, 0, 0, 0], reverse=True)
    weighted = 0.30*conflict_s + 0.20*unrest_s
    concentrated = 0.65 * (cats[0] + cats[1] * 0.5)
    beh_raw = min(5, max(weighted, concentrated))
    M = inform_modifier(struct)
    beh = round(min(5, beh_raw * M), 2)
    # tier (matches 5cb9155 logic, simplified: no FX/official feed here)
    if beh >= 3.5:    tier = "covert_elevated"
    elif beh >= 2.5:  tier = "elevated_watch"
    elif beh >= 2.0:  tier = "watch"
    else:             tier = "nominal"
    return tier, beh


# ── GDELT fetch ──
def http_get(url, retries=4):
    for attempt in range(retries):
        try:
            req = urllib.request.Request(
                url, headers={"User-Agent": "vigilo-case-study/1.0"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read().decode("utf-8", "ignore")
        except Exception as e:
            if attempt < retries - 1:
                time.sleep(20 * (attempt + 1))
                continue
            raise


def parse_timeline(text):
    try: d = json.loads(text)
    except Exception: return {}
    tl = d.get("timeline") or []
    if not tl: return {}
    out = defaultdict(float)
    for pt in (tl[0].get("data") or []):
        ds = str(pt.get("date",""))
        if len(ds) < 6: continue
        try:
            y, m = int(ds[0:4]), int(ds[4:6])
            v = float(pt.get("value", 0) or 0)
        except Exception: continue
        out[(y, m)] += v
    return dict(out)


def fetch_window(iso, query, start_ymd, end_ymd, cache_key):
    """Fetch monthly counts for iso/query in [start_ymd, end_ymd]."""
    cache_file = CACHE / f"{iso}_{cache_key}_{start_ymd}_{end_ymd}.json"
    if cache_file.exists():
        return {tuple(map(int, k.split("-"))): v
                for k, v in json.loads(cache_file.read_text()).items()}
    q = urllib.parse.quote(query.format(iso=iso))
    url = (f"{DOC_API}?query={q}&mode=TimelineVolRaw&format=json"
           f"&startdatetime={start_ymd}000000&enddatetime={end_ymd}000000")
    res = parse_timeline(http_get(url))
    cache_file.parent.mkdir(parents=True, exist_ok=True)
    cache_file.write_text(json.dumps({f"{y}-{m}": v for (y,m),v in res.items()}))
    return res


def percentile_score(value, distribution):
    if not distribution or value <= 0: return 0
    s = sorted(distribution); n = len(s)
    if value <= s[n*25//100]: return 0
    if value <= s[n*50//100]: return 1
    if value <= s[n*75//100]: return 2
    if value <= s[n*90//100]: return 3
    if value <= s[n*95//100]: return 4
    return 5


def back_months(year, month, k):
    a = year*12 + (month - 1) - k
    return (a // 12, (a % 12) + 1)


def main():
    # Optional INFORM data
    struct_path = ROOT / "public" / "country-structural.json"
    struct_all = (json.loads(struct_path.read_text()).get("structural", {})
                  if struct_path.exists() else {})

    print(f"\nCase study — {len(CASES)} known crises\n" + "─"*68)
    print(f"{'Event':32s} {'ISO':3s} {'Date':10s} {'T-90':14s} {'T-60':14s} {'T-30':14s} verdict")
    print("─"*120)

    hits = 0
    for label, iso, ev_date, _what in CASES:
        ev_y, ev_m = int(ev_date[0:4]), int(ev_date[4:6])
        # Fetch a wider window: baseline 24 months prior + 3 months around event
        base_start = back_months(ev_y, ev_m, 30)
        end = (ev_y, ev_m + 1) if ev_m < 12 else (ev_y + 1, 1)
        start_ymd = f"{base_start[0]:04d}{base_start[1]:02d}01"
        end_ymd   = f"{end[0]:04d}{end[1]:02d}01"

        try:
            conf_series = fetch_window(iso, CONFLICT_Q, start_ymd, end_ymd, "conf")
            time.sleep(2)
            unrest_series = fetch_window(iso, UNREST_Q, start_ymd, end_ymd, "unrest")
            time.sleep(2)
        except Exception as e:
            print(f"{label:32s} {iso:3s} {ev_date}  fetch FAILED: {e}")
            continue

        # Baseline distribution: months 6+ before event (avoid leakage from
        # the months immediately leading up to the known crisis)
        baseline_cutoff = back_months(ev_y, ev_m, 6)
        baseline_idx = baseline_cutoff[0]*12 + baseline_cutoff[1]
        train_conf = [v for (y,m),v in conf_series.items()
                      if (y*12+m) <= baseline_idx]
        train_unrt = [v for (y,m),v in unrest_series.items()
                      if (y*12+m) <= baseline_idx]

        # Evaluate at T-90, T-60, T-30 (i.e. 3, 2, 1 months before event)
        struct = struct_all.get(iso)
        snapshots = []
        for k in (3, 2, 1):
            (y, m) = back_months(ev_y, ev_m, k)
            c_count = conf_series.get((y, m), 0)
            u_count = unrest_series.get((y, m), 0)
            c_score = percentile_score(c_count, train_conf)
            u_score = percentile_score(u_count, train_unrt)
            tier, beh = compute_tier(iso, c_score, u_score, struct)
            snapshots.append((tier, beh, c_score, u_score))

        # "Hit" = engine fired watch+ at any of T-90/T-60/T-30
        fired = any(t != "nominal" for t,_,_,_ in snapshots)
        if fired: hits += 1
        verdict = "✅ FIRED" if fired else "❌ MISSED"

        cells = []
        for tier, beh, c, u in snapshots:
            mark = "🔴" if tier == "covert_elevated" else \
                   "🟠" if tier == "elevated_watch" else \
                   "🟡" if tier == "watch" else "·"
            cells.append(f"{mark} {tier[:9]:9s} b={beh:.1f}")
        print(f"{label:32s} {iso:3s} {ev_date}  " + "  ".join(cells) + f"  {verdict}")

    print("─"*120)
    print(f"\nCases where engine fired ≥watch at T-30/-60/-90: {hits}/{len(CASES)}")
    print("\n(Caveat: GDELT is both signal source and proxy for events themselves.")
    print(" A 'hit' here means news volume rose before the date, not that the engine")
    print(" found hidden ground truth. Useful for self-calibration, not for marketing.)")


if __name__ == "__main__":
    main()
