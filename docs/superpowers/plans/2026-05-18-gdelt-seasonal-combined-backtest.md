# GDELT × Seasonal-Prior Combined Backtest (Phase 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Measure, honestly and out-of-sample, whether a seasonal prior P₀(region,month) updated by a REAL GDELT health-news anomaly beats the bare seasonal prior — a decision-grade go/no-go.

**Architecture:** Reuse the merged backtest harness (`outbreaks.py` endemic-channel onsets, `evaluate.block_bootstrap_ci`, `charts.py`, cached OpenDengue). Add four offline-only modules: real GDELT fetcher, Laplace seasonal prior, offset-logistic scorer + metrics, expanding-window OOS orchestrator with a deterministic committed report.

**Tech Stack:** Python 3.9, `numpy` (already installed, 1.26.4) for the offset-logistic fit + PR-AUC/Brier. **Deviation from spec, intentional:** the spec named `scikit-learn`; sklearn is NOT installed and a single-covariate offset-logistic + AP/Brier is ~30 lines of numpy. Implementing in numpy honors the project's dependency discipline and tightens the fence (only numpy, already present, inside `scripts/backtest/`). No sklearn. `requirements-backtest.txt` therefore pins only `numpy`. Tests: `python3 -m unittest`, canonical `discover -t . -s tests` (`-t .` required — two `backtest` packages; accepted convention).

**Spec:** `docs/specs/2026-05-18-gdelt-seasonal-combined-backtest-design.md`

---

## File Structure

```
scripts/backtest/
  paths.py                # MODIFY: add GDELT_DIR + gdelt report/chart paths; ensure_dirs
  fetch_gdelt.py          # NEW: real GDELT DOC 2.0 → data/backtest/gdelt/{ISO}.json (cached)
  seasonal_prior.py       # NEW: P0(r,m,Y) Laplace, strictly-prior years + onset labels
  score_model.py          # NEW: causal_z, offset-logistic fit (numpy IRLS), posterior, pr_auc, brier
  backtest_combined.py    # NEW: expanding-window OOS, deterministic report
  (reuse) outbreaks.py, evaluate.py, charts.py
requirements-backtest.txt # NEW: numpy (offline-only)
data/backtest/gdelt/      # gitignored cache (data/backtest/ already gitignored)
docs/validation/gdelt-combined-backtest.md   # COMMITTED report (+ 2 SVG)
tests/backtest/
  test_dependency_fence.py
  test_fetch_gdelt.py
  test_seasonal_prior.py
  test_score_model.py
  test_backtest_combined.py
  fixtures/gdelt_sample.json
```

Reused as-is: `outbreaks.onsets(rows)` → `{iso:{onsets:set, evaluated_year_months:list}}`; `evaluate.block_bootstrap_ci(block_values, seed=1234, n=2000, alpha=0.05)`; `charts.roc_svg(points,title)`, `charts.histogram_svg(values,bins,title)`; `fetch_opendengue.parse_opendengue_csv`.

---

## Task 1: Dependency fence + paths + requirements

**Files:**
- Create: `requirements-backtest.txt`
- Modify: `scripts/backtest/paths.py`
- Create: `tests/backtest/test_dependency_fence.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/backtest/test_dependency_fence.py`:

```python
import os
import re
import sys
import unittest

sys.path.insert(0, "scripts")
from backtest.paths import GDELT_DIR, GDELT_REPORT_MD, GDELT_ROC_SVG, GDELT_PR_SVG

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SCRIPTS = os.path.join(REPO, "scripts")
_BAD = re.compile(r"^\s*(import|from)\s+(numpy|sklearn|scipy|pandas)\b", re.M)


class DependencyFenceTest(unittest.TestCase):
    def test_no_heavy_deps_outside_backtest(self):
        offenders = []
        for root, _dirs, files in os.walk(SCRIPTS):
            if os.path.join("scripts", "backtest") in root:
                continue
            for fn in files:
                if not fn.endswith(".py"):
                    continue
                p = os.path.join(root, fn)
                with open(p, encoding="utf-8") as f:
                    if _BAD.search(f.read()):
                        offenders.append(os.path.relpath(p, REPO))
        self.assertEqual(offenders, [], f"heavy deps leaked: {offenders}")

    def test_gdelt_paths_under_data_backtest(self):
        self.assertTrue(str(GDELT_DIR).endswith("data/backtest/gdelt"))
        self.assertTrue(str(GDELT_REPORT_MD).endswith(
            "docs/validation/gdelt-combined-backtest.md"))
        self.assertTrue(str(GDELT_ROC_SVG).endswith("gdelt-roc.svg"))
        self.assertTrue(str(GDELT_PR_SVG).endswith("gdelt-pr.svg"))
```

