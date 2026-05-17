"""ERA5 daily climate history via Open-Meteo archive API (free, no key).

parse_archive() is pure & tested. fetch_all() caches one JSON per ISO
using the SAME centroids the live indicator uses.
"""
import json
import sys
import time
import urllib.request

from backtest.paths import CLIMATE_DIR, ensure_dirs

sys.path.insert(0, "scripts")
from climate_signals import COORDS   # reuse the exact live centroids

ARCHIVE = "https://archive-api.open-meteo.com/v1/archive"


def parse_archive(text):
    """Return [{d,t,p}] dropping any day with a missing value."""
    try:
        d = json.loads(text)
    except (ValueError, TypeError):
        return []
    days = d.get("daily", {}) or {}
    ts = days.get("time") or []
    tt = days.get("temperature_2m_mean") or []
    pp = days.get("precipitation_sum") or []
    out = []
    for i, dt in enumerate(ts):
        if i < len(tt) and i < len(pp) and tt[i] is not None and pp[i] is not None:
            out.append({"d": dt, "t": float(tt[i]), "p": float(pp[i])})
    return out


def _fetch_one(lat, lng, start, end):
    url = (f"{ARCHIVE}?latitude={lat}&longitude={lng}"
           f"&start_date={start}&end_date={end}"
           "&daily=temperature_2m_mean,precipitation_sum&timezone=UTC")
    req = urllib.request.Request(url, headers={"User-Agent": "vigilo-backtest/1.0"})
    with urllib.request.urlopen(req, timeout=90) as r:
        return r.read().decode("utf-8", "ignore")


def fetch_all(start="2000-01-01", end="2024-12-31", force=False):
    ensure_dirs()
    for iso, (lat, lng) in COORDS.items():
        cache = CLIMATE_DIR / f"{iso}.json"
        if cache.exists() and not force:
            continue
        try:
            series = parse_archive(_fetch_one(lat, lng, start, end))
        except Exception as e:
            print(f"  {iso} fetch error: {e}")
            series = []
        if not series:
            print(f"  {iso}: no data — skipped")
            continue
        cache.write_text(json.dumps(series), encoding="utf-8")
        print(f"  {iso}: {len(series)} days cached")
        time.sleep(0.5)


if __name__ == "__main__":
    fetch_all(force="--force" in sys.argv)
