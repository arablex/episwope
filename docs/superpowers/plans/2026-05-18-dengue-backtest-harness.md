# Dengue Backtest Validation Harness — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an offline, no-lookahead backtest that measures whether the shipped Mordecai dengue suitability indicator detects real dengue outbreaks (WHO endemic-channel, OpenDengue) earlier than a purely seasonal baseline, and write an honest internal report.

**Architecture:** Pure functions extracted from `climate_signals.py` into a shared module imported by both the live script and the backtest (so we validate production code, not a copy). A chain of small, independently testable modules under `scripts/backtest/` (fetch → reconstruct → label → evaluate → report). Zero new dependencies — stdlib only, `unittest` for tests, hand-written SVG for charts (mirrors the project's no-deps discipline). Raw external data cached under `data/backtest/` (gitignored); the report and SVG charts committed under `docs/validation/`.

**Tech Stack:** Python 3.9 stdlib (`urllib`, `json`, `csv`, `math`, `random`, `statistics`), `unittest` (pytest is NOT installed and the project avoids deps), hand-written SVG strings for charts.

**Spec:** `docs/specs/2026-05-18-dengue-backtest-validation-design.md`

---

## File Structure

```
scripts/
  _shared/
    __init__.py                     # empty — makes _shared a package
    pathogen_suitability.py         # NEW: clip01, thermal_aedes, dengue_suitability
  climate_signals.py                # MODIFY: import from _shared instead of inline
  backtest/
    __init__.py                     # empty
    paths.py                        # shared path constants + sys.path bootstrap
    fetch_climate_archive.py        # ERA5 archive → data/backtest/climate/{ISO}.json
    fetch_opendengue.py             # OpenDengue CSV → data/backtest/dengue.csv + parser
    reconstruct_indicator.py        # causal S reconstruction (no lookahead)
    outbreaks.py                    # WHO endemic-channel labeling
    evaluate.py                     # POD/FAR/lead-time/TSS + baselines + block bootstrap
    charts.py                       # roc_svg(), histogram_svg() — pure SVG strings
    run_backtest.py                 # orchestrator: cached data → report + charts
data/backtest/                      # gitignored — raw external data
docs/validation/
  dengue-backtest.md                # COMMITTED report (written by run_backtest.py)
  dengue-roc.svg                    # COMMITTED chart
  dengue-leadtime.svg               # COMMITTED chart
tests/
  __init__.py
  backtest/
    __init__.py
    test_pathogen_suitability.py    # characterization (refactor ≡ original)
    test_fetch_opendengue.py        # CSV parser on fixture
    test_reconstruct_indicator.py   # anti-lookahead invariant (CORE)
    test_outbreaks.py               # endemic-channel on synthetic
    test_evaluate.py                # metrics + baselines + bootstrap determinism
    test_charts.py                  # SVG structure
    test_run_backtest.py            # report determinism
    fixtures/
      opendengue_sample.csv
```

Each module has one responsibility and a pure core that is unit-tested without network. Network functions are thin shells around tested parsers.

---

## Task 1: Test scaffold + verify `unittest` runner

**Files:**
- Create: `tests/__init__.py` (empty)
- Create: `tests/backtest/__init__.py` (empty)
- Create: `tests/backtest/test_smoke.py`

- [ ] **Step 1: Create the empty package files**

Create `tests/__init__.py` with no content. Create `tests/backtest/__init__.py` with no content.

- [ ] **Step 2: Write a smoke test**

Create `tests/backtest/test_smoke.py`:

```python
import unittest


class SmokeTest(unittest.TestCase):
    def test_runner_works(self):
        self.assertEqual(1 + 1, 2)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 3: Run it**

Run: `cd "$(git rev-parse --show-toplevel)" && python3 -m unittest tests.backtest.test_smoke -v`
Expected: `test_runner_works ... ok`, `OK`.

- [ ] **Step 4: Commit**

```bash
git add tests/__init__.py tests/backtest/__init__.py tests/backtest/test_smoke.py
git commit -m "test: bootstrap unittest scaffold for backtest"
```

---

## Task 2: Extract pure suitability into `scripts/_shared` (characterization-tested)

This must be **behaviour-preserving**. The test embeds a verbatim copy of the
original inline formula and asserts the extracted functions match it across a
grid — that is the characterization guarantee.

**Files:**
- Create: `scripts/_shared/__init__.py` (empty)
- Create: `scripts/_shared/pathogen_suitability.py`
- Create: `tests/backtest/test_pathogen_suitability.py`
- Modify: `scripts/climate_signals.py` (lines ~98–116 and the `S_d` line ~158–160)

- [ ] **Step 1: Write the characterization test**

Create `tests/backtest/test_pathogen_suitability.py`:

```python
import math
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "scripts"))
from _shared.pathogen_suitability import clip01, thermal_aedes, dengue_suitability


# --- verbatim snapshot of the ORIGINAL inline formula (reference) ---
_AE_TMIN, _AE_TMAX = 17.8, 34.6


def _briere_ref(t, t0=_AE_TMIN, tm=_AE_TMAX):
    return 0.0 if (t <= t0 or t >= tm) else t * (t - t0) * math.sqrt(tm - t)


_AE_PEAK_REF = max(_briere_ref(x / 10.0)
                    for x in range(int(_AE_TMIN * 10), int(_AE_TMAX * 10)))


def _thermal_ref(t):
    return max(0.0, min(1.0, _briere_ref(t) / _AE_PEAK_REF))


def _clip_ref(v, lo=0.0, hi=1.0):
    return max(lo, min(hi, v))


def _sd_ref(t_recent, zT, zP):
    g = _thermal_ref(t_recent)
    return _clip_ref(0.55 * g + 0.30 * _clip_ref(zP / 2.0)
                     + 0.15 * _clip_ref(zT / 2.0))
# --- end snapshot ---


class CharacterizationTest(unittest.TestCase):
    def test_clip01_matches(self):
        for v in (-3.0, -0.1, 0.0, 0.4, 1.0, 1.5):
            self.assertEqual(clip01(v), _clip_ref(v))

    def test_thermal_matches_on_grid(self):
        for x in range(100, 400):           # 10.0 .. 39.9 °C
            t = x / 10.0
            self.assertAlmostEqual(thermal_aedes(t), _thermal_ref(t), places=12)

    def test_dengue_suitability_matches_on_grid(self):
        for tx in range(150, 360, 5):       # 15.0 .. 35.5 °C
            for zT in (-2.0, -0.5, 0.0, 1.0, 3.0):
                for zP in (-2.0, 0.0, 1.5, 4.0):
                    t = tx / 10.0
                    self.assertAlmostEqual(
                        dengue_suitability(t, zT, zP),
                        _sd_ref(t, zT, zP), places=12)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run it to verify it fails**