- [ ] **Step 2: Run to verify it fails**

Run: `python3 -m unittest tests.backtest.test_dependency_fence -v`
Expected: FAIL — `ImportError: cannot import name 'GDELT_DIR'`.

- [ ] **Step 3: Extend `scripts/backtest/paths.py`**

Open `scripts/backtest/paths.py`. After the existing `LEADTIME_SVG = DOCS / "dengue-leadtime.svg"` line add:

```python
GDELT_DIR = DATA / "gdelt"
GDELT_REPORT_MD = DOCS / "gdelt-combined-backtest.md"
GDELT_ROC_SVG = DOCS / "gdelt-roc.svg"
GDELT_PR_SVG = DOCS / "gdelt-pr.svg"
```

In the existing `ensure_dirs()` function, change the loop tuple to also create `GDELT_DIR`:

```python
def ensure_dirs():
    for d in (DATA, CLIMATE_DIR, GDELT_DIR, DOCS):
        d.mkdir(parents=True, exist_ok=True)
```

- [ ] **Step 4: Create `requirements-backtest.txt`**

```
# Offline backtest research ONLY. The live 15-min cron pipeline is
# stdlib-only and MUST NOT import these. Enforced by
# tests/backtest/test_dependency_fence.py.
numpy>=1.26
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `python3 -m unittest tests.backtest.test_dependency_fence -v`
Expected: 2 tests PASS (the fence test confirms no live module imports numpy/sklearn/scipy/pandas).
Run: `python3 -m unittest discover -t . -s tests`
Expected: all OK.

- [ ] **Step 6: Commit**

```bash
git add requirements-backtest.txt scripts/backtest/paths.py tests/backtest/test_dependency_fence.py
git commit -m "feat(backtest): gdelt paths + numpy-only dependency fence"
```

---

## Task 2: Real GDELT DOC 2.0 fetcher + parser

Pre-declared, frozen query (no post-hoc tuning — changing it to chase a
better number is the integrity trap). Network shell HARD-FAILs on
schema drift; pure parser is unit-tested on a fixture.

**Files:**
- Create: `tests/backtest/fixtures/gdelt_sample.json`
- Create: `tests/backtest/test_fetch_gdelt.py`
- Create: `scripts/backtest/fetch_gdelt.py`

- [ ] **Step 1: Create the fixture**

Create `tests/backtest/fixtures/gdelt_sample.json`:

```json
{"query_details":{"title":"q"},"timeline":[{"series":"Article Count","data":[
{"date":"20180115T000000Z","value":2,"norm":100},
{"date":"20180120T000000Z","value":3,"norm":100},
{"date":"20180210T000000Z","value":5,"norm":100},
{"date":"20190305T000000Z","value":1,"norm":100}]}]}
```

- [ ] **Step 2: Write the failing test**

Create `tests/backtest/test_fetch_gdelt.py`:

```python
import os
import sys
import unittest

sys.path.insert(0, "scripts")
from backtest.fetch_gdelt import parse_gdelt_timeline, QUERY_TEMPLATE

FIX = os.path.join(os.path.dirname(__file__), "fixtures", "gdelt_sample.json")


class ParseGdeltTest(unittest.TestCase):
    def setUp(self):
        with open(FIX, encoding="utf-8") as f:
            self.monthly = parse_gdelt_timeline(f.read())

    def test_aggregates_daily_to_monthly(self):
        self.assertEqual(self.monthly[(2018, 1)], 5)   # 2 + 3
        self.assertEqual(self.monthly[(2018, 2)], 5)
        self.assertEqual(self.monthly[(2019, 3)], 1)

    def test_missing_months_absent(self):
        self.assertNotIn((2018, 3), self.monthly)

    def test_garbage_returns_empty(self):
        self.assertEqual(parse_gdelt_timeline("not json"), {})
        self.assertEqual(parse_gdelt_timeline('{"timeline":[]}'), {})

    def test_query_template_frozen(self):
        # Pre-registered; must contain the country placeholder and be stable.
        self.assertIn("{iso}", QUERY_TEMPLATE)
        self.assertIn("sourcecountry:", QUERY_TEMPLATE)
```

- [ ] **Step 3: Run to verify it fails**

Run: `python3 -m unittest tests.backtest.test_fetch_gdelt -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'backtest.fetch_gdelt'`.

- [ ] **Step 4: Implement `scripts/backtest/fetch_gdelt.py`**

```python
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
    # ints where exact
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
    time.sleep(2)   # courtesy
    return text


