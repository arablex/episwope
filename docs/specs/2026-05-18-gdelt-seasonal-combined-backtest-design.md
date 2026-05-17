# GDELT × Seasonal-Prior Combined Backtest — Phase 1 (Design)

**Date:** 2026-05-18
**Status:** Design approved (dialogue), pending spec review
**Decision owner:** founder (Senior DS/CPO review applied)

## One-line goal

Answer ONE go/no-go question, honestly and out-of-sample: **does a
seasonal prior P₀(region,month) updated by a REAL GDELT health-news
anomaly beat the bare seasonal prior?** Win → we have a defensible
predictive product. Lose → documented pivot to "aggregation +
transparency", stop selling prediction.

This is decision-grade, not model-polishing. The value is the verdict,
not the model.

## Why this shape (Senior-DS rationale, locked)

- **Prior is P₀(r,m) ∈ [0,1]**, the Laplace-smoothed historical onset
  frequency per region & calendar month over strictly-prior years.
  **0.66 is NOT a prior** — it was the TSS skill of the seasonal alarm
  in the previous backtest; it is only a mental reference, never a
  model input.
- **Phase 1 deliberately excludes** climate correction, EpiNow2
  smoothing, EpiLearn spatial graph, CLIMADA composite changes. Those
  are Phase 2 *hardening*, justified only if Phase 1 shows real signal.
  Sample is thin (~6 countries, GDELT 2.0 from 2015 ⇒ ~9 yrs); method
  complexity must not exceed what the sample can support, or any lift
  is an overfitting artefact.
- **GDELT, not climate, is the only realistic source of lead** here
  (raw climate already scored ≈ random, TSS 0.12). This phase tests
  exactly that hypothesis and nothing else.

## Non-negotiable integrity rules (carried from v4.2)

1. **Real GDELT only.** No emulated/synthetic signal. Source: GDELT
   DOC 2.0 API (free, no key). Any synthetic feature ⇒ circular result.
2. **Out-of-sample only.** Expanding-window time-series CV: for test
   year Y the model sees ONLY data `< Y` (both P₀ and β). No shuffled
   k-fold (events autocorrelated).
3. **No lookahead.** P₀ and GDELT z-anomaly use strictly-prior data;
   enforced by a unit-test invariant (mirrors the existing harness).
4. **Pre-registered criterion, no target number.** Declared in this
   spec before any run. The "0.78" goal from the original brief is
   explicitly rejected.
5. **Honest negative is a valid, committed outcome** and triggers the
   pivot. Verdict is never tuned.

## Data sources

| Source | Access | Notes |
|---|---|---|
| Dengue onsets (ground truth) | reuse `scripts/backtest/outbreaks.py` (WHO endemic-channel) on cached OpenDengue | already merged & tested |
| GDELT health-news density | **GDELT DOC 2.0 API** `api.gdeltproject.org/api/v2/doc/doc` (free, no key, JSON timeline) | per-country monthly count of disease/health-themed, negative-tone articles |

**Honest coverage limit (stated, not papered over):** GDELT 2.0 begins
2015-02. The combined backtest window is therefore ~2015–2024 monthly,
intersected with OpenDengue coverage for the 6 gate-passing countries.
Small sample ⇒ wide CIs; reported as-is. GDELT 1.0 (pre-2015) is NOT
used — theme/tone consistency is too weak; stretching it would be the
dishonest move.

**Honest burn-in consequence:** z_gdelt needs ≥ 24 prior monthly
points and P₀ needs ≥ 3 prior years. With GDELT starting 2015, the
*effective* scorable OOS window is ~2018–2024 for the gate-passing
countries — only a few years × ~6 countries. This is a genuinely thin
panel; the verdict's CI will be wide and that width is part of the
honest answer, not a flaw to hide.

## Architecture

Reuse-heavy. New code is small and **offline-research only**.

```
scripts/backtest/
  fetch_gdelt.py        # NEW: real GDELT DOC 2.0 → data/backtest/gdelt/{ISO}.json
  seasonal_prior.py     # NEW: P0(r,m) Laplace, strictly-prior years
  score_model.py        # NEW: posterior = σ(logit(P0) + β·z_gdelt); β via LR
  backtest_combined.py  # NEW: expanding-window OOS, PR-AUC/Brier, report
  (reused) outbreaks.py, paths.py, evaluate.block_bootstrap_ci, charts.py
data/backtest/gdelt/    # gitignored cache
docs/validation/gdelt-combined-backtest.md   # COMMITTED report
requirements-backtest.txt # NEW: numpy, scikit-learn — OFFLINE ONLY
```

