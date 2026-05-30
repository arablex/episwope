#!/usr/bin/env python3
"""Build scripts/_data/world_cities.json from GeoNames cities1000.txt.

Source: https://download.geonames.org/export/dump/cities1000.zip
~47 000 populated places with population >= 1000.

Output format (JSON):
{
  "paris": ["FR", 48.853, 2.349],
  "london": ["GB", 51.508, -0.128],
  ...
}

Keys are lowercase ASCII city names. When the same name exists in multiple
countries, keep the most-populous entry (best proxy for "which city do journalists
mean when they write this name without context").

Also writes alternate/ASCII spellings for non-ASCII city names so that
transliterated headlines (e.g. "Dnipro", "Kharkiv") still match.

Run:
    python3 scripts/build_cities_db.py
"""
import io
import json
import zipfile
import urllib.request
from pathlib import Path

URL = "https://download.geonames.org/export/dump/cities15000.zip"
OUT = Path(__file__).parent / "_data" / "world_cities.json"

# GeoNames TSV column indices (0-based)
_COL_NAME     = 1   # UTF-8 name
_COL_ASCII    = 2   # ASCII name
_COL_ALT      = 3   # comma-separated alternate names
_COL_LAT      = 4
_COL_LNG      = 5
_COL_ISO      = 8   # ISO 3166-1 alpha-2
_COL_POP      = 14  # population

# Minimum population to include (cities15000.txt already pre-filtered to ≥15 000,
# but the field may be 0 for a few entries — skip those)
MIN_POP = 15_000

# Countries to SKIP because their common names would mis-trigger on
# innocent headlines (e.g. small islands whose names appear in ordinary words).
_SKIP_ISO = {"BV", "HM", "TF", "UM", "AQ"}


def fetch_tsv() -> list[list[str]]:
    print(f"Downloading {URL} …")
    req = urllib.request.urlopen(URL, timeout=60)
    data = req.read()
    print(f"  {len(data):,} bytes received")
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        fname = next(n for n in zf.namelist() if n.endswith(".txt"))
        text = zf.read(fname).decode("utf-8")
    rows = [line.split("\t") for line in text.splitlines() if line]
    print(f"  {len(rows):,} rows")
    return rows


def build(rows: list[list[str]]) -> dict:
    # name_lower → {"iso": str, "lat": float, "lng": float, "pop": int}
    best: dict[str, dict] = {}

    def _consider(name: str, iso: str, lat: float, lng: float, pop: int) -> None:
        if not name or iso in _SKIP_ISO:
            return
        key = name.lower().strip()
        if len(key) < 2:
            return
        # Very short keys (2 chars) create false positives — skip unless
        # they are well-known abbreviations already in LANDMARK_DB.
        if len(key) == 2:
            return
        prev = best.get(key)
        if prev is None or pop > prev["pop"]:
            best[key] = {"iso": iso, "lat": lat, "lng": lng, "pop": pop}

    for row in rows:
        if len(row) < 15:
            continue
        try:
            iso = row[_COL_ISO].strip().upper()
            lat = float(row[_COL_LAT])
            lng = float(row[_COL_LNG])
            pop = int(row[_COL_POP] or 0)
        except (ValueError, IndexError):
            continue

        if pop < MIN_POP:
            continue
        if iso in _SKIP_ISO:
            continue

        name_utf8  = row[_COL_NAME].strip()
        name_ascii = row[_COL_ASCII].strip()
        alts       = [s.strip() for s in row[_COL_ALT].split(",") if s.strip()]

        _consider(name_utf8,  iso, lat, lng, pop)
        _consider(name_ascii, iso, lat, lng, pop)
        # Keep Latin-script alternates for non-ASCII city names
        # (e.g. "Kyiv" for "Київ", "Kharkiv" for "Харків") — but cap at 8
        # alternates per city to prevent the file exploding from tourism names.
        latin_alts = [a for a in alts if a and all(ord(c) < 128 for c in a)]
        for alt in latin_alts[:8]:
            _consider(alt, iso, lat, lng, pop)

    # Serialise: drop "pop" key, output [iso, lat, lng]
    out = {k: [v["iso"], round(v["lat"], 4), round(v["lng"], 4)]
           for k, v in sorted(best.items())}
    return out


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    rows = fetch_tsv()
    db   = build(rows)
    print(f"  {len(db):,} city keys")

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(db, f, ensure_ascii=False, separators=(",", ":"))
    size = OUT.stat().st_size
    print(f"Written → {OUT}  ({size:,} bytes / {size//1024} KB)")


if __name__ == "__main__":
    main()