if __name__ == "__main__":
    for iso in sys.argv[1:] or ["TH"]:
        n = len(parse_gdelt_timeline(fetch(iso, force="--force" in sys.argv)))
        print(f"gdelt {iso}: {n} months cached")
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `python3 -m unittest tests.backtest.test_fetch_gdelt -v`
Expected: 4 tests PASS.
Run: `python3 -m unittest discover -t . -s tests`
Expected: all OK. (Do NOT run the network fetch — Task 6 handles real data.)

- [ ] **Step 6: Commit**

```bash
git add tests/backtest/fixtures/gdelt_sample.json tests/backtest/test_fetch_gdelt.py scripts/backtest/fetch_gdelt.py
git commit -m "feat(backtest): real GDELT DOC 2.0 fetcher + tested parser (frozen query)"
```

---

## Task 3: Seasonal prior (Laplace, strictly-prior years) + anti-lookahead

**Files:**
- Create: `tests/backtest/test_seasonal_prior.py`
- Create: `scripts/backtest/seasonal_prior.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/backtest/test_seasonal_prior.py`:

```python
import sys
import unittest

sys.path.insert(0, "scripts")
from backtest.seasonal_prior import prior_points, MIN_PRIOR_YEARS


def _onsets(iso, onset_yms, evaluated):
    return {iso: {"onsets": set(onset_yms),
                  "evaluated_year_months": sorted(evaluated)}}


class SeasonalPriorTest(unittest.TestCase):
    def test_excludes_year_without_min_prior(self):
        ev = [(2010, 6), (2011, 6)]
        pts = prior_points(_onsets("TH", [], ev))
        self.assertEqual(pts, [])   # <3 prior same-month years

    def test_prior_is_laplace_strictly_prior(self):
        # June onset in 2010,2011,2012 ; evaluate 2013-06 (3 prior years)
        ev = [(y, 6) for y in (2010, 2011, 2012, 2013)]
        on = [(2010, 6), (2011, 6), (2012, 6)]
        pts = prior_points(_onsets("TH", on, ev))
        row = [p for p in pts if p["iso"] == "TH"
               and p["year"] == 2013 and p["month"] == 6][0]
        # prior = (3 onsets + 1) / (3 prior years + 2) = 4/5
        self.assertAlmostEqual(row["p0"], 4.0 / 5.0, places=9)
        self.assertEqual(row["y"], 0)   # 2013-06 itself had no onset

    def test_label_reflects_actual_onset(self):
        ev = [(y, 6) for y in (2010, 2011, 2012, 2013)]
        on = [(2010, 6), (2011, 6), (2012, 6), (2013, 6)]
        pts = prior_points(_onsets("TH", on, ev))
        row = [p for p in pts if p["year"] == 2013 and p["month"] == 6][0]
        self.assertEqual(row["y"], 1)

    def test_anti_lookahead_future_years_ignored(self):
        ev = [(y, 6) for y in (2010, 2011, 2012, 2013, 2014, 2015)]
        on = [(2010, 6), (2011, 6), (2012, 6)]
        base = _onsets("TH", on, ev)
        # add future onsets AFTER 2013 — must not change p0 for 2013-06
        fut = _onsets("TH", on + [(2014, 6), (2015, 6)], ev)
        r0 = [p for p in prior_points(base)
              if p["year"] == 2013 and p["month"] == 6][0]
        r1 = [p for p in prior_points(fut)
              if p["year"] == 2013 and p["month"] == 6][0]
        self.assertEqual(r0["p0"], r1["p0"])

    def test_min_prior_constant(self):
        self.assertEqual(MIN_PRIOR_YEARS, 3)
```

- [ ] **Step 2: Run to verify it fails**

Run: `python3 -m unittest tests.backtest.test_seasonal_prior -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `scripts/backtest/seasonal_prior.py`**

```python
"""Seasonal prior P0(region, month, year): Laplace-smoothed historical
onset frequency from STRICTLY-PRIOR years. No lookahead by construction
(only years < Y enter the estimate). Reuses MIN_PRIOR_YEARS discipline.
"""
from backtest.outbreaks import MIN_PRIOR_YEARS   # = 3

ALPHA = 1.0   # Beta(1,1) / Laplace
BETA = 1.0


