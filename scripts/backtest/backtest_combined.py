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

    oos = []
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
            beta = np.array([0.0])
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
    from backtest.score_model import causal_z

    rows = parse_opendengue_csv(fetch_dengue())
    onsets_by_iso = onsets(rows)
    pts = prior_points(onsets_by_iso)

    z_by_key = {}
    for iso in sorted({p["iso"] for p in pts}):
        monthly = parse_gdelt_timeline(fetch_gdelt(iso))
        keys = sorted(monthly)
        series = [monthly[k] for k in keys]
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