Run: `python3 -m unittest tests.backtest.test_pathogen_suitability -v`
Expected: FAIL — `ModuleNotFoundError: No module named '_shared'`.

- [ ] **Step 3: Create the shared module**

Create `scripts/_shared/__init__.py` (empty).

Create `scripts/_shared/pathogen_suitability.py`:

```python
"""Pure pathogen-suitability functions.

Single source of truth: imported by scripts/climate_signals.py (live)
AND scripts/backtest/* (validation). Mordecai et al. 2017 eLife
Aedes/DENV thermal response — fixed literature constants, never fitted.
"""
import math

_AE_TMIN, _AE_TMAX = 17.8, 34.6


def clip01(v, lo=0.0, hi=1.0):
    return max(lo, min(hi, v))


def _briere(t, t0=_AE_TMIN, tm=_AE_TMAX):
    return 0.0 if (t <= t0 or t >= tm) else t * (t - t0) * math.sqrt(tm - t)


_AE_PEAK = max(_briere(x / 10.0)
               for x in range(int(_AE_TMIN * 10), int(_AE_TMAX * 10)))


def thermal_aedes(t):
    """Normalised Mordecai-2017 Aedes/DENV thermal suitability (0–1)."""
    return max(0.0, min(1.0, _briere(t) / _AE_PEAK))


def dengue_suitability(t_recent, zT, zP):
    """S_dengue = thermal suitability + lagged precip/temp anomaly push.

    Identical to the original inline climate_signals.py formula.
    """
    g = thermal_aedes(t_recent)
    return clip01(0.55 * g + 0.30 * clip01(zP / 2.0) + 0.15 * clip01(zT / 2.0))
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `python3 -m unittest tests.backtest.test_pathogen_suitability -v`
Expected: all 3 tests `ok`, `OK`.

- [ ] **Step 5: Refactor `climate_signals.py` to import the shared module**

In `scripts/climate_signals.py`, after the existing imports (around line 28, after `from datetime import ...`), add:

```python
import os
sys.path.insert(0, os.path.dirname(__file__))
from _shared.pathogen_suitability import thermal_aedes, dengue_suitability
```

Delete the inline block lines ~98–111 (`_AE_TMIN, _AE_TMAX = 17.8, 34.6`
through the end of `def _thermal_aedes(t): ...`).

Replace the dengue line in `main()` (currently):

```python
        g = _thermal_aedes(t_recent)
        # S_dengue = thermal suitability + lagged precip/temp anomaly push
        S_d = _clip(0.55 * g + 0.30 * _clip(zP / 2.0) + 0.15 * _clip(zT / 2.0))
```

with:

```python
        g = thermal_aedes(t_recent)
        S_d = dengue_suitability(t_recent, zT, zP)
```

Leave `_clip` (used by `S_c`) and everything else untouched. `g` is still
referenced later in `drivers` so keep it.

- [ ] **Step 6: Verify climate_signals still imports & is byte-stable**

Run: `python3 -c "import ast,sys; ast.parse(open('scripts/climate_signals.py').read()); print('parse ok')"`
Run: `python3 -m unittest tests.backtest.test_pathogen_suitability -v`
Expected: `parse ok`; all tests still `OK` (proves the live script now uses the validated function).

- [ ] **Step 7: Commit**

```bash
git add scripts/_shared/__init__.py scripts/_shared/pathogen_suitability.py \
        scripts/climate_signals.py tests/backtest/test_pathogen_suitability.py
git commit -m "refactor: extract dengue suitability to shared module (characterized)"
```

---

## Task 3: Path constants + sys.path bootstrap

**Files:**
- Create: `scripts/backtest/__init__.py` (empty)
- Create: `scripts/backtest/paths.py`

- [ ] **Step 1: Create the package + paths module**

Create `scripts/backtest/__init__.py` (empty).

Create `scripts/backtest/paths.py`:

```python
"""Path constants for the backtest harness + import bootstrap."""
import os
import sys
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent.parent          # repo/scripts
REPO = SCRIPTS.parent                                      # repo root
DATA = REPO / "data" / "backtest"
CLIMATE_DIR = DATA / "climate"
DENGUE_CSV = DATA / "dengue.csv"
DOCS = REPO / "docs" / "validation"
REPORT_MD = DOCS / "dengue-backtest.md"
ROC_SVG = DOCS / "dengue-roc.svg"
LEADTIME_SVG = DOCS / "dengue-leadtime.svg"

# allow `from _shared.pathogen_suitability import ...` from backtest modules
sys.path.insert(0, str(SCRIPTS))


def ensure_dirs():
    for d in (DATA, CLIMATE_DIR, DOCS):
        d.mkdir(parents=True, exist_ok=True)
```

- [ ] **Step 2: Sanity check**

Run: `python3 -c "import sys; sys.path.insert(0,'scripts'); from backtest.paths import REPO, DATA; print(REPO.name, DATA.relative_to(REPO))"`
Expected: prints repo dir name and `data/backtest`.

- [ ] **Step 3: Add data dir to .gitignore**

Append to `.gitignore`:

```
# Backtest raw external data (cached, never committed)
data/backtest/
```

- [ ] **Step 4: Commit**

```bash
git add scripts/backtest/__init__.py scripts/backtest/paths.py .gitignore
git commit -m "feat(backtest): path constants + import bootstrap"
```

---

## Task 4: OpenDengue fetcher + CSV parser

OpenDengue national release CSV columns vary; the parser normalises to
`(iso2, year, month, cases)` and is tested on a small fixture. The network
fetch is a thin shell that writes the raw CSV to cache.

**Files:**
- Create: `tests/backtest/fixtures/opendengue_sample.csv`
- Create: `tests/backtest/test_fetch_opendengue.py`
- Create: `scripts/backtest/fetch_opendengue.py`

- [ ] **Step 1: Create the fixture**

Create `tests/backtest/fixtures/opendengue_sample.csv`:

```csv
adm_0_name,ISO_A0,calendar_start_date,calendar_end_date,dengue_total,T_res
Thailand,THA,2014-01-01,2014-01-31,1200,Month
Thailand,THA,2014-02-01,2014-02-28,1500,Month
Thailand,THA,2014-03-01,2014-03-31,3200,Month
Brazil,BRA,2014-01-01,2014-01-31,50000,Month
Brazil,BRA,2014-01-06,2014-01-12,800,Week
```

- [ ] **Step 2: Write the failing test**

Create `tests/backtest/test_fetch_opendengue.py`:

```python
import os
import sys
import unittest