def prior_points(onsets_by_iso):
    """onsets_by_iso: {iso: {onsets:set((y,m)), evaluated_year_months:list}}.

    Returns sorted list of dicts:
      {iso, year, month, p0, y}
    one per (iso, year, month) that has >= MIN_PRIOR_YEARS prior years
    of the SAME calendar month in evaluated_year_months. p0 is the
    Laplace prior from strictly-prior years; y is the actual 0/1 onset
    label for (iso, year, month).
    """
    out = []
    for iso, info in sorted(onsets_by_iso.items()):
        ev = sorted(set(info.get("evaluated_year_months") or []))
        onset = set(info.get("onsets") or [])
        for (Y, m) in ev:
            prior_years = [y for (y, mm) in ev if mm == m and y < Y]
            if len(prior_years) < MIN_PRIOR_YEARS:
                continue
            k = sum(1 for y in prior_years if (y, m) in onset)
            n = len(prior_years)
            p0 = (k + ALPHA) / (n + ALPHA + BETA)
            out.append({"iso": iso, "year": Y, "month": m,
                        "p0": p0, "y": 1 if (Y, m) in onset else 0})
    out.sort(key=lambda r: (r["iso"], r["year"], r["month"]))
    return out
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python3 -m unittest tests.backtest.test_seasonal_prior -v`
Expected: 5 tests PASS (incl. anti-lookahead).
Run: `python3 -m unittest discover -t . -s tests`
Expected: all OK.

- [ ] **Step 5: Commit**

```bash
git add tests/backtest/test_seasonal_prior.py scripts/backtest/seasonal_prior.py
git commit -m "feat(backtest): Laplace seasonal prior, strictly-prior years"
```

---

## Task 4: Scorer — causal z, offset-logistic (numpy IRLS), PR-AUC, Brier

**Files:**
- Create: `tests/backtest/test_score_model.py`
- Create: `scripts/backtest/score_model.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/backtest/test_score_model.py`:

```python
import sys
import unittest

sys.path.insert(0, "scripts")
import numpy as np
from backtest.score_model import (
    causal_z, fit_offset_logistic, posterior, pr_auc, brier, MIN_Z_HISTORY,
)


class ScoreModelTest(unittest.TestCase):
    def test_causal_z_needs_history(self):
        self.assertEqual(causal_z([1, 2, 3], 2), 0.0)   # <MIN_Z_HISTORY prior

    def test_causal_z_uses_only_prior(self):
        series = [10.0] * 24 + [20.0]          # 24 prior @10, point @20
        z = causal_z(series, 24)
        self.assertGreater(z, 5.0)             # big positive anomaly
        # future values after idx must not change it
        series2 = series + [999.0, -999.0]
        self.assertEqual(causal_z(series2, 24), z)

    def test_offset_logistic_recovers_signal(self):
        rng = np.random.default_rng(0)
        n = 400
        x = rng.normal(size=n)
        offset = np.full(n, -1.0)              # logit prior
        p = 1 / (1 + np.exp(-(offset + 1.5 * x)))
        y = (rng.uniform(size=n) < p).astype(float)
        beta = fit_offset_logistic(x.reshape(-1, 1), y, offset)
        self.assertGreater(beta[0], 0.5)       # positive learned weight

    def test_posterior_reduces_to_prior_at_zero(self):
        p0 = 0.3
        self.assertAlmostEqual(posterior(p0, [0.0], [2.0]), p0, places=9)

    def test_pr_auc_perfect_and_constant(self):
        y = [0, 0, 1, 1]
        self.assertAlmostEqual(pr_auc(y, [0.1, 0.2, 0.8, 0.9]), 1.0, places=9)
        # constant score → AP equals base rate
        self.assertAlmostEqual(pr_auc(y, [0.5, 0.5, 0.5, 0.5]), 0.5, places=6)

    def test_brier(self):
        self.assertAlmostEqual(brier([1, 0], [1.0, 0.0]), 0.0, places=9)
        self.assertAlmostEqual(brier([1, 0], [0.0, 1.0]), 1.0, places=9)

    def test_min_z_history_constant(self):
        self.assertEqual(MIN_Z_HISTORY, 24)
```

- [ ] **Step 2: Run to verify it fails**

Run: `python3 -m unittest tests.backtest.test_score_model -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `scripts/backtest/score_model.py`**