**Dependency fence (architectural, mandatory):** numpy/scikit-learn are
permitted ONLY in `scripts/backtest/`. The live 15-min cron pipeline
stays stdlib-only. Enforcement is a single check (CI/grep + review):
**no `import numpy` / `import sklearn` may appear outside
`scripts/backtest/`.** No runtime isolation layer is added.

## Method

### Seasonal prior
For region r, calendar month m, test year Y:

P₀(r,m,Y) = (Σ_{y<Y} onset_{r,m,y} + α) / (N_prior(r,m,Y) + α + β),
α = β = 1 (Beta(1,1) / Laplace). Requires N_prior ≥ 3 else the
(r,m,Y) point is excluded (consistent with endemic-channel discipline).

### GDELT anomaly feature
Monthly GDELT health-news density d_{r,t}. Causal standardisation to
the region's own strictly-prior distribution:

z_gdelt_{r,t} = (d_{r,t} − mean(d_{r,<t})) / sd(d_{r,<t}),
sd floored at 1e-6→1.0; ≥ 24 prior monthly points required else z = 0.
A fixed pre-declared lead lag L = 1 month is applied (GDELT month t-1
informs risk for month t). No EpiNow2 smoothing in Phase 1.

### Posterior (Bayes in logit space)
P(risk)_{r,m,Y} = σ( logit(P₀(r,m,Y)) + β₁·z_gdelt )
σ(x)=1/(1+e^{−x}); output % = round(100·P).
`logit(P₀)` enters as a fixed **offset**; β₁ is the only learned
parameter, fit by `sklearn.LogisticRegression(fit_intercept=False)`
on data strictly `< Y` (expanding window). At z=0 ⇒ P→P₀ (model adds
no risk without evidence).

### Baseline
Seasonal-prior-only: P_base = P₀(r,m,Y) (no GDELT term), same OOS points.

### Metrics & verdict
Over all OOS (r,m,Y) points:
- **PR-AUC** (primary — positives rare) of posterior vs of P_base.
- **Brier** score (calibration) of each.
- ROC-AUC reported secondary.
- Skill = PR-AUC(combined) − PR-AUC(baseline); 95% **block-bootstrap
  CI by (country,year) blocks** (reuse `evaluate.block_bootstrap_ci`).

**Pre-registered success criterion (declared now, no target value):**
> PR-AUC(combined) − PR-AUC(seasonal) > 0 with the lower bound of its
> 95% block-bootstrap CI > 0, AND Brier(combined) ≤ Brier(seasonal).

Verdict ∈ {PROVEN, NOT DEMONSTRATED}. Untuned.

## Error handling & edge cases

- GDELT DOC API unreachable / schema change → HARD-FAIL with explicit
  message (mirror the OpenDengue fetcher discipline); cached runs work
  offline.
- Region with < required prior history (onset or GDELT) → excluded;
  exclusions counted in the report.
- Empty OOS set → verdict NOT DEMONSTRATED, no crash.
- Small sample ⇒ wide CIs: reported honestly; CI covering 0 ⇒ NOT
  DEMONSTRATED, not buried.

## Testing

- **Anti-lookahead invariant** (core): P₀ and z_gdelt for (r,t) feeding
  future data must equal the no-future result (mirrors Task 6).
- Laplace prior on synthetic series with known answer.
- Expanding-window split has zero train/test temporal overlap (assert
  max(train year) < test year).
- Report determinism (fixed seeds; same inputs → byte-identical).
- GDELT parser on a recorded fixture (no network in unit tests).

## Output

`docs/validation/gdelt-combined-backtest.md` (committed): method,
window, countries, exclusions, PR-AUC/Brier/ROC table (combined vs
seasonal) + skill & block-bootstrap CI, charts, an unvarnished
"Limitations" section (GDELT 2015+, ~6 countries, thin sample),
and the verdict against the pre-registered criterion.

## Out of scope (YAGNI / Phase 2 only if Phase 1 shows signal)

- Climate-anomaly correction term.
- EpiNow2 gamma-delay + random-walk smoothing of GDELT.
- EpiLearn-style spatial smoothing over `exposure_graph.json`.
- CLIMADA hazard/vulnerability composite changes; verdict-gate
  unchanged.
- Productisation (the "% biothreat" widget + zero-risk Travel-Passport
  copy) — copy already delivered in dialogue; not part of this spec.
- Any live-pipeline change. This is offline research only.
