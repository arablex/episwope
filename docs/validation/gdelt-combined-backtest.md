# GDELT × Seasonal-Prior Combined Backtest — Report

_Generated: 2026-05-18 · Spec: docs/specs/2026-05-18-gdelt-seasonal-combined-backtest-design.md_

Out-of-sample (expanding-window) test of whether a seasonal prior
P0(region,month) updated by a REAL GDELT health-news anomaly beats the
bare seasonal prior. beta learned only on strictly-prior years; GDELT
real (DOC 2.0); no lookahead (unit-test invariant).

## Pre-registered success criterion

> PR-AUC(combined) - PR-AUC(seasonal) > 0 with the lower bound of its 95% block-bootstrap CI > 0, AND Brier(combined) <= Brier(seasonal). Out-of-sample; pre-registered; no target value.

Declared before any run. Verdict never tuned.

## Scope

- OOS folds (train_max_year < test_year): 7
- Countries in OOS: 6 (BD, ID, KH, LK, TH, VN)
- OOS points: 267 ; positive onsets: 17

## Results

| Metric | Seasonal | Combined |
|---|---|---|
| PR-AUC | 0.1925 | 0.2175 |
| Brier (lower=better) | 0.0656 | 0.0658 |
| **PR-AUC skill (combined - seasonal)** | | **0.025** |
| Skill 95% block-bootstrap CI | | [0.004902, 0.104248] |

![PR](gdelt-pr.svg)

![skill](gdelt-roc.svg)

## Verdict

**NOT DEMONSTRATED** against the pre-registered criterion
(skill CI lower bound = 0.004902; Brier combined 0.0658 vs
seasonal 0.0656).

## Limitations

- GDELT 2.0 from 2015 + burn-in ⇒ thin OOS panel (few country-years);
  CI is wide and that width is part of the honest answer.
- Single covariate (GDELT z) by design — sample cannot support more.
- Country-level news density vs national onsets; query is frozen
  (pre-registered), not tuned.
- Validates this signal as-is; climate / EpiNow2 / spatial smoothing
  are Phase 2, only if this phase shows signal.