```python
"""Causal z-anomaly, offset-logistic MLE (numpy Newton/IRLS), and
proper-scoring metrics. Single covariate by design (thin sample).
logit(P0) enters as a FIXED offset; only beta is learned.
"""
import math

import numpy as np

MIN_Z_HISTORY = 24   # prior monthly points required for a trustworthy z


def causal_z(series, t_index):
    """z of series[t_index] vs STRICTLY-prior values; 0.0 if too short."""
    hist = list(series[:t_index])
    if len(hist) < MIN_Z_HISTORY:
        return 0.0
    mu = sum(hist) / len(hist)
    var = sum((x - mu) ** 2 for x in hist) / len(hist)
    sd = math.sqrt(var)
    if sd < 1e-6:
        sd = 1.0
    return (series[t_index] - mu) / sd


def fit_offset_logistic(X, y, offset, iters=50, ridge=1e-6):
    """MLE of beta in  P(y=1) = sigmoid(offset + X @ beta).

    Newton-Raphson / IRLS. No intercept (prior carries the level via
    offset). Deterministic. X: (n,k) ndarray, y/offset: (n,) arrays.
    """
    X = np.asarray(X, dtype=float)
    y = np.asarray(y, dtype=float)
    offset = np.asarray(offset, dtype=float)
    n, k = X.shape
    beta = np.zeros(k)
    for _ in range(iters):
        eta = offset + X @ beta
        p = 1.0 / (1.0 + np.exp(-np.clip(eta, -30, 30)))
        W = np.clip(p * (1.0 - p), 1e-9, None)
        grad = X.T @ (y - p)
        H = X.T @ (X * W[:, None]) + ridge * np.eye(k)
        step = np.linalg.solve(H, grad)
        beta = beta + step
        if np.max(np.abs(step)) < 1e-10:
            break
    return beta


def posterior(p0, z_row, beta):
    """sigmoid(logit(p0) + z_row . beta) — scalar p0, vectors z_row/beta."""
    p0 = min(max(float(p0), 1e-9), 1 - 1e-9)
    logit0 = math.log(p0 / (1.0 - p0))
    s = logit0 + sum(zi * bi for zi, bi in zip(z_row, beta))
    s = max(-30.0, min(30.0, s))
    return 1.0 / (1.0 + math.exp(-s))


def pr_auc(y, scores):
    """Average precision (PR-AUC). Deterministic; ties broken by order."""
    pairs = sorted(zip(scores, range(len(y))), key=lambda t: (-t[0], t[1]))
    P = sum(y)
    if P == 0:
        return 0.0
    tp = 0
    fp = 0
    ap = 0.0
    prev_recall = 0.0
    for sc, idx in pairs:
        if y[idx] == 1:
            tp += 1
        else:
            fp += 1
        recall = tp / P
        precision = tp / (tp + fp)
        ap += precision * (recall - prev_recall)
        prev_recall = recall
    return ap


def brier(y, scores):
    return sum((s - yi) ** 2 for s, yi in zip(scores, y)) / len(y)
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python3 -m unittest tests.backtest.test_score_model -v`
Expected: 7 tests PASS.
Run: `python3 -m unittest discover -t . -s tests`
Expected: all OK.

- [ ] **Step 5: Commit**

```bash
git add tests/backtest/test_score_model.py scripts/backtest/score_model.py
git commit -m "feat(backtest): causal-z, numpy offset-logistic, PR-AUC, Brier"
```

---

## Task 5: Expanding-window OOS orchestrator + deterministic report

**Files:**
- Create: `tests/backtest/test_backtest_combined.py`
- Create: `scripts/backtest/backtest_combined.py`

- [ ] **Step 1: Write the failing tests**

Create `tests/backtest/test_backtest_combined.py`:

```python
import sys
import unittest

sys.path.insert(0, "scripts")
from backtest.backtest_combined import build_report, CRITERION

# synthetic: GDELT z perfectly leads onsets in later years
PRIOR_POINTS = [
    {"iso": "TH", "year": Y, "month": 6, "p0": 0.3,
     "y": 1 if Y >= 2020 else 0}
    for Y in range(2016, 2024)
]
# z_by_key: (iso,year,month) -> z value
ZBYKEY = {("TH", Y, 6): (2.5 if Y >= 2020 else -0.5)
          for Y in range(2016, 2024)}


class BacktestCombinedTest(unittest.TestCase):
    def test_report_deterministic(self):
        a = build_report(PRIOR_POINTS, ZBYKEY, first_test_year=2019)
        b = build_report(PRIOR_POINTS, ZBYKEY, first_test_year=2019)
        self.assertEqual(a["markdown"], b["markdown"])

    def test_criterion_before_verdict(self):
        md = build_report(PRIOR_POINTS, ZBYKEY,
                          first_test_year=2019)["markdown"]
        self.assertIn("Pre-registered success criterion", md)
        self.assertLess(md.index("Pre-registered success criterion"),
                        md.index("Verdict"))

    def test_verdict_enumerated(self):
        r = build_report(PRIOR_POINTS, ZBYKEY, first_test_year=2019)
        self.assertIn(r["verdict"], ("PROVEN", "NOT DEMONSTRATED"))

    def test_no_train_test_overlap(self):
        r = build_report(PRIOR_POINTS, ZBYKEY, first_test_year=2019)
        for tr_max, te in r["folds"]:
            self.assertLess(tr_max, te)

    def test_criterion_text_has_no_target_number(self):
        self.assertNotIn("0.78", CRITERION)
        self.assertIn("PR-AUC", CRITERION)
```