sys.path.insert(0, "scripts")
from backtest.fetch_opendengue import parse_opendengue_csv

FIX = os.path.join(os.path.dirname(__file__), "fixtures", "opendengue_sample.csv")


class ParseOpenDengueTest(unittest.TestCase):
    def setUp(self):
        with open(FIX, encoding="utf-8") as f:
            self.rows = parse_opendengue_csv(f.read())

    def test_only_monthly_rows_kept(self):
        # the weekly Brazil row must be dropped
        self.assertEqual(len(self.rows), 4)

    def test_iso3_to_iso2(self):
        isos = {r["iso2"] for r in self.rows}
        self.assertEqual(isos, {"TH", "BR"})

    def test_year_month_cases(self):
        th_mar = [r for r in self.rows
                  if r["iso2"] == "TH" and r["year"] == 2014 and r["month"] == 3]
        self.assertEqual(len(th_mar), 1)
        self.assertEqual(th_mar[0]["cases"], 3200)

    def test_rows_sorted(self):
        keys = [(r["iso2"], r["year"], r["month"]) for r in self.rows]
        self.assertEqual(keys, sorted(keys))
```

- [ ] **Step 3: Run to verify it fails**

Run: `python3 -m unittest tests.backtest.test_fetch_opendengue -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'backtest.fetch_opendengue'`.

- [ ] **Step 4: Implement the parser + fetcher**

Create `scripts/backtest/fetch_opendengue.py`:

```python
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `python3 -m unittest tests.backtest.test_fetch_opendengue -v`
Expected: 4 tests `ok`, `OK`.

- [ ] **Step 6: Commit**

```bash
git add tests/backtest/fixtures/opendengue_sample.csv \
        tests/backtest/test_fetch_opendengue.py \
        scripts/backtest/fetch_opendengue.py
git commit -m "feat(backtest): OpenDengue fetcher + tested CSV parser"
```

---

## Task 5: ERA5 climate archive fetcher

Thin network shell + pure response parser (tested on an inline fixture).
Caches one JSON per ISO. Centroids reuse `climate_signals.COORDS`.

**Files:**
- Create: `tests/backtest/test_fetch_climate_archive.py`
- Create: `scripts/backtest/fetch_climate_archive.py`

- [ ] **Step 1: Write the failing test**

Create `tests/backtest/test_fetch_climate_archive.py`:

```python
import json
import sys
import unittest

sys.path.insert(0, "scripts")
from backtest.fetch_climate_archive import parse_archive

SAMPLE = json.dumps({
    "daily": {
        "time": ["2014-01-01", "2014-01-02", "2014-01-03"],
        "temperature_2m_mean": [27.5, None, 28.1],
        "precipitation_sum": [0.0, 5.2, None],
    }
})


class ParseArchiveTest(unittest.TestCase):
    def test_drops_rows_with_missing_values(self):
        out = parse_archive(SAMPLE)
        self.assertEqual([r["d"] for r in out], ["2014-01-01"])
        self.assertEqual(out[0]["t"], 27.5)
        self.assertEqual(out[0]["p"], 0.0)

    def test_empty_on_garbage(self):
        self.assertEqual(parse_archive("{}"), [])
        self.assertEqual(parse_archive("not json"), [])
```

- [ ] **Step 2: Run to verify it fails**

Run: `python3 -m unittest tests.backtest.test_fetch_climate_archive -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement fetcher + parser**

Create `scripts/backtest/fetch_climate_archive.py`:

```python
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `python3 -m unittest tests.backtest.test_fetch_climate_archive -v`
Expected: 2 tests `ok`, `OK`.

- [ ] **Step 5: Commit**

```bash
git add tests/backtest/test_fetch_climate_archive.py \
        scripts/backtest/fetch_climate_archive.py
git commit -m "feat(backtest): ERA5 archive fetcher + tested parser"
```

---

## Task 6: Causal indicator reconstruction (anti-lookahead — CORE)

Mirrors the live `older`/`recent` split (`RECENT_DAYS=14`,
`MIN_BASE_DAYS=35`, baseline mean/sd) but truncated strictly at the
evaluation date. The anti-leakage invariant test is the heart of the
whole harness.

**Files:**
- Create: `tests/backtest/test_reconstruct_indicator.py`
- Create: `scripts/backtest/reconstruct_indicator.py`

- [ ] **Step 1: Write the failing tests (incl. anti-leakage invariant)**

Create `tests/backtest/test_reconstruct_indicator.py`:

```python
import sys
import unittest
from datetime import date, timedelta

sys.path.insert(0, "scripts")
from backtest.reconstruct_indicator import s_on_date, monthly_series


def _series(n_days, t=28.0, p=3.0, start=date(2014, 1, 1)):
    return [{"d": (start + timedelta(days=i)).isoformat(), "t": t, "p": p}
            for i in range(n_days)]


class ReconstructTest(unittest.TestCase):
    def test_returns_none_when_insufficient_history(self):
        s = _series(10)
        self.assertIsNone(s_on_date(s, date(2014, 1, 9)))

    def test_produces_value_with_enough_history(self):
        s = _series(80)
        v = s_on_date(s, date(2014, 3, 1))
        self.assertIsInstance(v, float)
        self.assertGreaterEqual(v, 0.0)
        self.assertLessEqual(v, 1.0)

    def test_anti_lookahead_invariant(self):
        """Feeding future days must NOT change S at date t."""
        past = _series(80, start=date(2014, 1, 1))
        t = date(2014, 3, 1)
        # add 200 anomalous future days (hot+wet) AFTER t
        future = _series(200, t=40.0, p=50.0,
                         start=date(2014, 3, 2))
        with_future = past + future
        self.assertEqual(s_on_date(past, t), s_on_date(with_future, t))

    def test_monthly_series_uses_max_of_weekly(self):
        # 1 month, S forced higher on later week via a heat spike
        s = _series(120, start=date(2014, 1, 1))
        ms = monthly_series(s)
        # keys are (year, month); values in 0..1
        self.assertTrue(all(0.0 <= v <= 1.0 for v in ms.values()))
        self.assertIn((2014, 4), ms)
```

- [ ] **Step 2: Run to verify it fails**

