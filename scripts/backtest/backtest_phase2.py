"""Phase-2 expanding-window OOS backtest: seasonal prior vs
prior + REAL GKG (BigQuery) anomaly, WITH an isotonic calibration
layer fit on the strictly-prior window.

Pre-registered criterion is IMPORTED verbatim from Phase-1
(backtest_combined.CRITERION) — the bar is NOT redefined. β and the
isotonic calibrator are both fit ONLY on year < Y; year-Y points are
scored out-of-sample. Verdict never tuned.
"""
import sys
from datetime import datetime, timezone

import numpy as np

from backtest.paths import DOCS, ensure_dirs
from backtest import evaluate as ev
from backtest.charts import roc_svg, histogram_svg
from backtest.score_model import (fit_offset_logistic, posterior,
                                  pr_auc, brier)
from backtest.calibration import fit_isotonic, apply_isotonic
from backtest.backtest_combined import CRITERION   # pre-registered, verbatim

REPORT_MD = DOCS / "gdelt-phase2-backtest.md"
PR_SVG = DOCS / "gdelt-phase2-pr.svg"
SKILL_SVG = DOCS / "gdelt-phase2-skill.svg"


def _logit(p):
    p = min(max(float(p), 1e-9), 1 - 1e-9)
    return np.log(p / (1.0 - p))


def build_report_v2(prior_points, z_by_key, first_test_year):
    pts = sorted(prior_points, key=lambda r: (r["year"], r["iso"], r["month"]))
    years = sorted({r["year"] for r in pts})
    test_years = [y for y in years if y >= first_test_year]

    oos, folds, per_fold = [], [], {}
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
        # raw combined on the PRIOR window, then isotonic on (raw, y) —
        # strictly prior; no lookahead (caller-controlled slice).
        p_tr = [posterior(r["p0"],
                          [z_by_key.get((r["iso"], r["year"], r["month"]), 0.0)],
                          beta) for r in train]
        calib = fit_isotonic(p_tr, list(ytr))
        folds.append((max(r["year"] for r in train), Y))
        fold_rows = []
        for r in test:
            z = z_by_key.get((r["iso"], r["year"], r["month"]), 0.0)
            p_raw = posterior(r["p0"], [z], beta)
            p_cal = apply_isotonic(calib, p_raw)
            oos.append({"iso": r["iso"], "year": r["year"], "y": r["y"],
                        "p_base": float(r["p0"]), "p_comb": p_cal})
            fold_rows.append((r["iso"], round(p_cal, 6)))
        per_fold[f"oos_{Y}"] = sorted(fold_rows)

    def _ci_blocks():
        by_block = {}
        for o in oos:
            by_block.setdefault((o["iso"], o["year"]), []).append(o)
        vals = []
        for _b, rows in by_block.items():
            y = [r["y"] for r in rows]
            if sum(y) == 0:
                continue
            vals.append(pr_auc(y, [r["p_comb"] for r in rows])
                        - pr_auc(y, [r["p_base"] for r in rows]))
        return vals

    if oos:
        Y = [o["y"] for o in oos]
        Pb = [o["p_base"] for o in oos]
        Pc = [o["p_comb"] for o in oos]
        ap_base, ap_comb = pr_auc(Y, Pb), pr_auc(Y, Pc)
        br_base, br_comb = brier(Y, Pb), brier(Y, Pc)
        skill_blocks = _ci_blocks()
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
    md = f"""# GDELT (BigQuery GKG) × Seasonal-Prior — Phase 2 Report

_Generated: {gen} · Spec: docs/specs/2026-05-18-gdelt-seasonal-combined-backtest-design.md_

Phase-2 pre-registered next step: REAL GKG via the BigQuery public
dataset (frozen query, all 6 gate-passing countries — the free DOC API
in Phase-1 could only serve 3) PLUS an isotonic calibration layer
fit on the strictly-prior window. Expanding-window OOS; β and the
calibrator learned only on year < Y; no lookahead (unit-test
invariant). Pre-registered criterion is IDENTICAL to Phase-1
(imported verbatim) — the bar was not moved.

## Pre-registered success criterion

> {CRITERION}

Declared before the data existed. Verdict never tuned.

## Scope

- OOS folds (train_max_year < test_year): {len(folds)}
- Countries in OOS: {len(isos)} ({", ".join(isos) or "-"})
- OOS points: {len(oos)} ; positive onsets: {n_pos}

## Results

| Metric | Seasonal | Combined+calibrated |
|---|---|---|
| PR-AUC | {round(ap_base, 4)} | {round(ap_comb, 4)} |
| Brier (lower=better) | {round(br_base, 4)} | {round(br_comb, 4)} |
| **PR-AUC skill (combined - seasonal)** | | **{round(ap_comb - ap_base, 4)}** |
| Skill 95% block-bootstrap CI | | [{lo}, {hi}] |

![PR](gdelt-phase2-pr.svg)

![skill](gdelt-phase2-skill.svg)

## Verdict

**{verdict}** against the pre-registered criterion
(skill CI lower bound = {lo}; Brier combined {round(br_comb, 4)} vs
seasonal {round(br_base, 4)}).

## Limitations

- GKG from 2017 (BigQuery export) + 24-month z burn-in ⇒ effective
  OOS panel is still thin; CI width is part of the honest answer.
- Single covariate (GKG z) + isotonic calibration; sample cannot
  support more.
- Country-level news density vs national onsets; query frozen
  (pre-registered), not tuned; criterion imported verbatim from
  Phase-1, not redefined.
"""
    out = {"markdown": md, "verdict": verdict, "folds": folds,
           "skill_ci": [lo, hi],
           "pr_points": [(round(o["p_base"], 4), round(o["p_comb"], 4))
                         for o in oos],
           "skill_blocks": skill_blocks if oos else []}
    out.update(per_fold)
    return out


def main():
    ensure_dirs()
    sys.path.insert(0, "scripts")
    from backtest.fetch_opendengue import fetch as fetch_dengue, \
        parse_opendengue_csv
    from backtest.outbreaks import onsets
    from backtest.seasonal_prior import prior_points
    from backtest.fetch_gdelt_bq import load as load_gkg
    from backtest.score_model import causal_z

    pts = prior_points(onsets(parse_opendengue_csv(fetch_dengue())))
    gkg = load_gkg()
    z_by_key = {}
    for iso, monthly in gkg.items():
        keys = sorted(monthly)
        series = [monthly[k] for k in keys]
        for i, (yy, mm) in enumerate(keys):
            z_by_key[(iso, yy, mm)] = causal_z(series, i)

    rep = build_report_v2(pts, z_by_key, first_test_year=2019)
    REPORT_MD.write_text(rep["markdown"], encoding="utf-8")
    PR_SVG.write_text(roc_svg(rep["pr_points"],
                              title="Seasonal vs Combined+cal (per point)"),
                      encoding="utf-8")
    SKILL_SVG.write_text(
        histogram_svg(list(rep["skill_blocks"]), bins=8,
                      title="Per-block PR-AUC skill (Phase 2)"),
        encoding="utf-8")
    print(f"verdict: {rep['verdict']}  ->  {REPORT_MD}")


if __name__ == "__main__":
    main()
