"""Phase-2 GDELT source: GKG aggregates pulled from the BigQuery public
dataset (gdelt-bq.gdeltv2.gkg_partitioned) via a PRE-REGISTERED frozen
query, exported as CSV and cached. Replaces the rate-limited / partially
unsupported free DOC 2.0 API used in Phase 1.

parse_bq_csv() is pure & tested. load() reads the cached CSV. The CSV
schema is fixed (fips,year,month,articles); a different header is a
HARD signal that the export changed — return empty (caller surfaces it).
"""
import csv
import io

from backtest.paths import DATA, ensure_dirs

# FIPS (GDELT sourcecountry) → ISO-2 (OpenDengue / harness convention).
# Exactly the six endemic-channel gate-passing countries.
FIPS_TO_ISO2 = {
    "BG": "BD",   # Bangladesh
    "CB": "KH",   # Cambodia
    "CE": "LK",   # Sri Lanka
    "ID": "ID",   # Indonesia
    "TH": "TH",   # Thailand
    "VM": "VN",   # Vietnam
}

BQ_CSV = DATA / "gdelt_bq" / "gkg_monthly.csv"
_EXPECTED_HEADER = ["fips", "year", "month", "articles"]


def parse_bq_csv(text):
    """CSV text → {iso2: {(year, month): article_count}}.

    Unknown FIPS rows are dropped. Wrong/empty header → {} (the export
    contract is fixed; a schema change must not silently mis-parse)."""
    rows = list(csv.reader(io.StringIO(text)))
    if not rows or [c.strip() for c in rows[0]] != _EXPECTED_HEADER:
        return {}
    out = {}
    for r in rows[1:]:
        if len(r) != 4:
            continue
        iso2 = FIPS_TO_ISO2.get(r[0].strip())
        if not iso2:
            continue
        try:
            y, m, n = int(r[1]), int(r[2]), int(round(float(r[3])))
        except ValueError:
            continue
        out.setdefault(iso2, {})[(y, m)] = n
    return out


def load():
    """Read the cached BigQuery export (offline; user-provided)."""
    ensure_dirs()
    if not BQ_CSV.exists():
        raise SystemExit(
            f"FATAL: missing {BQ_CSV} — run the pre-registered BigQuery "
            "export and place the CSV there (see spec Phase 2).")
    return parse_bq_csv(BQ_CSV.read_text(encoding="utf-8"))
