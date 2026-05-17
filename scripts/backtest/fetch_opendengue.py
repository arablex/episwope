"""OpenDengue national monthly dengue counts.

parse_opendengue_csv() is pure & tested. fetch() is a thin network
shell that caches the raw CSV. We keep only monthly-resolution national
rows and normalise ISO-3 → ISO-2.
"""
import csv
import io
import sys
import urllib.request
from datetime import date

from backtest.paths import DENGUE_CSV, ensure_dirs

# OpenDengue "National" release (Global, monthly). If the URL or schema
# changes this is a HARD FAIL by design — never silently degrade.
OPENDENGUE_URL = (
    "https://github.com/OpenDengue/master-repo/raw/main/data/releases/"
    "V1.3/National_extract_V1_3.csv"
)

_ISO3_TO_2 = {
    "THA": "TH", "BRA": "BR", "IND": "IN", "IDN": "ID", "PHL": "PH",
    "VNM": "VN", "BGD": "BD", "MEX": "MX", "COL": "CO", "PER": "PE",
    "NGA": "NG", "COD": "CD", "KEN": "KE", "ETH": "ET", "TZA": "TZ",
    "MOZ": "MZ", "PAK": "PK", "EGY": "EG", "YEM": "YE", "HTI": "HT",
    "SDN": "SD", "MMR": "MM", "KHM": "KH", "LKA": "LK", "AGO": "AO",
}


def parse_opendengue_csv(text):
    """Return sorted list of {iso2, year, month, cases} for monthly rows."""
    rows = []
    reader = csv.DictReader(io.StringIO(text))
    for r in reader:
        if (r.get("T_res") or "").strip().lower() != "month":
            continue
        iso3 = (r.get("ISO_A0") or "").strip().upper()
        iso2 = _ISO3_TO_2.get(iso3)
        if not iso2:
            continue
        start = (r.get("calendar_start_date") or "").strip()
        raw = (r.get("dengue_total") or "").strip()
        if not start or raw in ("", "NA", "NaN"):
            continue
        try:
            d = date.fromisoformat(start)
            cases = int(round(float(raw)))
        except ValueError:
            continue
        rows.append({"iso2": iso2, "year": d.year,
                     "month": d.month, "cases": cases})
    rows.sort(key=lambda x: (x["iso2"], x["year"], x["month"]))
    return rows


def fetch(force=False):
    ensure_dirs()
    if DENGUE_CSV.exists() and not force:
        return DENGUE_CSV.read_text(encoding="utf-8")
    req = urllib.request.Request(
        OPENDENGUE_URL, headers={"User-Agent": "vigilo-backtest/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        text = r.read().decode("utf-8", "ignore")
    if "ISO_A0" not in text.splitlines()[0]:
        raise SystemExit("FATAL: OpenDengue schema changed — header missing "
                         "'ISO_A0'. Update fetch_opendengue.py.")
    DENGUE_CSV.write_text(text, encoding="utf-8")
    return text


if __name__ == "__main__":
    txt = fetch(force="--force" in sys.argv)
    print(f"opendengue: {len(parse_opendengue_csv(txt))} monthly rows cached")
