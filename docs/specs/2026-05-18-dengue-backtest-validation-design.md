# Dengue Backtest — Validation Harness (Design)

**Date:** 2026-05-18
**Status:** Design approved, pending spec review
**Goal:** Convert the climate→bio leading-indicator from *promise* to *proof*
by measuring, on historical data without lookahead bias, whether the shipped
Mordecai-2017 dengue suitability indicator (`climate_signals.py`) detects
real dengue outbreaks early — and whether it beats a purely seasonal baseline.

This is the single highest-leverage step for B2B credibility: it produces a
defensible sentence ("on historical data the indicator leads outbreaks by
N weeks with X sensitivity, better than a seasonal baseline, CI …") or an
equally honest negative ("not demonstrated").

## Decisions (from brainstorming)

- **Rigor:** serious validation (not a sanity check, not CI-regression yet).
- **Use:** internal report first. Public methodology page / sales artifact is
  a *later* decision, made only after seeing the real number. We do not
  publish a figure before we have seen it.
- **Approach:** A — event-based detection backtest (chosen over correlation-
  lag and probabilistic-fitted approaches). Rationale: it validates the
  *shipped, as-is* indicator and yields the exact outbreak-detection claim
  B2B buyers ask for; it introduces no fitted model, so no CV-leakage risk.

## Non-negotiable principles

1. **Validate the shipped formula, not a copy.** Extract the pure dengue
   suitability function from `climate_signals.py` into a shared module that
   both the live script and the backtest import. The backtest must exercise
   production code.
2. **No lookahead.** S at evaluation date `t` is computed strictly from
   climate days `< t`. The Mordecai curve is fixed literature constants
   (Tmin 17.8 / Topt ~29 / Tmax 34.6), never fitted → zero training, zero
   leakage. Enforced by a unit-test invariant (below).
3. **Skill vs seasonal baseline is the verdict.** Catching outbreaks is
   worthless if it only reflects "dengue is seasonal." The indicator has
   value *only* if it beats a pure seasonal climatology predictor.
4. **Pre-registered success criterion.** Declared before the run; no
   post-hoc threshold tuning to flatter the result.
5. **Honest negatives are valid output.** If CIs cover zero, the verdict is
   "not demonstrated" — a publishable, honest result. No hiding.

## Architecture

Standalone offline tool. Does **not** touch the live 15-min pipeline.

```
scripts/
  _shared/pathogen_suitability.py   # NEW: pure dengue_suitability(...)
                                    #      imported by climate_signals.py
                                    #      AND the backtest (single source)
  backtest/
    fetch_climate_archive.py        # ERA5 history  → data/backtest/climate/{ISO}.csv
    fetch_opendengue.py             # OpenDengue CSV → data/backtest/dengue.csv
    reconstruct_indicator.py        # causal recompute of S from climate CSV
    outbreaks.py                    # WHO endemic-channel → binary epidemic series
    evaluate.py                     # POD/FAR/lead-time/skill + block bootstrap CI
    run_backtest.py                 # orchestrator: cached data → report
data/backtest/                      # .gitignore — raw external data not committed
docs/validation/dengue-backtest.md  # COMMITTED: method + numbers + PNG charts
tests/backtest/                     # unit tests (see Testing)
```

Each module has one purpose, a clear interface, and is independently
testable. `reconstruct_indicator.py` imports `_shared.pathogen_suitability`;
`climate_signals.py` is refactored to import the same function (behaviour-
preserving — verified by a characterization test against current output).

## Data sources

| Source | Endpoint / artifact | Notes |
|---|---|---|
| Climate history | `archive-api.open-meteo.com/v1/archive` (ERA5) | free, no key, daily `temperature_2m_mean` + `precipitation_sum`, centroids = existing `COORDS`. Period = intersection of ERA5 availability and OpenDengue coverage, finalized at fetch time and recorded in the report (target ≥ 10 country-years) |
| Dengue cases | OpenDengue national release CSV (their GitHub release / opendengue.org) | national, monthly; license checked & recorded in report |

Both external. Cached locally on first fetch; runs thereafter work offline.
Format change → hard fail with a clear message (never silent degradation).

## Data flow & causality

1. Fetch & cache ERA5 daily climate per country (centroids identical to
   `climate_signals.COORDS`).
2. For each evaluation date `t` (weekly grid): recompute S using only days
   `< t` — rolling baseline window strictly before `t`, exactly mirroring
   the live `older`/`recent` split but truncated at `t`.
3. Aggregate weekly S → monthly (one fixed rule, declared a priori:
   monthly = max of that month's weekly S) to align with OpenDengue's
   monthly national counts.
4. **Anti-leakage invariant (unit test):** reconstruction for date `t` fed
   data that *includes* `t+1…` must return an identical result to
   reconstruction fed only data `< t`. The test deliberately injects future
   data and asserts equality.

## Outbreak definition (WHO endemic channel)

For country C, calendar month m: epidemic threshold =
`mean + 2·SD` of month-m case counts over **prior** years (rolling, ≥3 prior
years required, else that country-year is excluded from the denominator).
A month is an **outbreak onset** if cases first exceed the threshold that
season. Alternative definitions (top-decile, k×median) are run only as
*sensitivity checks*, not the headline.

## Metrics & baselines

- **POD** — fraction of onsets with an alarm (S ≥ threshold) firing in the
  window spanning 12 weeks before through the first day of the onset month.
- **FAR** — fraction of alarms that are false.
- **Lead-time** — median + IQR + full distribution for caught onsets.
- **ROC** — full curve over a threshold grid (no post-hoc point pick); plus
  one pre-declared operating point.
- **Skill metric:** True Skill Statistic (Peirce), TSS = POD − FAR-rate.
  Reported as `TSS_indicator − TSS_baseline` per baseline.
- **Baselines (mandatory):** (1) random alarms at matched rate;
  (2) **pure seasonal climatology** ("epidemic = the usual epidemic month
  for this country"); (3) persistence. The indicator must beat #2.
- **Confidence intervals:** block bootstrap resampling by (country, year)
  blocks — not by point (events are autocorrelated; point bootstrap inflates
  optimistically).

### Pre-registered success criterion (declared before run)

> Skill score vs the seasonal baseline > 0 with the lower bound of its 95%
> block-bootstrap CI > 0, **and** median lead-time ≥ 2 weeks.

If unmet → verdict "not demonstrated"; reported honestly.

## Error handling & edge cases

- No network → run on cache; missing cache for a country → exclude it,
  record the exclusion count in the report.
- < 3 prior years of dengue history for a country-year → excluded from the
  denominator; total exclusions documented.
- Small sample → wide CIs: reported as-is. CI covering 0 → "not
  demonstrated", not buried.
- Any external-format change → hard fail with explicit message.

## Testing

- **Anti-leakage invariant** (core): future-injection equality test.
- **Endemic-channel** on synthetic series with a known answer.
- **Climate→month aggregation** correctness.
- **Determinism**: one input → one byte-identical report.
- **Characterization test**: refactored `climate_signals.py` produces the
  same `climate_risk.json` as before the shared-module extraction.

## Output

`docs/validation/dengue-backtest.md` (committed): method, period, countries,
exclusions, results table (POD / FAR / lead-time / skill + CIs vs all three
baselines), ROC PNG, lead-time histogram PNG, an unvarnished "Limitations"
section, and the verdict against the pre-registered criterion.

## Out of scope (YAGNI / later)

- Public `/methodology` page or sales PDF — decided after seeing the number.
- CI regression harness — backtest on fixed history doesn't change per run.
- Probabilistic/fitted model (Approach C) — documented future extension.
- Cholera/other pathogens — same harness later if dengue validates.