- [ ] **Step 2: Run to verify it fails**

Run: `python3 -m unittest tests.backtest.test_backtest_combined -v`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `scripts/backtest/backtest_combined.py`**

```python
"""Expanding-window OOS backtest: seasonal prior vs prior+GDELT.

For each test year Y (>= first_test_year), beta is fit ONLY on
prior-points with year < Y; year-Y points are scored out-of-sample.
Baseline = seasonal prior alone (p0). Honest verdict; never tuned.
"""
import json
import sys
from datetime import datetime, timezone

import numpy as np

from backtest.paths import (GDELT_DIR, GDELT_REPORT_MD, GDELT_ROC_SVG,
                            GDELT_PR_SVG, ensure_dirs)
from backtest import evaluate as ev
from backtest.charts import roc_svg, histogram_svg
from backtest.score_model import (fit_offset_logistic, posterior,
                                  pr_auc, brier)

CRITERION = ("PR-AUC(combined) - PR-AUC(seasonal) > 0 with the lower "
             "bound of its 95% block-bootstrap CI > 0, AND "
             "Brier(combined) <= Brier(seasonal). Out-of-sample; "
             "pre-registered; no target value.")


def _logit(p):
    p = min(max(float(p), 1e-9), 1 - 1e-9)
    return np.log(p / (1.0 - p))


def build_report(prior_points, z_by_key, first_test_year):
    """prior_points: [{iso,year,month,p0,y}]; z_by_key: {(iso,y,m): z}."""
    pts = sorted(prior_points, key=lambda r: (r["year"], r["iso"], r["month"]))
    years = sorted({r["year"] for r in pts})
    test_years = [y for y in years if y >= first_test_year]

    oos = []          # per OOS point: dict with p0, y, p_comb, iso, year
    folds = []
    for Y in test_years:
        train = [r for r in pts if r["year"] < Y]
        test = [r for r in pts if r["year"] == Y]
        if len(train) < 8 or not test:
            continue
        Xtr = np.array([[z_by_key.get((r["iso"], r["year"], r["month"]), 0.0)]
                        for r in train], dtype=float)
        ytr = np.array([r["y"] for r in train], dtype=float)
        otr = np.array([_logit(r["p0"]) for r in train], dtype=float)
        if ytr.sum() == 0 or ytr.sum() == len(ytr):
            beta = np.array([0.0])           # degenerate train → no signal
        else:
            beta = fit_offset_logistic(Xtr, ytr, otr)
        folds.append((max(r["year"] for r in train), Y))
        for r in test:
            z = z_by_key.get((r["iso"], r["year"], r["month"]), 0.0)
            oos.append({
                "iso": r["iso"], "year": r["year"], "y": r["y"],
                "p_base": float(r["p0"]),
                "p_comb": posterior(r["p0"], [z], beta),
            })

    def _ci_blocks(metric_fn):
        by_block = {}
        for o in oos:
            by_block.setdefault((o["iso"], o["year"]), []).append(o)
        vals = []
        for _b, rows in by_block.items():
            y = [r["y"] for r in rows]
            if sum(y) == 0:
                continue
            vals.append(metric_fn([r["y"] for r in rows],
                                  [r["p_comb"] for r in rows])
                        - metric_fn([r["y"] for r in rows],
                                    [r["p_base"] for r in rows]))
        return vals

    if oos:
        Y = [o["y"] for o in oos]
        Pb = [o["p_base"] for o in oos]
        Pc = [o["p_comb"] for o in oos]
        ap_base, ap_comb = pr_auc(Y, Pb), pr_auc(Y, Pc)
        br_base, br_comb = brier(Y, Pb), brier(Y, Pc)
        skill_blocks = _ci_blocks(pr_auc)
        lo, hi = (ev.block_bootstrap_ci(skill_blocks)
                  if skill_blocks else (0.0, 0.0))
    else:
        ap_base = ap_comb = br_base = br_comb = 0.0
        lo, hi = 0.0, 0.0

    proven = (lo > 0.0) and (br_comb <= br_base)
    verdict = "PROVEN" if proven else "NOT DEMONSTRATED"
    n_pos = sum(o["y"] for o in oos)
    isos = sorted({o["iso"] for o in oos})

    gen = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    md = f"""# GDELT × Seasonal-Prior Combined Backtest — Report

_Generated: {gen} · Spec: docs/specs/2026-05-18-gdelt-seasonal-combined-backtest-design.md_

Out-of-sample (expanding-window) test of whether a seasonal prior
P0(region,month) updated by a REAL GDELT health-news anomaly beats the
bare seasonal prior. beta learned only on strictly-prior years; GDELT
real (DOC 2.0); no lookahead (unit-test invariant).

## Pre-registered success criterion

> {CRITERION}

Declared before any run. Verdict never tuned.

## Scope

- OOS folds (train_max_year < test_year): {len(folds)}
- Countries in OOS: {len(isos)} ({", ".join(isos) or "-"})
- OOS points: {len(oos)} ; positive onsets: {n_pos}

## Results

| Metric | Seasonal | Combined |
|---|---|---|
| PR-AUC | {round(ap_base, 4)} | {round(ap_comb, 4)} |
| Brier (lower=better) | {round(br_base, 4)} | {round(br_comb, 4)} |
| **PR-AUC skill (combined - seasonal)** | | **{round(ap_comb - ap_base, 4)}** |
| Skill 95% block-bootstrap CI | | [{lo}, {hi}] |

![PR](gdelt-pr.svg)

![skill](gdelt-roc.svg)

## Verdict

**{verdict}** against the pre-registered criterion
(skill CI lower bound = {lo}; Brier combined {round(br_comb, 4)} vs
seasonal {round(br_base, 4)}).

## Limitations

- GDELT 2.0 from 2015 + burn-in ⇒ thin OOS panel (few country-years);
  CI is wide and that width is part of the honest answer.
- Single covariate (GDELT z) by design — sample cannot support more.
- Country-level news density vs national onsets; query is frozen
  (pre-registered), not tuned.
- Validates this signal as-is; climate / EpiNow2 / spatial smoothing
  are Phase 2, only if this phase shows signal.
"""
    return {"markdown": md, "verdict": verdict, "folds": folds,
            "skill_ci": [lo, hi],
            "pr_points": [(round(o["p_base"], 4), round(o["p_comb"], 4))
                          for o in oos],
            "skill_blocks": skill_blocks if oos else []}


def main():
    ensure_dirs()
    sys.path.insert(0, "scripts")
    from backtest.fetch_opendengue import fetch as fetch_dengue, \
        parse_opendengue_csv
    from backtest.outbreaks import onsets
    from backtest.seasonal_prior import prior_points
    from backtest.fetch_gdelt import fetch as fetch_gdelt, \
        parse_gdelt_timeline

    rows = parse_opendengue_csv(fetch_dengue())
    onsets_by_iso = onsets(rows)
    pts = prior_points(onsets_by_iso)

    z_by_key = {}
    for iso in sorted({p["iso"] for p in pts}):
        monthly = parse_gdelt_timeline(fetch_gdelt(iso))
        keys = sorted(monthly)
        series = [monthly[k] for k in keys]
        from backtest.score_model import causal_z
        for i, (yy, mm) in enumerate(keys):
            z_by_key[(iso, yy, mm)] = causal_z(series, i)

    rep = build_report(pts, z_by_key, first_test_year=2019)
    GDELT_REPORT_MD.write_text(rep["markdown"], encoding="utf-8")
    GDELT_PR_SVG.write_text(
        roc_svg(rep["pr_points"], title="Seasonal vs Combined (per point)"),
        encoding="utf-8")
    GDELT_ROC_SVG.write_text(
        histogram_svg([s for s in rep["skill_blocks"]], bins=8,
                      title="Per-block PR-AUC skill"),
        encoding="utf-8")
    print(f"verdict: {rep['verdict']}  ->  {GDELT_REPORT_MD}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python3 -m unittest tests.backtest.test_backtest_combined -v`