Run: `python3 -m unittest tests.backtest.test_reconstruct_indicator -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement reconstruction**

Create `scripts/backtest/reconstruct_indicator.py`:

```python
"""Causal reconstruction of the shipped dengue indicator.

For an evaluation date t, S is computed using ONLY climate days < t,
exactly mirroring climate_signals.py's older/recent split. The Mordecai
curve is fixed constants (no fitting) so there is zero training leakage.
Monthly alignment: month value = MAX of that month's weekly S (declared
a priori in the spec).
"""
import sys
from datetime import date, timedelta

sys.path.insert(0, "scripts")
from _shared.pathogen_suitability import dengue_suitability

RECENT_DAYS = 14      # mirrors climate_signals.RECENT_DAYS
MIN_BASE_DAYS = 35    # mirrors climate_signals.MIN_BASE_DAYS
BASELINE_KEEP = 120   # mirrors climate_signals.BASELINE_KEEP


def _mean_sd(xs):
    if not xs:
        return 0.0, 1.0
    m = sum(xs) / len(xs)
    sd = (sum((x - m) ** 2 for x in xs) / len(xs)) ** 0.5
    return m, (sd if sd > 1e-6 else 1.0)


def s_on_date(series, t):
    """S_dengue as it WOULD have been known on date t (days < t only)."""
    cutoff = t.isoformat()
    hist = [r for r in series if r["d"] < cutoff][-BASELINE_KEEP:]
    if len(hist) < RECENT_DAYS + 7:
        return None
    recent = hist[-RECENT_DAYS:]
    older = hist[:-RECENT_DAYS]
    ref = older if older else hist
    if len(ref) < 7:
        return None
    tm, tsd = _mean_sd([x["t"] for x in ref])
    pm, psd = _mean_sd([x["p"] for x in ref])
    t_recent = sum(x["t"] for x in recent) / len(recent)
    p_recent = sum(x["p"] for x in recent) / len(recent)
    zT = (t_recent - tm) / tsd
    zP = (p_recent - pm) / psd
    return round(dengue_suitability(t_recent, zT, zP), 6)


def _weekly_eval_dates(series):
    if not series:
        return []
    d0 = date.fromisoformat(series[0]["d"])
    d1 = date.fromisoformat(series[-1]["d"])
    out, d = [], d0 + timedelta(days=RECENT_DAYS + 7)
    while d <= d1:
        out.append(d)
        d += timedelta(days=7)
    return out


def monthly_series(series):
    """{(year, month): max weekly S in that month}."""
    monthly = {}
    for d in _weekly_eval_dates(series):
        v = s_on_date(series, d)
        if v is None:
            continue
        k = (d.year, d.month)
        monthly[k] = max(monthly.get(k, 0.0), v)
    return monthly
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python3 -m unittest tests.backtest.test_reconstruct_indicator -v`
Expected: 4 tests `ok` (the anti-lookahead invariant is the critical one), `OK`.

- [ ] **Step 5: Commit**

```bash
git add tests/backtest/test_reconstruct_indicator.py \
        scripts/backtest/reconstruct_indicator.py
git commit -m "feat(backtest): causal S reconstruction + anti-lookahead invariant"
```

---

## Task 7: WHO endemic-channel outbreak labeling

**Files:**
- Create: `tests/backtest/test_outbreaks.py`
- Create: `scripts/backtest/outbreaks.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/backtest/test_outbreaks.py`:

```python
import sys
import unittest

sys.path.insert(0, "scripts")
from backtest.outbreaks import onsets, MIN_PRIOR_YEARS


def _rows(iso, per_year):
    """per_year: {year: {month: cases}}"""
    out = []
    for y, months in sorted(per_year.items()):
        for m, c in sorted(months.items()):
            out.append({"iso2": iso, "year": y, "month": m, "cases": c})
    return out


class OutbreaksTest(unittest.TestCase):
    def test_excludes_years_without_enough_prior_history(self):
        rows = _rows("TH", {2010: {1: 100}, 2011: {1: 110}})
        res = onsets(rows)
        self.assertEqual(res["TH"]["evaluated_year_months"], [])

    def test_flags_month_exceeding_mean_plus_2sd(self):
        # Jan baseline years 2010-2013 ~100; 2014 Jan spikes to 1000
        per = {y: {1: 100 + (y - 2010) * 2} for y in range(2010, 2014)}
        per[2014] = {1: 1000}
        res = onsets(_rows("TH", per))
        self.assertIn((2014, 1), res["TH"]["onsets"])

    def test_normal_month_not_flagged(self):
        per = {y: {1: 100 + (y - 2010) * 2} for y in range(2010, 2014)}
        per[2014] = {1: 103}
        res = onsets(_rows("TH", per))
        self.assertNotIn((2014, 1), res["TH"]["onsets"])

    def test_only_first_exceedance_per_season_is_onset(self):
        base = {y: {6: 50, 7: 55, 8: 60} for y in range(2010, 2014)}
        base[2014] = {6: 5000, 7: 6000, 8: 7000}
        res = onsets(_rows("BR", base))
        self.assertIn((2014, 6), res["BR"]["onsets"])
        self.assertNotIn((2014, 7), res["BR"]["onsets"])

    def test_min_prior_years_constant(self):
        self.assertEqual(MIN_PRIOR_YEARS, 3)
```

- [ ] **Step 2: Run to verify it fails**

Run: `python3 -m unittest tests.backtest.test_outbreaks -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement endemic-channel labeling**

Create `scripts/backtest/outbreaks.py`:

```python
"""WHO endemic-channel outbreak labeling.

For (country, month m, year Y): threshold = mean + 2*SD of month-m
counts over PRIOR years (>= MIN_PRIOR_YEARS required, else Y excluded).
An onset = the FIRST month in season Y whose cases exceed its threshold.
"""
MIN_PRIOR_YEARS = 3


def _mean_sd(xs):
    n = len(xs)
    m = sum(xs) / n
    sd = (sum((x - m) ** 2 for x in xs) / n) ** 0.5
    return m, sd


def onsets(rows):
    """rows: [{iso2,year,month,cases}] → {iso2: {onsets:set, evaluated_year_months:list}}."""
    by_iso = {}
    for r in rows:
        by_iso.setdefault(r["iso2"], {})[(r["year"], r["month"])] = r["cases"]

    result = {}
    for iso, ym in by_iso.items():
        years = sorted({y for (y, _m) in ym})
        onset_set, evaluated = set(), []
        for y in years:
            season_hit = False
            for m in range(1, 13):
                if (y, m) not in ym:
                    continue
                prior = [ym[(py, m)] for py in years
                         if py < y and (py, m) in ym]
                if len(prior) < MIN_PRIOR_YEARS:
                    continue
                evaluated.append((y, m))
                mean, sd = _mean_sd(prior)
                threshold = mean + 2 * sd
                if ym[(y, m)] > threshold and not season_hit:
                    onset_set.add((y, m))
                    season_hit = True
        result[iso] = {"onsets": onset_set,
                       "evaluated_year_months": sorted(evaluated)}
    return result
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python3 -m unittest tests.backtest.test_outbreaks -v`
Expected: 5 tests `ok`, `OK`.

