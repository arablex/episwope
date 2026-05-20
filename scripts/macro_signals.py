#!/usr/bin/env python3
"""
macro_signals.py — Macroeconomic risk indicators per country.

HONEST framing: macro indicators (GDP growth, unemployment, debt-to-GDP)
are LAGGING signals — they confirm crises, they don't lead them. We add
them for EXPLAINABILITY ('why this score'), not predictive boost.

Discipline: FLOW not STOCK (Meadows). We store rate-of-change /
deltas alongside levels — chronic weakness is background, recent moves
are signal. Same lesson applied to currency in country-signals.

Sources (free, no key):
  - World Bank Indicators API   — GDP growth, unemployment, debt/GDP
  - IMF SDMX (optional, future) — central bank policy rates

Output: public/macro.json (per-ISO2, same schema as the curated seed).
Run cadence: monthly (these indicators change slowly). Wire to a
separate GitHub Actions schedule, NOT into update-data.yml's 12h loop.
"""
from __future__ import annotations
import json
import urllib.request
from pathlib import Path
from datetime import datetime, timezone

OUT = Path(__file__).parent.parent / "public" / "macro.json"

# World Bank indicator codes
WB = {
    "gdp_yoy_pct":      "NY.GDP.MKTP.KD.ZG",   # GDP growth (annual %)
    "unemp_pct":        "SL.UEM.TOTL.ZS",       # Unemployment, total (% of labor force)
    "debt_to_gdp_pct":  "GC.DOD.TOTL.GD.ZS",    # Central gov debt, total (% of GDP)
}

# Countries to track — keep aligned with INFORM seed (country-structural.json)
COUNTRIES = [
    "SD","IR","CU","VE","MM","ET","AF","NG","PK","UA","RU","IN","TH","US",
    "DE","GB","TR","EG","ZA","BR","AR","MX","JP","KR","CN","ID","PH","BD",
    "VN","SA","AE","CA","FR","IT","ES","NL","PL","GR","AU","NZ",
]

def fetch_wb_series(iso2: str, indicator: str, years: int = 8) -> list[tuple[int, float]]:
    """Fetch World Bank annual series for one country/indicator. Returns
    [(year, value), ...] sorted ascending. Empty if API fails."""
    url = (
        f"https://api.worldbank.org/v2/country/{iso2}/indicator/{indicator}"
        f"?format=json&per_page={years}&date=2017:{datetime.now().year}"
    )
    try:
        with urllib.request.urlopen(url, timeout=15) as r:
            data = json.loads(r.read())
        if not isinstance(data, list) or len(data) < 2 or not data[1]:
            return []
        rows = [(int(x["date"]), x["value"]) for x in data[1] if x.get("value") is not None]
        return sorted(rows)
    except Exception as e:
        print(f"  ⚠ WB {iso2}/{indicator}: {e}", flush=True)
        return []

def latest_and_delta(series: list[tuple[int, float]], delta_years: int) -> tuple[float|None, float|None]:
    """Latest value + delta in percentage points from `delta_years` ago.
    Returns (None, None) if series too short."""
    if not series:
        return None, None
    latest = series[-1][1]
    if len(series) <= delta_years:
        return latest, None
    prior = series[-1 - delta_years][1]
    return latest, round(latest - prior, 2)

def avg(series: list[tuple[int, float]], n: int) -> float | None:
    """Rolling n-year average of the latest n values."""
    if len(series) < n:
        return None
    vals = [v for _, v in series[-n:]]
    return round(sum(vals) / len(vals), 2)

def compute_country(iso2: str) -> dict | None:
    gdp = fetch_wb_series(iso2, WB["gdp_yoy_pct"])
    unemp = fetch_wb_series(iso2, WB["unemp_pct"])
    debt = fetch_wb_series(iso2, WB["debt_to_gdp_pct"])

    if not (gdp or unemp or debt):
        return None

    gdp_latest, _ = latest_and_delta(gdp, 1)
    gdp_avg = avg(gdp, 3)
    unemp_latest, unemp_delta = latest_and_delta(unemp, 2)
    debt_latest, debt_delta = latest_and_delta(debt, 5)

    return {
        "gdp_yoy_pct":        round(gdp_latest, 2) if gdp_latest is not None else None,
        "gdp_3yr_avg_pct":    gdp_avg,
        "unemp_pct":          round(unemp_latest, 2) if unemp_latest is not None else None,
        "unemp_2yr_delta_pp": unemp_delta,
        "debt_to_gdp_pct":    round(debt_latest, 2) if debt_latest is not None else None,
        "debt_5yr_delta_pp":  debt_delta,
        "policy_rate_pct":    None,  # not in WB; future: IMF SDMX or BIS
    }

def main():
    # Preserve existing curated seed for countries we can't refresh
    existing = {}
    if OUT.exists():
        try:
            existing = json.loads(OUT.read_text()).get("macro", {})
        except Exception:
            pass

    out_macro = dict(existing)  # start from seed
    refreshed = 0
    for iso2 in COUNTRIES:
        print(f"  • {iso2} …", flush=True)
        row = compute_country(iso2)
        if row:
            # Keep policy_rate from seed if WB didn't provide it
            seed_rate = existing.get(iso2, {}).get("policy_rate_pct")
            if seed_rate is not None:
                row["policy_rate_pct"] = seed_rate
            out_macro[iso2] = row
            refreshed += 1

    payload = {
        "meta": {
            "version": "1.1-live",
            "methodology": "Macroeconomic risk indicators with FLOW discipline (Meadows). LAGGING signals — explainability primary, not predictive boost.",
            "use": "Small additive component to Risk Score + explainability layer in country card.",
            "source": "World Bank Indicators API (annual). Policy rates remain curated until IMF SDMX is wired.",
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "refreshed_countries": refreshed,
            "fields": {
                "gdp_yoy_pct": "latest year-over-year GDP growth (negative = contraction, signal)",
                "gdp_3yr_avg_pct": "rolling 3-year average — baseline",
                "unemp_pct": "current unemployment rate",
                "unemp_2yr_delta_pp": "change in unemployment over 2 years (pp)",
                "debt_to_gdp_pct": "general government debt / GDP",
                "debt_5yr_delta_pp": "change in debt/GDP over 5 years (pp; rapid rise = fiscal stress)",
                "policy_rate_pct": "central bank key rate (high or rising = monetary stress)"
            }
        },
        "macro": out_macro,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\n✓ refreshed {refreshed}/{len(COUNTRIES)} → {OUT.name}")

if __name__ == "__main__":
    main()