Expected: 5 tests PASS.
Run: `python3 -m unittest discover -t . -s tests`
Expected: all OK.

- [ ] **Step 5: Commit**

```bash
git add tests/backtest/test_backtest_combined.py scripts/backtest/backtest_combined.py
git commit -m "feat(backtest): expanding-window OOS combined backtest + report"
```

---

## Task 6: Live run on real GDELT + commit honest verdict (controller-run)

This is an execution/judgement task, NOT TDD. Run real fetches, inspect
the verdict honestly, commit whatever it says. **Do not tune anything.**

**Files:**
- Generates: `docs/validation/gdelt-combined-backtest.md`, `docs/validation/gdelt-pr.svg`, `docs/validation/gdelt-roc.svg`
- Modify (only if a fetch reveals real schema drift): `scripts/backtest/fetch_gdelt.py`

- [ ] **Step 1: Confirm OpenDengue cache present**

Run: `ls data/backtest/dengue.csv`
Expected: exists (cached by the prior harness). If absent:
`PYTHONPATH=scripts python3 -m backtest.fetch_opendengue --force`

- [ ] **Step 2: Fetch real GDELT for the gate-passing countries (cached, slow)**

Run:
```bash
PYTHONPATH=scripts python3 -c "import sys;sys.path.insert(0,'scripts');\
from backtest.fetch_opendengue import fetch,parse_opendengue_csv;\
from backtest.outbreaks import onsets;from backtest.seasonal_prior import prior_points;\
isos=sorted({p['iso'] for p in prior_points(onsets(parse_opendengue_csv(fetch())))});\
print(isos)"
```
Then for each ISO printed:
`PYTHONPATH=scripts python3 -m backtest.fetch_gdelt <ISO1> <ISO2> ...`
Expected: `gdelt <ISO>: <N> months cached` per country. If it raises the
GDELT schema FATAL, inspect the real DOC 2.0 response, fix the parser /
endpoint in `fetch_gdelt.py`, re-run, and commit that fix separately:
`git commit -m "fix(backtest): adapt to live GDELT DOC 2.0 response"`.