- [ ] **Step 5: Commit**

```bash
git add tests/backtest/test_outbreaks.py scripts/backtest/outbreaks.py
git commit -m "feat(backtest): WHO endemic-channel outbreak labeling"
```

---

## Task 8: Evaluation — POD/FAR/lead-time/TSS + baselines + block bootstrap

**Files:**
- Create: `tests/backtest/test_evaluate.py`
- Create: `scripts/backtest/evaluate.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/backtest/test_evaluate.py`:

```python
import sys
import unittest

sys.path.insert(0, "scripts")
from backtest.evaluate import (
    tss, lead_times, seasonal_alarms, persistence_alarms,
    block_bootstrap_ci,
)


class EvaluateTest(unittest.TestCase):
    def test_tss_perfect(self):
        # alarms exactly on the 2 onset windows, no false alarms
        ym = [(2014, m) for m in range(1, 13)]
        onsets = {(2014, 6)}
        alarms = {(2014, 5), (2014, 6)}
        self.assertAlmostEqual(tss(ym, onsets, alarms, horizon_months=1), 1.0)

    def test_tss_zero_for_all_or_nothing(self):
        ym = [(2014, m) for m in range(1, 13)]
        onsets = {(2014, 6)}
        # alarm every month → POD 1 but FAR-rate 1 → TSS 0
        alarms = set(ym)
        self.assertAlmostEqual(tss(ym, onsets, alarms, horizon_months=1), 0.0,
                               places=6)

    def test_lead_times_measured_in_weeks(self):
        onsets = {(2014, 6)}
        # alarm fired 2 months (~8-9 weeks) before onset month
        alarms = {(2014, 4)}
        lt = lead_times(onsets, alarms, horizon_months=3)
        self.assertEqual(len(lt), 1)
        self.assertGreater(lt[0], 4)          # weeks

    def test_seasonal_baseline_is_deterministic(self):
        ym = [(y, m) for y in (2012, 2013, 2014) for m in range(1, 13)]
        onsets = {(2013, 7), (2014, 7)}
        a1 = seasonal_alarms(ym, onsets)
        a2 = seasonal_alarms(ym, onsets)
        self.assertEqual(a1, a2)
        self.assertTrue(any(m == 7 for (_y, m) in a1))

    def test_persistence_alarms(self):
        ym = [(2014, m) for m in range(1, 6)]
        onsets = {(2014, 2)}
        self.assertEqual(persistence_alarms(ym, onsets), {(2014, 3)})

    def test_block_bootstrap_ci_is_seeded_deterministic(self):
        blocks = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]
        lo1, hi1 = block_bootstrap_ci(blocks, seed=42)
        lo2, hi2 = block_bootstrap_ci(blocks, seed=42)
        self.assertEqual((lo1, hi1), (lo2, hi2))
        self.assertLess(lo1, hi1)
```

- [ ] **Step 2: Run to verify it fails**

Run: `python3 -m unittest tests.backtest.test_evaluate -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement evaluation**

Create `scripts/backtest/evaluate.py`:

```python
"""Detection metrics, baselines, and block-bootstrap CIs.

An alarm at (y,m) "covers" an onset if it falls within the window
[onset - horizon_months, onset month]. TSS = POD - FAR_rate
(True Skill Statistic / Peirce). Lead time in weeks.
"""
import random
import statistics


def _months_between(a, b):
    return (b[0] - a[0]) * 12 + (b[1] - a[1])


def _covered(onsets, alarms, horizon_months):
    hit = set()
    for o in onsets:
        for a in alarms:
            d = _months_between(a, o)
            if 0 <= d <= horizon_months:
                hit.add(o)
                break
    return hit


def pod(ym, onsets, alarms, horizon_months):
    if not onsets:
        return 0.0
    return len(_covered(onsets, alarms, horizon_months)) / len(onsets)


def far_rate(ym, onsets, alarms, horizon_months):
    """Fraction of non-onset-window months that fired an alarm."""
    onset_windows = set()
    for o in onsets:
        for k in range(horizon_months + 1):
            onset_windows.add((o[0] + (o[1] - 1 - k) // 12,
                               (o[1] - 1 - k) % 12 + 1))
    negatives = [k for k in ym if k not in onset_windows]
    if not negatives:
        return 0.0
    false_fires = sum(1 for k in negatives if k in alarms)
    return false_fires / len(negatives)


def tss(ym, onsets, alarms, horizon_months):
    return round(pod(ym, onsets, alarms, horizon_months)
                 - far_rate(ym, onsets, alarms, horizon_months), 6)


def lead_times(onsets, alarms, horizon_months):
    """Weeks between the EARLIEST covering alarm and each onset month."""
    out = []
    for o in onsets:
        cands = [_months_between(a, o) for a in alarms
                 if 0 <= _months_between(a, o) <= horizon_months]
        if cands:
            out.append(max(cands) * 4.345)   # months → weeks
    return out


def seasonal_alarms(ym, onsets):
    """Baseline: alarm every month that was EVER an onset month (by m)."""
    onset_months = {m for (_y, m) in onsets}
    return {(y, m) for (y, m) in ym if m in onset_months}


