"""Real GDELT DOC 2.0 health-news density (free, no key).

parse_gdelt_timeline() is pure & tested. fetch() is a thin network
shell caching one JSON per ISO. The query is PRE-REGISTERED and frozen:
changing it to chase a better backtest number is an integrity breach.
"""
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

from backtest.paths import GDELT_DIR, ensure_dirs

# GDELT DOC 2.0 (free, no key). 2.0 coverage starts 2015-02-19.
DOC_API = "https://api.gdeltproject.org/api/v2/doc/doc"
# PRE-REGISTERED, FROZEN disease/health query. Do NOT tune.
QUERY_TEMPLATE = ('(dengue OR cholera OR "disease outbreak" OR epidemic '
                  'OR "infectious disease") sourcecountry:{iso}')
# The DOC 2.0 API caps the timeline span, so we PAGE per calendar year
# (frozen query unchanged) and merge. 2015 clamped to coverage start.
COVERAGE_START = "20150219000000"
YEARS = range(2015, 2025)


def parse_gdelt_timeline(text):
    """DOC 2.0 timeline JSON → {(year, month): summed daily article count}."""
    try:
        d = json.loads(text)
    except (ValueError, TypeError):
        return {}
    tl = d.get("timeline") or []
    if not tl:
        return {}
    out = {}
    for pt in (tl[0].get("data") or []):
        ds = str(pt.get("date", ""))
        if len(ds) < 6:
            continue
        try:
            y, m = int(ds[0:4]), int(ds[4:6])
            v = float(pt.get("value", 0) or 0)
        except (ValueError, TypeError):
            continue
        out[(y, m)] = out.get((y, m), 0.0) + v
    return {k: (int(v) if float(v).is_integer() else v)
            for k, v in out.items()}


def _url(iso, start, end):
    q = urllib.parse.quote(QUERY_TEMPLATE.format(iso=iso))
    return (f"{DOC_API}?query={q}&mode=TimelineVolRaw&format=json"
            f"&startdatetime={start}&enddatetime={end}")


def _get(url, retries=6):
    """GET with exponential backoff on the DOC API's aggressive 429s."""
    for attempt in range(retries):
        try:
            req = urllib.request.Request(
                url, headers={"User-Agent": "vigilo-backtest/1.0"})
            with urllib.request.urlopen(req, timeout=90) as r:
                return r.read().decode("utf-8", "ignore")
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < retries - 1:
                wait = 35 * (attempt + 1)
                print(f"    429 — backoff {wait}s "
                      f"(attempt {attempt + 1}/{retries})")
                time.sleep(wait)
                continue
            raise
    return ""


def fetch(iso, force=False):
    """Page the frozen query per calendar year and merge into ONE
    DOC-shaped timeline JSON (so parse_gdelt_timeline is unchanged).
    Years that error after backoff are skipped (partial coverage is
    honest and surfaces in the report's thin-panel limitation)."""
    ensure_dirs()
    cache = GDELT_DIR / f"{iso}.json"
    if cache.exists() and not force:
        return cache.read_text(encoding="utf-8")
    merged, ok_years = [], 0
    for y in YEARS:
        start = COVERAGE_START if y == 2015 else f"{y}0101000000"
        end = f"{y}1231235959"
        body = _get(_url(iso, start, end))
        if '"timeline"' in body:
            try:
                d = json.loads(body)
                tl = d.get("timeline") or []
                if tl:
                    merged.extend(tl[0].get("data") or [])
                    ok_years += 1
            except (ValueError, TypeError):
                print(f"    {iso} {y}: unparseable timeline — skipped")
        else:
            print(f"    {iso} {y}: no timeline ({body[:60].strip()!r}) "
                  "— skipped")
        time.sleep(3)
    text = json.dumps({"timeline": [{"series": "Article Count",
                                     "data": merged}]})
    cache.write_text(text, encoding="utf-8")
    if ok_years == 0:
        # Honest data reality: GDELT DOC 2.0 does not cover this country
        # under the frozen query (e.g. "Invalid/Unsupported Country").
        # Cache an EMPTY timeline so the country is cleanly EXCLUDED and
        # counted downstream — NOT a fatal abort of the whole run.
        print(f"  {iso}: EXCLUDED — no GDELT coverage (0 usable years)")
    else:
        print(f"  {iso}: {ok_years}/{len(list(YEARS))} years, "
              f"{len(merged)} daily points cached")
    return text


if __name__ == "__main__":
    isos = sys.argv[1:] or ["TH"]
    isos = [a for a in isos if a != "--force"]
    counts = {}
    for iso in isos:
        counts[iso] = len(parse_gdelt_timeline(
            fetch(iso, force="--force" in sys.argv)))
        print(f"gdelt {iso}: {counts[iso]} months cached")
    if isos and all(v == 0 for v in counts.values()):
        raise SystemExit("FATAL: GDELT returned no usable data for ANY "
                         "requested country — endpoint/schema changed. "
                         "Update fetch_gdelt.py.")
