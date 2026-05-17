"""Real GDELT DOC 2.0 health-news density (free, no key).

parse_gdelt_timeline() is pure & tested. fetch() is a thin network
shell caching one JSON per ISO. The query is PRE-REGISTERED and frozen:
changing it to chase a better backtest number is an integrity breach.
"""
import json
import sys
import time
import urllib.parse
import urllib.request

from backtest.paths import GDELT_DIR, ensure_dirs

# GDELT DOC 2.0 (free, no key). 2.0 coverage starts 2015-02.
DOC_API = "https://api.gdeltproject.org/api/v2/doc/doc"
# PRE-REGISTERED, FROZEN disease/health query. Do NOT tune.
QUERY_TEMPLATE = ('(dengue OR cholera OR "disease outbreak" OR epidemic '
                  'OR "infectious disease") sourcecountry:{iso}')
START = "20150101000000"
END = "20241231235959"


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


def _url(iso):
    q = urllib.parse.quote(QUERY_TEMPLATE.format(iso=iso))
    return (f"{DOC_API}?query={q}&mode=TimelineVolRaw&format=json"
            f"&startdatetime={START}&enddatetime={END}")


def fetch(iso, force=False):
    ensure_dirs()
    cache = GDELT_DIR / f"{iso}.json"
    if cache.exists() and not force:
        return cache.read_text(encoding="utf-8")
    req = urllib.request.Request(
        _url(iso), headers={"User-Agent": "vigilo-backtest/1.0"})
    with urllib.request.urlopen(req, timeout=90) as r:
        text = r.read().decode("utf-8", "ignore")
    if '"timeline"' not in text:
        raise SystemExit(f"FATAL: GDELT schema/endpoint changed for {iso} "
                         "— no 'timeline'. Update fetch_gdelt.py.")
    cache.write_text(text, encoding="utf-8")
    time.sleep(2)
    return text


if __name__ == "__main__":
    for iso in sys.argv[1:] or ["TH"]:
        n = len(parse_gdelt_timeline(fetch(iso, force="--force" in sys.argv)))
        print(f"gdelt {iso}: {n} months cached")