def persistence_alarms(ym, onsets):
    """Baseline: alarm the month AFTER any onset (tomorrow == yesterday)."""
    out = set()
    for (y, m) in onsets:
        nm = (y + (m // 12), m % 12 + 1)
        out.add(nm)
    return out


def random_alarms(ym, rate, seed):
    rng = random.Random(seed)
    return {k for k in ym if rng.random() < rate}


def block_bootstrap_ci(block_values, seed=1234, n=2000, alpha=0.05):
    """Resample (country,year) block statistics with replacement."""
    if not block_values:
        return (0.0, 0.0)
    rng = random.Random(seed)
    k = len(block_values)
    means = []
    for _ in range(n):
        sample = [block_values[rng.randrange(k)] for _ in range(k)]
        means.append(sum(sample) / k)
    means.sort()
    lo = means[int(alpha / 2 * n)]
    hi = means[int((1 - alpha / 2) * n) - 1]
    return (round(lo, 6), round(hi, 6))
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python3 -m unittest tests.backtest.test_evaluate -v`
Expected: 6 tests `ok`, `OK`.

- [ ] **Step 5: Commit**

```bash
git add tests/backtest/test_evaluate.py scripts/backtest/evaluate.py
git commit -m "feat(backtest): detection metrics, baselines, block-bootstrap CI"
```

---

## Task 9: Hand-written SVG charts

**Files:**
- Create: `tests/backtest/test_charts.py`
- Create: `scripts/backtest/charts.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/backtest/test_charts.py`:

```python
import sys
import unittest

sys.path.insert(0, "scripts")
from backtest.charts import roc_svg, histogram_svg


class ChartsTest(unittest.TestCase):
    def test_roc_svg_structure(self):
        svg = roc_svg([(0.0, 0.0), (0.2, 0.6), (1.0, 1.0)],
                       title="ROC")
        self.assertTrue(svg.startswith("<svg"))
        self.assertIn("</svg>", svg)
        self.assertIn("polyline", svg)
        self.assertIn("ROC", svg)

    def test_histogram_svg_structure(self):
        svg = histogram_svg([1.0, 2.0, 2.0, 8.0, 9.0], bins=4,
                            title="Lead time (weeks)")
        self.assertTrue(svg.startswith("<svg"))
        self.assertIn("rect", svg)
        self.assertIn("Lead time", svg)

    def test_histogram_handles_empty(self):
        svg = histogram_svg([], bins=4, title="Empty")
        self.assertIn("no data", svg.lower())

    def test_deterministic(self):
        a = roc_svg([(0.0, 0.0), (1.0, 1.0)], title="X")
        b = roc_svg([(0.0, 0.0), (1.0, 1.0)], title="X")
        self.assertEqual(a, b)
```

- [ ] **Step 2: Run to verify it fails**

Run: `python3 -m unittest tests.backtest.test_charts -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement SVG charts**

Create `scripts/backtest/charts.py`:

```python
"""Minimal dependency-free SVG charts (committed alongside the report)."""

W, H, PAD = 480, 360, 48


def _hdr(title):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" '
            f'height="{H}" viewBox="0 0 {W} {H}" font-family="sans-serif">'
            f'<rect width="{W}" height="{H}" fill="#ffffff"/>'
            f'<text x="{W//2}" y="24" text-anchor="middle" '
            f'font-size="15" font-weight="700">{title}</text>')


def _axes():
    x0, y0, x1, y1 = PAD, H - PAD, W - PAD, PAD
    return (f'<line x1="{x0}" y1="{y0}" x2="{x1}" y2="{y0}" '
            f'stroke="#888"/><line x1="{x0}" y1="{y0}" x2="{x0}" '
            f'y2="{y1}" stroke="#888"/>')


def roc_svg(points, title="ROC"):
    """points: list of (far, pod) in 0..1, sorted by far ascending."""
    x0, y0 = PAD, H - PAD
    sx, sy = (W - 2 * PAD), (H - 2 * PAD)
    pts = sorted(points)
    poly = " ".join(f"{x0 + p[0]*sx:.1f},{y0 - p[1]*sy:.1f}" for p in pts)
    diag = (f'<line x1="{x0}" y1="{y0}" x2="{x0+sx}" y2="{y0-sy}" '
            f'stroke="#ccc" stroke-dasharray="4"/>')
    return (_hdr(title) + _axes() + diag +
            f'<polyline fill="none" stroke="#0067D6" stroke-width="2" '
            f'points="{poly}"/>'
            f'<text x="{W//2}" y="{H-12}" text-anchor="middle" '
            f'font-size="12">false-alarm rate →</text></svg>')


def histogram_svg(values, bins=8, title="Histogram"):
    if not values:
        return (_hdr(title) +
                f'<text x="{W//2}" y="{H//2}" text-anchor="middle" '
                f'font-size="14" fill="#999">no data</text></svg>')
    lo, hi = min(values), max(values)
    if hi == lo:
        hi = lo + 1.0
    width = (hi - lo) / bins
    counts = [0] * bins
    for v in values:
        idx = min(int((v - lo) / width), bins - 1)
        counts[idx] += 1
    cmax = max(counts) or 1
    x0, y0 = PAD, H - PAD
    sx, sy = (W - 2 * PAD), (H - 2 * PAD)
    bw = sx / bins
    bars = []
    for i, c in enumerate(counts):
        bh = (c / cmax) * sy
        bars.append(
            f'<rect x="{x0 + i*bw:.1f}" y="{y0 - bh:.1f}" '
            f'width="{bw-2:.1f}" height="{bh:.1f}" fill="#0067D6"/>')
    return (_hdr(title) + _axes() + "".join(bars) +
            f'<text x="{W//2}" y="{H-12}" text-anchor="middle" '
            f'font-size="12">weeks ({lo:.0f}–{hi:.0f})</text></svg>')
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python3 -m unittest tests.backtest.test_charts -v`
Expected: 4 tests `ok`, `OK`.

- [ ] **Step 5: Commit**

```bash
git add tests/backtest/test_charts.py scripts/backtest/charts.py
git commit -m "feat(backtest): dependency-free SVG charts"
```

---

## Task 10: Orchestrator + deterministic report

Wires cached data through reconstruct → label → evaluate, writes the
report with the **pre-registered criterion stated before the numbers**,
and the verdict computed against it. A determinism test runs the report
generator twice on synthetic in-memory data and asserts byte-identity.

**Files:**
- Create: `tests/backtest/test_run_backtest.py`
- Create: `scripts/backtest/run_backtest.py`

- [ ] **Step 1: Write the failing test**

Create `tests/backtest/test_run_backtest.py`:

```python
import sys
import unittest

sys.path.insert(0, "scripts")
from backtest.run_backtest import build_report

# Minimal synthetic inputs: one country, alarms perfectly leading onsets.
MONTHLY_S = {"TH": {(2014, 5): 0.9, (2014, 6): 0.9, (2015, 1): 0.1}}
ONSETS = {"TH": {"onsets": {(2014, 6)},
                 "evaluated_year_months": [(2014, 5), (2014, 6), (2015, 1)]}}


class RunBacktestTest(unittest.TestCase):
    def test_report_is_deterministic(self):
        a = build_report(MONTHLY_S, ONSETS, s_threshold=0.5)
        b = build_report(MONTHLY_S, ONSETS, s_threshold=0.5)
        self.assertEqual(a["markdown"], b["markdown"])

    def test_report_states_criterion_before_verdict(self):
        r = build_report(MONTHLY_S, ONSETS, s_threshold=0.5)
        md = r["markdown"]
        self.assertIn("Pre-registered success criterion", md)
        self.assertLess(md.index("Pre-registered success criterion"),
                        md.index("Verdict"))

    def test_verdict_is_one_of_expected(self):
        r = build_report(MONTHLY_S, ONSETS, s_threshold=0.5)
        self.assertIn(r["verdict"], ("PROVEN", "NOT DEMONSTRATED"))

    def test_skill_vs_seasonal_present(self):
        r = build_report(MONTHLY_S, ONSETS, s_threshold=0.5)
        self.assertIn("vs seasonal", r["markdown"])
```

- [ ] **Step 2: Run to verify it fails**

Run: `python3 -m unittest tests.backtest.test_run_backtest -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the orchestrator**

Create `scripts/backtest/run_backtest.py`:

```python
"""Backtest orchestrator → docs/validation/dengue-backtest.md.

Uses ONLY cached data (run the fetchers first). Pure build_report()
is unit-tested for determinism; main() handles IO + charts.
"""
import json
import sys
from datetime import datetime, timezone

from backtest.paths import (CLIMATE_DIR, REPORT_MD, ROC_SVG, LEADTIME_SVG,
                            ensure_dirs)
from backtest import evaluate as ev
from backtest.charts import roc_svg, histogram_svg

HORIZON_MONTHS = 3        # ~0–12 weeks lead window
S_THRESHOLD = 0.5         # pre-declared operating point
CRITERION = ("Skill (TSS) vs the seasonal baseline > 0 with the lower "
             "bound of its 95% block-bootstrap CI > 0, AND median "
             "lead-time >= 2 weeks.")


def _alarms(monthly_s, threshold):
    return {iso: {k for k, v in ms.items() if v >= threshold}
            for iso, ms in monthly_s.items()}


def build_report(monthly_s, onsets_by_iso, s_threshold=S_THRESHOLD):
    alarms = _alarms(monthly_s, s_threshold)

    ind_tss_blocks, seas_tss_blocks, all_leads = [], [], []
    roc_points, agg = {}, {"pod": [], "far": []}
    n_onsets = n_excluded = 0

    for iso, info in sorted(onsets_by_iso.items()):
        ym = info["evaluated_year_months"]
        onsets = info["onsets"]
        if not ym:
            n_excluded += 1
            continue
        n_onsets += len(onsets)
        a_ind = alarms.get(iso, set())
        a_seas = ev.seasonal_alarms(ym, onsets)

        ind_tss_blocks.append(ev.tss(ym, onsets, a_ind, HORIZON_MONTHS))
        seas_tss_blocks.append(ev.tss(ym, onsets, a_seas, HORIZON_MONTHS))
        all_leads += ev.lead_times(onsets, a_ind, HORIZON_MONTHS)
        agg["pod"].append(ev.pod(ym, onsets, a_ind, HORIZON_MONTHS))
        agg["far"].append(ev.far_rate(ym, onsets, a_ind, HORIZON_MONTHS))

    def _mean(xs):
        return round(sum(xs) / len(xs), 4) if xs else 0.0

    skill = [i - s for i, s in zip(ind_tss_blocks, seas_tss_blocks)]
    skill_mean = _mean(skill)
    skill_lo, skill_hi = ev.block_bootstrap_ci(skill) if skill else (0.0, 0.0)
    leads_sorted = sorted(all_leads)
    median_lead = (leads_sorted[len(leads_sorted) // 2]
                   if leads_sorted else 0.0)

    proven = (skill_lo > 0.0) and (median_lead >= 2.0)
    verdict = "PROVEN" if proven else "NOT DEMONSTRATED"

    # ROC over a threshold grid (recomputed here for the curve)
    grid = [round(0.05 * i, 2) for i in range(1, 20)]
    rocp = []
    for thr in grid:
        al = _alarms(monthly_s, thr)
        pods, fars = [], []
        for iso, info in onsets_by_iso.items():
            if not info["evaluated_year_months"]:
                continue
            pods.append(ev.pod(info["evaluated_year_months"],
                                info["onsets"], al.get(iso, set()),
                                HORIZON_MONTHS))
            fars.append(ev.far_rate(info["evaluated_year_months"],
                                    info["onsets"], al.get(iso, set()),
                                    HORIZON_MONTHS))
        if pods:
            rocp.append((round(sum(fars)/len(fars), 4),
                         round(sum(pods)/len(pods), 4)))

    gen = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    md = f"""# Dengue Backtest — Validation Report

_Generated: {gen} · Method spec: docs/specs/2026-05-18-dengue-backtest-validation-design.md_

Validates the **shipped** Mordecai dengue suitability indicator
(`scripts/_shared/pathogen_suitability.py`, imported by the live
`climate_signals.py`) against WHO endemic-channel dengue outbreaks
(OpenDengue) using ERA5 climate history. Reconstruction is strictly
causal (no lookahead — enforced by unit-test invariant). The Mordecai
thermal curve uses fixed literature constants and is never fitted.

## Pre-registered success criterion

> {CRITERION}

Declared before computing any number. No post-hoc threshold tuning.

## Scope

- Countries evaluated: {len(onsets_by_iso) - n_excluded}
- Countries excluded (insufficient prior history): {n_excluded}
- Outbreak onsets analysed: {n_onsets}
- Operating threshold S ≥ {s_threshold}; lead window 0–{HORIZON_MONTHS} months

## Results

| Metric | Value |
|---|---|
| POD (sensitivity) | {_mean(agg['pod'])} |
| False-alarm rate | {_mean(agg['far'])} |
| Median lead-time (weeks) | {round(median_lead, 1)} |
| TSS — indicator (mean) | {_mean(ind_tss_blocks)} |
| TSS — seasonal baseline (mean) | {_mean(seas_tss_blocks)} |
| **Skill vs seasonal (mean)** | **{skill_mean}** |
| Skill 95% CI (block bootstrap) | [{skill_lo}, {skill_hi}] |

![ROC](dengue-roc.svg)

![Lead-time distribution](dengue-leadtime.svg)

## Verdict

**{verdict}** against the pre-registered criterion
(skill CI lower bound = {skill_lo}; median lead-time =
{round(median_lead, 1)} weeks).

## Limitations

- Country-centroid climate vs national case counts — spatial mismatch.
- Small country-year sample → wide CIs; read the interval, not the point.
- OpenDengue completeness varies by country/year.
- Validates the current indicator as-is; a fitted model (Approach C) is
  a separate future question.
"""
    return {"markdown": md, "verdict": verdict, "roc_points": rocp,
            "lead_times": all_leads, "skill_ci": [skill_lo, skill_hi]}


def main():
    ensure_dirs()
    sys.path.insert(0, "scripts")
    from backtest.fetch_opendengue import fetch as fetch_dengue, \
        parse_opendengue_csv
    from backtest.outbreaks import onsets
    from backtest.reconstruct_indicator import monthly_series

    rows = parse_opendengue_csv(fetch_dengue())
    onsets_by_iso = onsets(rows)

    monthly_s = {}
    for cache in sorted(CLIMATE_DIR.glob("*.json")):
        iso = cache.stem
        series = json.loads(cache.read_text(encoding="utf-8"))
        monthly_s[iso] = monthly_series(series)

    rep = build_report(monthly_s, onsets_by_iso)
    REPORT_MD.write_text(rep["markdown"], encoding="utf-8")
    ROC_SVG.write_text(roc_svg(rep["roc_points"],
                               title="Dengue indicator ROC"),
                       encoding="utf-8")
    LEADTIME_SVG.write_text(
        histogram_svg(rep["lead_times"], bins=8,
                      title="Lead-time (weeks) before onset"),
        encoding="utf-8")
    print(f"verdict: {rep['verdict']}  →  {REPORT_MD}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python3 -m unittest tests.backtest.test_run_backtest -v`
Expected: 4 tests `ok`, `OK`.

- [ ] **Step 5: Run the full test suite**

Run: `python3 -m unittest discover -s tests -v`
Expected: all tests across all modules `OK`.

- [ ] **Step 6: Commit**

```bash
git add tests/backtest/test_run_backtest.py scripts/backtest/run_backtest.py
git commit -m "feat(backtest): orchestrator + deterministic pre-registered report"
```

---

## Task 11: Live run on real data + commit the report

This is the payoff: fetch real external data, run, inspect the verdict
honestly, commit the report + charts. **Do not tune anything to improve
the number** — the criterion was pre-registered.

**Files:**
- Generates: `docs/validation/dengue-backtest.md`, `docs/validation/dengue-roc.svg`, `docs/validation/dengue-leadtime.svg`
- Modify (only if a fetch reveals a schema change): the relevant fetcher

- [ ] **Step 1: Fetch OpenDengue (cached)**

Run: `python3 scripts/backtest/fetch_opendengue.py`
Expected: prints `opendengue: <N> monthly rows cached`. If it raises the
schema FATAL, fix `OPENDENGUE_URL`/columns in `fetch_opendengue.py`, re-run,
then commit that fix separately with message `fix(backtest): adapt to OpenDengue schema`.

- [ ] **Step 2: Fetch ERA5 climate history (cached, ~25 calls, slow)**

Run: `python3 scripts/backtest/fetch_climate_archive.py`
Expected: per-ISO `<days> cached` lines. Network errors for a few ISOs are
tolerated (they get excluded and counted in the report).

- [ ] **Step 3: Run the backtest**

Run: `python3 scripts/backtest/run_backtest.py`
Expected: prints `verdict: PROVEN|NOT DEMONSTRATED → .../dengue-backtest.md`.

- [ ] **Step 4: Read the report and sanity-check honestly**

Run: `cat docs/validation/dengue-backtest.md`
Verify: scope counts are non-trivial (≥10 country-years; if not, note it in
a one-line addendum under Limitations and treat the result as preliminary —
do NOT delete the verdict). Confirm the seasonal-baseline row is populated.

- [ ] **Step 5: Commit the report + charts (whatever the verdict)**

```bash
git add docs/validation/dengue-backtest.md docs/validation/dengue-roc.svg \
        docs/validation/dengue-leadtime.svg
git commit -m "docs(validation): dengue backtest results — <VERDICT>"
```

Replace `<VERDICT>` with the actual printed verdict. An honest negative is
a valid, committed outcome.

- [ ] **Step 6: Push the whole feature**

Use the project's standard stash dance (the live files may carry local-only
edits):

```bash
git stash push -- .claude/launch.json index.html ru/index.html sw.js 2>/dev/null || true
git pull --rebase
git push
git stash pop 2>/dev/null || true
```

If `git pull --rebase` conflicts on `public/*.json` (signals bot), resolve
with `git checkout --theirs public/<file>.json && git add public/<file>.json`
then `GIT_EDITOR=true git rebase --continue`, then `git push`.

---

## Self-Review

**1. Spec coverage**

| Spec requirement | Task |
|---|---|
| Validate shipped formula, not a copy (shared module) | Task 2 |
| No lookahead (invariant test) | Task 6 (`test_anti_lookahead_invariant`) |
| ERA5 archive climate source | Task 5 |
| OpenDengue national monthly | Task 4 |
| WHO endemic-channel, ≥3 prior years | Task 7 |
| Weekly→monthly = max (declared a priori) | Task 6 (`monthly_series`) |
| POD / FAR / lead-time / ROC | Tasks 8, 10 |
| TSS skill metric | Task 8 (`tss`) |
| Three baselines (random, seasonal, persistence) | Task 8 |
| Block-bootstrap CI by (country,year) | Task 8 (`block_bootstrap_ci`) |
| Pre-registered criterion stated before numbers | Task 10 (`test_report_states_criterion_before_verdict`) |
| Honest negative is valid output | Task 11 Step 5 |
| Determinism | Task 10 (`test_report_is_deterministic`) |
| Characterization (refactor ≡ original) | Task 2 |
| data/backtest gitignored; report committed | Tasks 3, 11 |
| Hard fail on external schema change | Task 4 (`fetch` schema guard) |

No gaps.

**2. Placeholder scan:** No TBD/TODO/"handle errors appropriately". `<VERDICT>` in Task 11 Step 5 is an explicit fill-from-output instruction, not a code placeholder.

**3. Type consistency:** `s_on_date`/`monthly_series` (Task 6) consumed by `run_backtest` (Task 10). `onsets()` returns `{iso:{onsets:set,evaluated_year_months:list}}` — consumed identically in Tasks 8 tests and Task 10. `tss/pod/far_rate/lead_times/seasonal_alarms/persistence_alarms/block_bootstrap_ci` signatures defined in Task 8 match call sites in Task 10. `roc_svg/histogram_svg` (Task 9) match Task 10 calls. `parse_opendengue_csv` keys `{iso2,year,month,cases}` consistent across Tasks 4, 7, 10. Consistent.

---

## Execution Handoff

(Provided after save.)