- [ ] **Step 3: Run the combined backtest**

Run: `PYTHONPATH=scripts python3 -m backtest.backtest_combined`
Expected: prints `verdict: PROVEN|NOT DEMONSTRATED -> .../gdelt-combined-backtest.md`.

- [ ] **Step 4: Read the report and sanity-check honestly**

Run: `cat docs/validation/gdelt-combined-backtest.md`
Verify: OOS points & positive-onset count are reported; folds all have
train_max_year < test_year; CI present. If the panel is tiny (e.g. < 3
folds or < 10 positives) add ONE sentence under Limitations stating the
result is preliminary — do NOT delete or soften the verdict.

- [ ] **Step 5: Commit the report + charts (whatever the verdict)**

```bash
git add docs/validation/gdelt-combined-backtest.md docs/validation/gdelt-pr.svg docs/validation/gdelt-roc.svg
git commit -m "docs(validation): GDELT×seasonal combined backtest results — <VERDICT>"
```
Replace `<VERDICT>` with the printed verdict. An honest negative is a
valid, committed outcome and triggers the documented pivot.

- [ ] **Step 6: Run the full suite once more**

Run: `python3 -m unittest discover -t . -s tests`
Expected: all OK.

---

## Self-Review

**1. Spec coverage**

| Spec requirement | Task |
|---|---|
| Real GDELT only (DOC 2.0, no key) | Task 2 |
| Frozen pre-registered query | Task 2 (`QUERY_TEMPLATE`, `test_query_template_frozen`) |
| Seasonal prior P₀(r,m), Laplace, strictly-prior | Task 3 |
| No-lookahead invariant | Task 3 (`test_anti_lookahead_future_years_ignored`), Task 4 (`causal_z` prior-only test) |
| Out-of-sample expanding window | Task 5 (`test_no_train_test_overlap`, `folds`) |
| β learned on strictly-prior window, offset=logit P₀ | Task 4 + Task 5 (`fit_offset_logistic` on `year<Y`) |
| PR-AUC primary + Brier | Task 4 (`pr_auc`,`brier`), Task 5 table |
| Block-bootstrap CI by (country,year) | Task 5 (`_ci_blocks` + reused `evaluate.block_bootstrap_ci`) |
| Pre-registered criterion, no target number | Task 5 (`CRITERION`, `test_criterion_text_has_no_target_number`) |
| Criterion stated before verdict; deterministic report | Task 5 (`test_criterion_before_verdict`, `test_report_deterministic`) |
| Honest negative committed, untuned | Task 6 |
| Dependency fence (no numpy/sklearn in live) | Task 1 (`test_dependency_fence`) |
| numpy-only (sklearn deviation) | Header + Task 1 `requirements-backtest.txt` |
| data/backtest gitignored; report committed | reused .gitignore; Tasks 5–6 |
| Schema HARD-FAIL on GDELT drift | Task 2 (`fetch` guard) |

No gaps. (Spec's "≥24 prior monthly z" and "burn-in window" are realised by `MIN_Z_HISTORY=24` in Task 4 and the `first_test_year=2019` default in Task 5/6.)

**2. Placeholder scan:** None. `<VERDICT>` in Task 6 Step 5 is an explicit fill-from-output instruction, not a code placeholder.

**3. Type consistency:** `prior_points` → list of `{iso,year,month,p0,y}` consumed unchanged by `build_report` and `main` (Task 5). `z_by_key` keyed `(iso,year,month)` produced in `main`, consumed in `build_report` and tests. `fit_offset_logistic(X,y,offset)`/`posterior(p0,z_row,beta)`/`pr_auc(y,scores)`/`brier(y,scores)` signatures defined Task 4 match all call sites Task 5. `evaluate.block_bootstrap_ci(list)` reused with its existing signature. `parse_gdelt_timeline`/`fetch` (Task 2) match `main` usage. Consistent.

---

## Execution Handoff

(Provided after save.)
