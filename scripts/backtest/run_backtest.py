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
    rand_tss_blocks, pers_tss_blocks = [], []
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
        rate = (len(a_ind & set(ym)) / len(ym)) if ym else 0.0
        a_rand = ev.random_alarms(ym, rate, seed=20260518)
        a_pers = ev.persistence_alarms(ym, onsets)

        ind_tss_blocks.append(ev.tss(ym, onsets, a_ind, HORIZON_MONTHS))
        seas_tss_blocks.append(ev.tss(ym, onsets, a_seas, HORIZON_MONTHS))
        rand_tss_blocks.append(ev.tss(ym, onsets, a_rand, HORIZON_MONTHS))
        pers_tss_blocks.append(ev.tss(ym, onsets, a_pers, HORIZON_MONTHS))
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
| TSS — random baseline (mean) | {_mean(rand_tss_blocks)} |
| TSS — persistence baseline (mean) | {_mean(pers_tss_blocks)} |
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
