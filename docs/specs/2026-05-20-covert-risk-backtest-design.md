# Covert-Risk Engine — Historical Backtest Design

**Status:** pre-registered (criterion declared BEFORE looking at results)
**Author:** A.S. (Stepikin Studio)
**Date:** 2026-05-20

## Motivation

`computeCovertRisk()` (netlify/functions/_lib/osint-engine.mjs) classifies
country-day pairs into `{nominal, watch, elevated_watch, covert_elevated}`.
The journal needs ~6–12 months to accumulate enough labelled cases for
forward precision. Backtest accelerates this by replaying the engine on
historical data with known outcomes.

## Pre-registered criterion

> The engine's `elevated_watch ∪ covert_elevated` predictions have
> **precision ≥ 0.40** on out-of-sample country-months, AND
> **recall ≥ 0.30** of major escalations, AND
> **median lead time ≥ 14 days** before the escalation peak,
> on the held-out test window (2024-01 → 2025-06), with the engine
> code frozen at commit `5cb9155` (current main).

Criterion declared 2026-05-20, before fetching test-window data.

**Why these numbers:**
- precision 0.40 — better than the base rate of escalation (~10% of
  country-months in conflict zones), but not unrealistically high for
  an open-data engine
- recall 0.30 — we expect to miss covert-by-design events that have no
  GDELT footprint; 30% is the floor below which the engine isn't useful
- lead 14 days — operationally meaningful (gives NGO/duty-of-care
  customers time to act). Below 14d, alerts arrive too late.

## Scope

**Countries (11):** UA, RU, IR, MM, SD, YE, HT, NG, ET, AF, CD
(top-volume conflict zones with reliable GDELT coverage 2022+)

**Time window:**
- Training/calibration: 2022-01 → 2023-12 (used only for percentile
  normalisation; no engine tuning)
- Out-of-sample test: 2024-01 → 2025-06

**Granularity:** monthly country snapshots

## Data sources (frozen)

1. **GDELT DOC 2.0** — free, no key, used for:
   - `conflict_count`: query `(military OR clash OR shelling OR strike OR
     casualties) sourcecountry:{iso}` (FROZEN, will not be tuned)
   - `unrest_count`: query `(protest OR demonstration OR riot OR clash)
     sourcecountry:{iso}` (FROZEN)
2. **open-er-api archive** — historical FX (already used by live pipeline)
3. **public/country-structural.json** — INFORM modifier (current values
   used; INFORM updates annually so cross-year noise is small)

## Engine input reconstruction

For each (iso, year-month):
- `conflict_score` = percentile-normalised GDELT conflict count vs the
  country's own 2022-23 distribution → mapped to 0-5 scale
- `unrest_score` = same for unrest count
- `infra_score` = 0 (no historical IODA proxy; honest miss)
- `border_score` = 0 (no historical proxy)
- `currency_idx` = computed from open-er-api 30-day FX flow
- INFORM modifier from current `country-structural.json`

This is a deliberate UNDER-specification of input — we evaluate the
engine on the **subset of signals we can honestly reconstruct**, not
on a richer synthetic input that wouldn't match production.

## Outcome label (independent of prediction inputs)

An `escalation` at month T occurs if:
- conflict_count[T+1] ≥ 1.5 × max(conflict_count[T-3..T]), OR
- a major news event (>2σ above country baseline) hits in T+1..T+2

Label uses the SAME GDELT feed that drives the prediction — this is a
mild self-confirmation risk noted honestly. Independent label (e.g.
ACLED-fatalities or UN OCHA situation reports) would be cleaner;
deferred to a future iteration because ACLED requires registration.

## Computed metrics

- **Precision** = TP / (TP + FP) on `predicted ≥ watch`
- **Recall** = TP / (TP + FN) on escalations
- **Lead time** = days between first `watch+` alarm and the escalation
  peak (median + 95% bootstrap CI)
- **By-tier breakdown** — does `covert_elevated` carry higher precision
  than `watch`?
- **Country-stratified** — does precision vary wildly by country?

## Verdict gates

| Outcome | Action |
|---|---|
| All 3 metrics pass | Publish results in `/methodology`. Engine validated. |
| 1–2 pass | Honest "directional" claim, narrower marketing language. |
| 0 pass | "NOT DEMONSTRATED" verdict. Engine returns to lab. |

## Honesty rules

- Engine code is FROZEN at `5cb9155` before backtest data is fetched.
  Any change after seeing results requires re-running the entire
  backtest with new pre-registered criterion.
- Country selection (11) was made by population-of-coverage, not by
  expected results. NG and ET included even though they're not "covert"
  in the strict sense — we WANT a recall-cost picture.
- Results published verbatim regardless of verdict (negative → still
  published, per Phase-1/2 dengue precedent in `docs/validation/`).

---

_Next: `scripts/backtest_covert.py` implements this design._
