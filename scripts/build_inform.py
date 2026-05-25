#!/usr/bin/env python3
"""Annual build step (NOT in the hourly pipeline): fetch the overall INFORM Risk
index from the World Bank Data360 API and write public/inform_risk.json =
{ISO2: F} where F = INFORM_Risk / 10 in [0,1] (latest year per country).

Source: INFORM Risk Index (EC JRC + UN OCHA), CC BY 4.0. Served via World Bank
Data360 (DATABASE_ID=DRMKC_INFORM, INDICATOR=INFORM_OVRL, REF_AREA=ISO3,
OBS_VALUE 0–10). No auth, open access.

Run once a year:
    python3 -m pip install pycountry
    python3 scripts/build_inform.py
"""
import json
import urllib.request
from pathlib import Path
import pycountry

ROOT = Path(__file__).resolve().parent.parent
OUT  = ROOT / "public" / "inform_risk.json"
API  = ("https://data360api.worldbank.org/data360/data"
        "?DATABASE_ID=DRMKC_INFORM&INDICATOR=INFORM_OVRL&skip={skip}")


def _fetch_all() -> list[dict]:
    rows, skip = [], 0
    while True:
        req = urllib.request.Request(
            API.format(skip=skip),
            headers={"User-Agent": "Mozilla/5.0 (Vigilo INFORM build)",
                     "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=60) as r:
            doc = json.loads(r.read())
        batch = doc.get("value", [])
        if not batch:
            break
        rows.extend(batch)
        skip += len(batch)
        if skip >= doc.get("count", 0):
            break
    return rows


def main():
    rows = _fetch_all()
    if not rows:
        raise SystemExit("Data360 returned no rows for INFORM_OVRL")

    # Keep the latest year's value per ISO3 country.
    latest: dict[str, tuple[int, float]] = {}
    for r in rows:
        iso3 = (r.get("REF_AREA") or "").strip().upper()
        try:
            year = int(r.get("TIME_PERIOD"))
            val = float(r.get("OBS_VALUE"))
        except (TypeError, ValueError):
            continue
        if len(iso3) != 3:
            continue
        if iso3 not in latest or year > latest[iso3][0]:
            latest[iso3] = (year, val)

    out = {}
    skipped = []
    for iso3, (_year, val) in latest.items():
        c = pycountry.countries.get(alpha_3=iso3)
        if not c:
            skipped.append(iso3)
            continue
        out[c.alpha_2] = round(max(0.0, min(1.0, val / 10.0)), 3)

    OUT.write_text(json.dumps(dict(sorted(out.items())), ensure_ascii=False, indent=2),
                   encoding="utf-8")
    print(f"wrote {OUT} — {len(out)} countries"
          + (f" (skipped non-ISO3: {skipped})" if skipped else ""))


if __name__ == "__main__":
    main()
